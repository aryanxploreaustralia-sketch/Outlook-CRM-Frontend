/**
 * Recording a create or an edit made while offline.
 *
 * Two things must happen together: the record has to appear in the local cache
 * so the user can see their own work, and a queue entry has to exist so the
 * change eventually reaches the server. **Either one alone is a bug.** A record
 * with no queue entry is a change that silently never syncs; a queue entry with
 * no record is a mutation the user cannot see or correct.
 *
 * So both writes happen inside **one IndexedDB transaction** spanning both
 * stores. IndexedDB gives real atomicity across stores in a single transaction:
 * if either `put` fails, or the tab closes midway, neither lands. That is why
 * this module talks to `openDatabase` directly rather than calling the Phase 1
 * repositories — each of those opens its own transaction, and two transactions
 * cannot be atomic with each other. The Phase 1 repositories are otherwise
 * untouched.
 *
 * ## What is deliberately not here
 *
 * No network code. Phase 6 adds DELETE alongside create and edit; resolution of
 * a conflict is still not here, and is not automatic anywhere.
 */

import { META_KEY, OPERATION, QUEUE_STATUS, STORE, SYNC_STATUS, createMeta } from '@/offline/db/schema.js'
import { openDatabase } from '@/offline/db/database.js'
import { newOperationId } from '@/offline/repositories/syncQueueRepository.js'
import { metaOf } from '@/offline/repositories/recordRepository.js'
import { isLocalId, newLocalId } from '@/offline/write/localId.js'
import { CREATE_UNSUPPORTED, WRITABLE } from '@/offline/write/constants.js'

export { CREATE_UNSUPPORTED, WRITABLE }

/**
 * Builds a queue entry.
 *
 * Phase 1's fields are kept exactly as they were — `opId` is still the key and
 * still the idempotency key — with the Phase 5 additions the lifecycle needs.
 * Nothing was renamed, so a queue written before this phase still reads.
 */
function queueEntry({ entity, recordId, operation, payload, ownerId, baseUpdatedAt, dependsOn }) {
  return {
    // --- Phase 1 ---------------------------------------------------------
    opId: newOperationId(),
    entity,
    recordId,
    operation,
    payload,
    createdAt: new Date().toISOString(),
    retryCount: 0,
    lastError: null,
    status: QUEUE_STATUS.PENDING,

    // --- Phase 5 ---------------------------------------------------------
    /** Whose mutation this is. Never sent; the server derives owner from the session. */
    ownerId,
    /** Filled in when the server acknowledges a CREATE. Null until then. */
    serverRecordId: null,
    /** An earlier `opId` that must land first. See the processor's ordering. */
    dependsOn: dependsOn ?? null,
    /**
     * The server `updatedAt` this edit was based on.
     *
     * Not used to overwrite anything. It is the evidence Phase 6 needs to tell
     * "the server has not moved" from "somebody else edited this while I was
     * offline" — see `conflictRisk` below.
     */
    baseUpdatedAt: baseUpdatedAt ?? null,
    lastAttemptAt: null,
    httpStatus: null,
  }
}

/**
 * The pending entry a new mutation should merge into, if there is one.
 *
 * **Only `pending` entries are candidates.** Merging into anything else would
 * be a correctness bug:
 *
 *  - `processing` is in flight; changing its payload mid-request means the
 *    server receives one thing and the queue believes it sent another.
 *  - `completed` has already been accepted; its payload is history.
 *  - `failed` and `conflict` are waiting for a person. Folding a new edit into
 *    them would destroy the record of what was actually rejected.
 */
function coalescable(entries, recordId) {
  return entries
    .filter((entry) => entry.recordId === recordId && entry.status === QUEUE_STATUS.PENDING)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .pop() ?? null
}

/**
 * Writes the record and its queue entry in one transaction.
 *
 * @returns {Promise<{ record: object, queued: object, coalescedInto: ?string }>}
 */
async function commit({ storeName, record, entry, merge, userId }) {
  const db = await openDatabase(userId)
  const transaction = db.transaction([storeName, STORE.SYNC_QUEUE], 'readwrite')

  const records = transaction.objectStore(storeName)
  const queue = transaction.objectStore(STORE.SYNC_QUEUE)

  await records.put(record)
  await queue.put(merge ?? entry)

  // Throws if either write failed, and nothing is committed in that case.
  await transaction.done

  return { record, queued: merge ?? entry, coalescedInto: merge ? merge.opId : null }
}

/**
 * Creates a record locally and queues it for the server.
 *
 * The record is stored under a `local_…` id. That id is what the UI navigates
 * to and what the queue entry points at, and it is replaced by the server's id
 * only when the create is acknowledged.
 *
 * @param {string} entity  `leads` | `contacts`
 * @param {object} payload The form's values — exactly what the online create
 *   would have POSTed. Never an `owner`: see below.
 * @param {{ userId: string }} options
 */
export async function createLocal(entity, payload, { userId } = {}) {
  const storeName = WRITABLE[entity]
  if (!storeName) throw new Error(`Cannot create ${entity} offline.`)
  if (!userId) throw new Error('An offline create needs the signed-in user id.')

  if (CREATE_UNSUPPORTED.includes(entity)) {
    throw new Error(
      `The API has no create endpoint for ${entity}, so it cannot be created offline. ` +
      'Companies are created implicitly by the server when a lead is saved.',
    )
  }

  const localId = newLocalId()
  const clean = stripOwnership(payload)

  const record = {
    ...clean,
    id: localId,
    /*
     * Deliberately absent: `createdAt`, `updatedAt`, `reference`, `owner`.
     *
     * Every one of those is the server's to allocate. Writing a plausible value
     * here would produce a record that *looks* authoritative — a reference
     * number a colleague could quote — and would then be silently replaced by a
     * different one on sync. The UI shows "waiting to sync" instead.
     */
    [META_KEY]: createMeta({
      owner: userId,
      status: SYNC_STATUS.PENDING_CREATE,
      serverUpdatedAt: null,
      localVersion: 1,
    }),
  }

  const entry = queueEntry({
    entity,
    recordId: localId,
    operation: OPERATION.CREATE,
    payload: clean,
    ownerId: userId,
    baseUpdatedAt: null,
  })

  return commit({ storeName, record, entry, merge: null, userId })
}

/**
 * Applies an edit locally and queues it.
 *
 * @param {string} entity
 * @param {string} id     The record's id — a server id, or a `local_…` one for
 *   a record created offline and not yet synced.
 * @param {object} changes Only the fields the user actually changed.
 * @param {{ userId: string }} options
 */
export async function updateLocal(entity, id, changes, { userId } = {}) {
  const storeName = WRITABLE[entity]
  if (!storeName) throw new Error(`Cannot edit ${entity} offline.`)
  if (!userId) throw new Error('An offline edit needs the signed-in user id.')

  const db = await openDatabase(userId)
  const existing = await db.get(storeName, id)
  if (!existing) throw new Error(`No cached ${entity} record with id ${id}.`)

  const clean = stripOwnership(changes)
  const queued = await db.getAll(STORE.SYNC_QUEUE)
  const open = coalescable(queued, id)

  const meta = metaOf(existing)

  /*
   * The edited record, with the changes applied over what was cached.
   *
   * A partial merge, never a replacement: fields the user did not touch keep
   * their cached values, so an edit to one field cannot erase the rest of the
   * record. The API's update endpoints have the same semantics — see below.
   */
  const record = {
    ...existing,
    ...clean,
    id,
    [META_KEY]: {
      ...meta,
      status: open?.operation === OPERATION.CREATE
        ? SYNC_STATUS.PENDING_CREATE
        : SYNC_STATUS.PENDING_UPDATE,
      localVersion: (meta.localVersion ?? 0) + 1,
    },
  }

  if (open) {
    /*
     * Coalescing, and exactly why each case is safe.
     *
     * CREATE + EDIT → one CREATE carrying the final state. The record does not
     * exist on the server yet, so no intermediate value was ever observable by
     * anyone; sending the create twice, or a create then an update, would only
     * add a round trip and a failure mode.
     *
     * EDIT + EDIT → one EDIT carrying the merged fields. The update endpoints
     * apply supplied fields over the stored document, so the union of two
     * partial edits is precisely what applying them in order would produce.
     *
     * What this would NOT be safe for is anything order-dependent or additive —
     * a stage transition that records history per move, an append, a counter.
     * Those are not editable through this path: `updateLeadSchema` accepts
     * `stage`, and a stage change writes a `stageHistory` entry, so a coalesced
     * edit records the final stage and one transition rather than each step.
     * That is a deliberate, documented loss of intermediate history, and it is
     * why `stageReason` travels with the final payload.
     */
    const merged = {
      ...open,
      payload: { ...open.payload, ...clean },
      // The queue position is the *first* mutation's, so a coalesced edit does
      // not jump ahead of operations queued after the create it belongs to.
      createdAt: open.createdAt,
    }

    return commit({ storeName, record, entry: null, merge: merged, userId })
  }

  const entry = queueEntry({
    entity,
    recordId: id,
    operation: OPERATION.UPDATE,
    payload: clean,
    ownerId: userId,
    /*
     * The version this edit was made against. If the server's `updatedAt` has
     * moved past it by the time the queue drains, somebody else changed the
     * record while this user was offline — which Phase 6 must resolve rather
     * than either side silently winning.
     */
    baseUpdatedAt: meta.serverUpdatedAt ?? existing.updatedAt ?? null,
    // A local record is only reachable through the create that made it.
    dependsOn: isLocalId(id) ? queued.find((e) => e.recordId === id)?.opId ?? null : null,
  })

  return commit({ storeName, record, entry, merge: null, userId })
}

/**
 * Removes any client-supplied ownership claim from a payload.
 *
 * The server derives the owner from the session and ignores these entirely, so
 * this changes no authorisation outcome — it is defence in depth. Stripping
 * them here means a spoofed field is never written into the local cache, never
 * persisted in the queue, and never sent, so there is no point at which it
 * could be mistaken for something the server honoured.
 */
/**
 * Deletes a record locally and queues the deletion.
 *
 * ## The local record is hidden, not destroyed
 *
 * `markDeleted`-style tombstoning rather than a `delete`: the row carries the
 * payload, the base version and the queue link that the server round trip still
 * needs. Destroying it would leave a queue entry pointing at nothing, and would
 * make the deletion unrecoverable if the server refused it. Phase 4's
 * `isVisible` already excludes `_sync.deletedLocally`, so the record leaves
 * every list, detail read, facet and offline search the moment this returns —
 * without anything in the read layer needing to change.
 *
 * ## A record the server has never seen is simply withdrawn
 *
 * If the pending mutation is still a CREATE, the record does not exist in
 * MongoDB and never did. Sending a CREATE followed by a DELETE would make an
 * enquiry, audit it, allocate a reference and then bin it — visible to
 * colleagues for the moment in between, and recorded in the audit log forever.
 * So the CREATE is cancelled and the local row removed outright: no request is
 * made, because there is nothing on the server to undo.
 *
 * @param {string} entity
 * @param {string} id
 * @param {{ userId: string }} options
 * @returns {Promise<{ cancelled: boolean, queued: ?object }>}
 *   `cancelled` is true when nothing needs to reach the server at all.
 */
export async function deleteLocal(entity, id, { userId } = {}) {
  const storeName = WRITABLE[entity]
  if (!storeName) throw new Error(`Cannot delete ${entity} offline.`)
  if (!userId) throw new Error('An offline delete needs the signed-in user id.')

  const db = await openDatabase(userId)
  const existing = await db.get(storeName, id)
  if (!existing) throw new Error(`No cached ${entity} record with id ${id}.`)

  const queued = await db.getAll(STORE.SYNC_QUEUE)
  const open = coalescable(queued, id)
  const meta = metaOf(existing)

  // --- the record never reached the server: withdraw it entirely ------------
  if (open?.operation === OPERATION.CREATE) {
    const transaction = db.transaction([storeName, STORE.SYNC_QUEUE], 'readwrite')
    await transaction.objectStore(storeName).delete(id)
    await transaction.objectStore(STORE.SYNC_QUEUE).delete(open.opId)
    await transaction.done

    return { cancelled: true, queued: null, record: null }
  }

  const record = {
    ...existing,
    [META_KEY]: {
      ...meta,
      status: SYNC_STATUS.PENDING_DELETE,
      deletedLocally: true,
      localVersion: (meta.localVersion ?? 0) + 1,
    },
  }

  /*
   * A pending EDIT is replaced rather than followed.
   *
   * The user's final intent is deletion, and sending the edit first would write
   * a version of the record that nobody will ever see, audit it as an update,
   * and then delete it. Collapsing to a single DELETE loses no observable state.
   *
   * The **base version is the edit's**, not the current record's: it is the
   * version the user was actually looking at when they began, so the server's
   * concurrency check still asks the right question — "has anyone else touched
   * this since?" — rather than a question about a version only this client saw.
   */
  const entry = queueEntry({
    entity,
    recordId: id,
    operation: OPERATION.DELETE,
    payload: {},
    ownerId: userId,
    baseUpdatedAt: open?.baseUpdatedAt ?? meta.serverUpdatedAt ?? existing.updatedAt ?? null,
  })

  const transaction = db.transaction([storeName, STORE.SYNC_QUEUE], 'readwrite')
  await transaction.objectStore(storeName).put(record)
  if (open) await transaction.objectStore(STORE.SYNC_QUEUE).delete(open.opId)
  await transaction.objectStore(STORE.SYNC_QUEUE).put(entry)
  await transaction.done

  return { cancelled: false, queued: entry, record, replaced: open?.opId ?? null }
}

function stripOwnership(payload = {}) {
  const {
    owner: _owner, ownerId: _ownerId, userId: _userId, user: _user,
    role: _role, createdBy: _createdBy, updatedBy: _updatedBy,
    ...safe
  } = payload ?? {}
  return safe
}

export default { createLocal, updateLocal, deleteLocal, WRITABLE, CREATE_UNSUPPORTED }
