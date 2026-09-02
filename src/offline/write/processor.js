/**
 * Draining the outbox.
 *
 * Reads pending mutations in the order they were made, sends each through the
 * CRM's own authenticated API services, and reconciles the local record with
 * whatever the server says. It is the only component that turns an offline
 * change into a real one.
 *
 * ## The rules it exists to enforce
 *
 *  - **Nothing is ever silently discarded.** Every terminal outcome leaves the
 *    entry in the queue with its payload, its error and its HTTP status. The
 *    only entries that go away are ones the server accepted.
 *  - **Order is the user's order.** A create must land before the edit that
 *    depends on it, so the queue drains oldest-first and an entry whose
 *    prerequisite has not completed is skipped, not reordered around.
 *  - **A retry can never duplicate.** Each entry's `opId` is minted once, when
 *    the mutation is queued, and travels as `X-Client-Mutation-Id` on every
 *    attempt. The server replays its stored response instead of writing twice.
 *  - **One processor at a time.** Two drains racing would send the same entry
 *    twice with the same key — survivable, thanks to the header, but it would
 *    also interleave reconciliations. A module-level lock prevents it.
 *
 * ## What it deliberately does not do
 *
 * No background scheduling, no service worker, no conflict resolution. A 409
 * is recorded and left alone for Phase 6. Deletion is not processed at all,
 * because Phase 5 never queues one.
 */

import { OPERATION, QUEUE_STATUS, STORE, SYNC_STATUS, META_KEY, createMeta } from '@/offline/db/schema.js'
import { openDatabase } from '@/offline/db/database.js'
import { MUTATION_ID_HEADER, WRITABLE } from '@/offline/write/constants.js'
import { isLocalId } from '@/offline/write/localId.js'
import { createLead, updateCompany, updateLead } from '@/api/services/lead.service'
import { createContact, updateContact } from '@/api/services/contact.service'

/** How many mutations one drain will attempt. Keeps memory and traffic bounded. */
export const BATCH_SIZE = 25

/** Attempts before a retryable failure stops being retried automatically. */
export const MAX_ATTEMPTS = 5

/** What a drain concluded. */
export const DRAIN_RESULT = Object.freeze({
  IDLE: 'idle',
  COMPLETED: 'completed',
  BUSY: 'busy',
  OFFLINE: 'offline',
  UNAUTHENTICATED: 'unauthenticated',
  BLOCKED: 'blocked',
})

/**
 * The one lock.
 *
 * Module-level rather than per-call, because the thing being protected is the
 * queue itself and there is one of those per tab. Two tabs are still possible;
 * the idempotency key is what makes that safe rather than this.
 */
let draining = false

/** How each entity's mutations reach the server. The CRM's own services. */
const SENDERS = {
  leads: {
    [OPERATION.CREATE]: (payload, options) => createLead(payload, options),
    [OPERATION.UPDATE]: (id, payload, options) => updateLead(id, payload, options),
  },
  contacts: {
    [OPERATION.CREATE]: (payload, options) => createContact(payload, options),
    [OPERATION.UPDATE]: (id, payload, options) => updateContact(id, payload, options),
  },
  companies: {
    // No create: the API has no `POST /companies`. `mutations.js` refuses to queue one.
    [OPERATION.UPDATE]: (id, payload, options) => updateCompany(id, payload, options),
  },
}

/**
 * Finds the record the server sent back, whatever it wrapped it in.
 *
 * The mutation responses are not uniform — a lead create returns
 * `{ lead, company, contact, mail, warnings }`, a contact create returns
 * `{ contact, possibleDuplicates }`, and the update services already unwrap to
 * the record. Rather than teach the processor each shape, this looks for the
 * record wherever it is.
 */
function recordFrom(response, entity) {
  if (!response || typeof response !== 'object') return null

  const singular = { leads: 'lead', contacts: 'contact', companies: 'company' }[entity]
  if (response[singular] && typeof response[singular] === 'object') return response[singular]
  if (typeof response.id === 'string') return response

  return null
}

/**
 * Classifies a failed attempt into what should happen next.
 *
 * Each branch is a deliberate policy decision, not a default:
 *
 *  - **network** — the server was never reached. Nothing is wrong with the
 *    mutation, so it stays `pending` and the drain stops; hammering a dead
 *    connection helps nobody.
 *  - **401** — the session is gone. Retrying cannot fix it and would produce a
 *    storm of failures, so processing stops entirely and the entry is untouched.
 *  - **403** — the permission was revoked. A person must resolve it; retrying
 *    is pointless.
 *  - **409** — the record moved on. This is a conflict, kept apart from
 *    `failed` so a later retry cannot overwrite somebody's work.
 *  - **400/422** — the payload is not acceptable. Retrying an unchanged payload
 *    will fail identically forever, so it is marked failed and kept for the
 *    user to correct.
 *  - **5xx** — the server is unwell but the mutation may be fine. Retryable,
 *    bounded by `MAX_ATTEMPTS`.
 */
export function classify(error) {
  if (error?.isCanceled) return { stop: true, status: null, retryable: true, terminal: false }
  if (error?.isNetwork) return { stop: true, status: DRAIN_RESULT.OFFLINE, retryable: true, terminal: false }

  const code = error?.status

  if (code === 401) return { stop: true, status: DRAIN_RESULT.UNAUTHENTICATED, retryable: false, terminal: false }
  if (code === 403) return { stop: false, status: null, retryable: false, terminal: QUEUE_STATUS.FAILED }
  if (code === 409) return { stop: false, status: null, retryable: false, terminal: QUEUE_STATUS.CONFLICT }
  if (code === 400 || code === 422) return { stop: false, status: null, retryable: false, terminal: QUEUE_STATUS.FAILED }
  if (typeof code === 'number' && code >= 500) return { stop: false, status: null, retryable: true, terminal: false }

  // An unrecognised shape is treated as permanent rather than retried blindly.
  return { stop: false, status: null, retryable: false, terminal: QUEUE_STATUS.FAILED }
}

/** Writes an entry back, without touching anything else. */
async function saveEntry(entry, { userId }) {
  const db = await openDatabase(userId)
  await db.put(STORE.SYNC_QUEUE, entry)
  return entry
}

/**
 * Replaces a local record with the server's version, in one transaction.
 *
 * For a CREATE this is a **rekey**: the row lives under `local_…` and has to
 * move to the server's id. Both the delete and the put happen together, so the
 * record can never be absent from the cache or present under both ids.
 *
 * The server's fields win wholesale — `_id`, `reference`, `createdAt`,
 * `updatedAt`, `owner` and every derived value are the server's to state, and
 * the local copy was explicitly built without them.
 */
async function reconcile({ entity, entry, serverRecord, userId }) {
  const storeName = WRITABLE[entity]
  const db = await openDatabase(userId)
  const transaction = db.transaction([storeName, STORE.SYNC_QUEUE], 'readwrite')

  const records = transaction.objectStore(storeName)
  const queue = transaction.objectStore(STORE.SYNC_QUEUE)

  const previous = await records.get(entry.recordId)

  const stored = {
    ...serverRecord,
    [META_KEY]: createMeta({
      owner: userId,
      status: SYNC_STATUS.SYNCED,
      serverUpdatedAt: serverRecord.updatedAt ?? null,
      lastSyncedAt: new Date().toISOString(),
      localVersion: 0,
    }),
  }

  // The rekey. Only when the ids genuinely differ, so an UPDATE does not delete
  // and rewrite the row it just confirmed.
  if (previous && String(entry.recordId) !== String(serverRecord.id)) {
    await records.delete(entry.recordId)
  }
  await records.put(stored)

  await queue.put({
    ...entry,
    status: QUEUE_STATUS.COMPLETED,
    serverRecordId: String(serverRecord.id),
    lastError: null,
    httpStatus: 200,
    lastAttemptAt: new Date().toISOString(),
  })

  await transaction.done
  return stored
}

/**
 * Rewrites later entries that still point at a now-superseded local id.
 *
 * A create and the edits queued after it all reference `local_…`. Once the
 * server has issued a real id, every one of those has to be re-aimed or it
 * would be sent to a URL containing a local id — which the server would reject
 * as a malformed ObjectId.
 */
async function repoint({ localId, serverId, userId }) {
  const db = await openDatabase(userId)
  const entries = await db.getAll(STORE.SYNC_QUEUE)

  const stale = entries.filter(
    (entry) => entry.recordId === localId && entry.status === QUEUE_STATUS.PENDING,
  )
  if (stale.length === 0) return 0

  const transaction = db.transaction(STORE.SYNC_QUEUE, 'readwrite')
  await Promise.all(stale.map((entry) => transaction.store.put({
    ...entry,
    recordId: serverId,
    // The prerequisite has landed, so the dependency is discharged.
    dependsOn: null,
  })))
  await transaction.done

  return stale.length
}

/**
 * Whether an entry may be attempted now.
 *
 * Two ways it may not: an explicit `dependsOn` that has not completed, or a
 * record id that is still local — which means the create it belongs to has not
 * been acknowledged, whether or not the dependency was recorded.
 */
function blockedBy(entry, byId) {
  if (entry.dependsOn) {
    const prerequisite = byId.get(entry.dependsOn)
    if (prerequisite && prerequisite.status !== QUEUE_STATUS.COMPLETED) return entry.dependsOn
  }

  if (entry.operation === OPERATION.UPDATE && isLocalId(entry.recordId)) return entry.recordId

  return null
}

/**
 * Sends one entry and records the outcome.
 *
 * @returns {Promise<{ ok: boolean, stop: ?string }>}
 */
async function processOne(entry, { userId, signal }) {
  const senders = SENDERS[entry.entity]
  const send = senders?.[entry.operation]

  if (!send) {
    await saveEntry({
      ...entry,
      status: QUEUE_STATUS.FAILED,
      lastError: `No sender for ${entry.entity}/${entry.operation}.`,
      lastAttemptAt: new Date().toISOString(),
    }, { userId })
    return { ok: false, stop: null }
  }

  // `processing` is written before the request, so a tab closed mid-flight
  // leaves visible evidence rather than an entry that looks untouched.
  await saveEntry({ ...entry, status: QUEUE_STATUS.PROCESSING, lastAttemptAt: new Date().toISOString() }, { userId })

  /*
   * The idempotency key. Minted when the mutation was queued, identical on
   * every attempt — which is the whole reason a lost response cannot become a
   * duplicate record.
   */
  const options = { signal, headers: { [MUTATION_ID_HEADER]: entry.opId } }

  try {
    const response = entry.operation === OPERATION.CREATE
      ? await send(entry.payload, options)
      : await send(entry.recordId, entry.payload, options)

    const serverRecord = recordFrom(response, entry.entity)

    if (!serverRecord?.id) {
      await saveEntry({
        ...entry,
        status: QUEUE_STATUS.FAILED,
        lastError: 'The server accepted the mutation but returned no record.',
        lastAttemptAt: new Date().toISOString(),
      }, { userId })
      return { ok: false, stop: null }
    }

    await reconcile({ entity: entry.entity, entry, serverRecord, userId })

    if (isLocalId(entry.recordId)) {
      await repoint({ localId: entry.recordId, serverId: String(serverRecord.id), userId })
    }

    return { ok: true, stop: null }
  } catch (error) {
    const verdict = classify(error)
    const attempts = entry.retryCount + 1

    const next = {
      ...entry,
      retryCount: attempts,
      lastError: String(error?.message ?? error).slice(0, 500),
      httpStatus: error?.status ?? null,
      lastAttemptAt: new Date().toISOString(),
    }

    if (verdict.terminal) {
      // A conflict or a permanent rejection. Kept, never deleted.
      await saveEntry({ ...next, status: verdict.terminal }, { userId })
      return { ok: false, stop: null }
    }

    if (verdict.retryable && attempts < MAX_ATTEMPTS) {
      // Back to `pending` so the next drain picks it up.
      await saveEntry({ ...next, status: QUEUE_STATUS.PENDING }, { userId })
    } else if (verdict.retryable) {
      await saveEntry({
        ...next,
        status: QUEUE_STATUS.FAILED,
        lastError: `${next.lastError} (gave up after ${attempts} attempts)`,
      }, { userId })
    } else {
      // 401: left exactly as it was, so signing back in resumes it untouched.
      await saveEntry({ ...next, retryCount: entry.retryCount, status: QUEUE_STATUS.PENDING }, { userId })
    }

    return { ok: false, stop: verdict.stop ? (verdict.status ?? DRAIN_RESULT.OFFLINE) : null }
  }
}

/**
 * Attempts the pending queue, oldest first.
 *
 * @param {{ userId: string, signal?: AbortSignal, limit?: number }} options
 * @returns {Promise<{ result: string, attempted: number, succeeded: number,
 *   failed: number, skipped: number }>}
 */
export async function drain({ userId, signal = null, limit = BATCH_SIZE } = {}) {
  if (!userId) return { result: DRAIN_RESULT.UNAUTHENTICATED, attempted: 0, succeeded: 0, failed: 0, skipped: 0 }
  if (draining) return { result: DRAIN_RESULT.BUSY, attempted: 0, succeeded: 0, failed: 0, skipped: 0 }

  draining = true
  const summary = { result: DRAIN_RESULT.COMPLETED, attempted: 0, succeeded: 0, failed: 0, skipped: 0 }

  try {
    const db = await openDatabase(userId)
    const all = await db.getAll(STORE.SYNC_QUEUE)
    const byId = new Map(all.map((entry) => [entry.opId, entry]))

    /*
     * Deterministic order: when the mutation was made, then its id.
     *
     * `createdAt` alone is not a total order — two mutations in the same
     * millisecond would sort arbitrarily, and an unstable order is exactly what
     * breaks a create/edit pair. `opId` breaks the tie the same way the sync
     * cursor uses `_id`.
     */
    const pending = all
      .filter((entry) => entry.status === QUEUE_STATUS.PENDING)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.opId.localeCompare(b.opId))
      .slice(0, limit)

    if (pending.length === 0) return { ...summary, result: DRAIN_RESULT.IDLE }

    for (const entry of pending) {
      if (signal?.aborted) break

      const blocker = blockedBy(entry, byId)
      if (blocker) {
        // Left pending. Its prerequisite is earlier in this same ordering, so a
        // later drain finds it ready rather than stuck.
        summary.skipped += 1
        continue
      }

      summary.attempted += 1
      // Re-read: an earlier iteration may have repointed this entry off a local id.
      const current = (await db.get(STORE.SYNC_QUEUE, entry.opId)) ?? entry
      const { ok, stop } = await processOne(current, { userId, signal })

      if (ok) summary.succeeded += 1
      else summary.failed += 1

      if (stop) return { ...summary, result: stop }
    }

    return summary
  } finally {
    draining = false
  }
}

/** Whether a drain is currently running in this tab. */
export const isDraining = () => draining

export default { drain, classify, isDraining, BATCH_SIZE, MAX_ATTEMPTS, DRAIN_RESULT }
