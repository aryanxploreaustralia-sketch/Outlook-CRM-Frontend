/**
 * Filling the local database from the server's change feed.
 *
 * The first place the CRM and the Phase 1 local database actually meet. It
 * reads through the existing API service, writes through the existing Phase 1
 * repositories, and adds nothing between them.
 *
 * ## The rule the whole file is built around
 *
 * **The cursor advances only after the page it describes is on disk.**
 *
 *     fetch page → write records → await the write → persist cursor
 *
 * The other order is faster to write and silently loses data: a browser closed
 * between saving the cursor and finishing the write leaves a client whose
 * cursor claims records it never stored, and an incremental sync will never
 * send them again, because their `updatedAt` is behind that cursor. The loss is
 * permanent and invisible.
 *
 * Reprocessing a page is harmless — every write is an upsert keyed on the
 * server's id. So this errs, deliberately and in one direction only, toward
 * doing a page twice rather than missing one.
 *
 * ## Nothing here can break the CRM
 *
 * Every entry point resolves rather than throws, and the online application
 * neither imports this file nor waits on it. A hydration that fails leaves a
 * partially filled cache and a CRM behaving exactly as it did before — which is
 * the correct outcome while the local database is not yet read from.
 */

import { fetchChanges } from '@/api/services/sync.service'
import { companiesRepository } from '@/offline/repositories/companiesRepository.js'
import { contactsRepository } from '@/offline/repositories/contactsRepository.js'
import { identityRepository } from '@/offline/repositories/identityRepository.js'
import { leadsRepository } from '@/offline/repositories/leadsRepository.js'
import { META, metaKey, syncMetaRepository } from '@/offline/repositories/syncMetaRepository.js'
import { syncQueueRepository } from '@/offline/repositories/syncQueueRepository.js'
import { isAvailable, openDatabase } from '@/offline/db/database.js'
import { partitionPulledRecords } from '@/offline/sync/reconcile.js'
import { OPERATION, QUEUE_STATUS, STORE, SYNC_STATUS } from '@/offline/db/schema.js'

/** Entity name → the Phase 1 repository that stores it. */
const REPOSITORIES = Object.freeze({
  leads: leadsRepository,
  contacts: contactsRepository,
  companies: companiesRepository,
})

export const HYDRATION_ENTITIES = Object.freeze(Object.keys(REPOSITORIES))

/**
 * Page size.
 *
 * The server's own default, and comfortably under its 500 ceiling. Fifteen
 * requests for 3,630 leads rather than one, which is the point: a dropped
 * connection costs one page, and no single response has to be held in memory
 * whole.
 */
export const PAGE_SIZE = 250

/**
 * A ceiling on pages per run.
 *
 * Not an expectation — 3,630 leads is fifteen pages — but a stop for the case
 * where a server bug returns `hasMore: true` forever. Without it a loop like
 * this becomes an unkillable request storm against production.
 */
const MAX_PAGES_PER_ENTITY = 200

/** Why a run stopped. Reported rather than thrown. */
export const HYDRATION_RESULT = Object.freeze({
  COMPLETED: 'completed',
  UNAVAILABLE: 'unavailable',
  UNAUTHENTICATED: 'unauthenticated',
  FORBIDDEN: 'forbidden',
  OFFLINE: 'offline',
  RATE_LIMITED: 'rateLimited',
  SERVER_ERROR: 'serverError',
  WRITE_FAILED: 'writeFailed',
  MALFORMED: 'malformed',
  PAGE_LIMIT: 'pageLimit',
})

/**
 * Classifies a failure, because these are not all the same thing.
 *
 * "The browser is offline", "the session expired" and "the server returned 500"
 * demand different responses, and collapsing them into one "sync failed" is how
 * a client ends up retrying an expired session forever. `httpClient` already
 * normalises the shape; this maps it to an outcome and to whether retrying
 * could possibly help.
 */
export function classifyError(error) {
  if (error?.isCanceled) return { result: null, retryable: false }
  if (error?.isNetwork) return { result: HYDRATION_RESULT.OFFLINE, retryable: true }

  switch (error?.status) {
    case 401:
      // The session is gone. Retrying cannot fix it; signing in can.
      return { result: HYDRATION_RESULT.UNAUTHENTICATED, retryable: false }
    case 403:
      // The permission was revoked. Also not a retry.
      return { result: HYDRATION_RESULT.FORBIDDEN, retryable: false }
    case 429:
      return { result: HYDRATION_RESULT.RATE_LIMITED, retryable: true }
    default:
      if (typeof error?.status === 'number' && error.status >= 500) {
        return { result: HYDRATION_RESULT.SERVER_ERROR, retryable: true }
      }
      return { result: HYDRATION_RESULT.MALFORMED, retryable: false }
  }
}

/** Where this entity's cursor lives. The Phase 1 store — not a second one. */
const cursorKey = (entity) => metaKey(META.CURSOR, entity)

/**
 * Applies the deletions a page carried.
 *
 * Two shapes, and they mean different things:
 *
 *  - `purged: true` — every record of this type went. The local copies are
 *    stale wholesale, so each is tombstoned rather than removed: Phase 1's
 *    `markDeleted` keeps the row until a later phase confirms it, which is the
 *    conservative direction while nothing yet reads this cache.
 *  - a named id — that one record went, and is tombstoned the same way.
 *
 * Nothing is hard-removed here. A deletion the server later contradicts is
 * recoverable from a tombstone and unrecoverable from an absence.
 */
async function applyDeletions({ entity, deletions, userId }) {
  const repository = REPOSITORIES[entity]
  let applied = 0

  const tombstone = async (id) => {
    /*
     * Phase 6 — a server deletion must never quietly erase queued local work.
     *
     * The record is tombstoned either way, because the server is the source of
     * truth about whether it still exists. What changes is the fate of any
     * mutation this user had queued for it:
     *
     *  - a pending CREATE cannot be affected: its record has no server id yet,
     *    so no server tombstone can name it.
     *  - a pending UPDATE becomes a **conflict**. The user edited something a
     *    colleague deleted, and neither "apply the edit" (which would resurrect
     *    the record) nor "drop the edit" (which would lose their work) is ours
     *    to choose. It is preserved, unretried, for a person to settle.
     *  - a pending DELETE **agrees** with the server, so it is completed. Two
     *    parties reached the same conclusion; sending the request would only
     *    ask the server to delete something already gone.
     *
     * Anything already `completed`, `failed` or `conflict` is left alone — it
     * is history or it is already waiting for someone.
     */
    const queued = (await syncQueueRepository.byRecord(id, { userId })) ?? []

    for (const entry of queued) {
      if (entry.status !== QUEUE_STATUS.PENDING) continue

      if (entry.operation === OPERATION.DELETE) {
        await syncQueueRepository.setStatus(entry.opId, QUEUE_STATUS.COMPLETED, { userId })
        continue
      }

      if (entry.operation === OPERATION.UPDATE) {
        const db = await openDatabase(userId)
        await db.put(STORE.SYNC_QUEUE, {
          ...entry,
          status: QUEUE_STATUS.CONFLICT,
          httpStatus: null,
          lastError: 'The record was deleted on the server while this change was queued.',
          conflict: {
            detectedAt: new Date().toISOString(),
            conflictType: 'deletedOnServer',
            entity,
            id: String(id),
            baseUpdatedAt: entry.baseUpdatedAt ?? null,
            serverUpdatedAt: null,
            serverDeleted: true,
          },
        })
      }
    }

    return repository.markDeleted(id, { userId })
  }

  for (const deletion of deletions ?? []) {
    if (deletion?.purged) {
      /*
       * A purge names no id, so every cached record of this entity is suspect.
       * They are tombstoned in place — see the note above on why not removed.
       *
       * The purge semantics themselves are untouched: it is still one feed row
       * meaning "all of them", never expanded into per-record traffic. Each
       * local record simply takes the same path a named deletion would.
       */
      const all = await repository.all({ userId })
      for (const record of all) {
        await tombstone(record.id)
        applied += 1
      }
      continue
    }

    if (deletion?.id) {
      const marked = await tombstone(deletion.id)
      if (marked) applied += 1
    }
  }

  return applied
}

/**
 * Hydrates one entity, page by page.
 *
 * @param {object} params
 * @param {string} params.entity
 * @param {string} params.userId   The signed-in user. Scopes the database.
 * @param {?AbortSignal} [params.signal]
 * @param {(progress: object) => void} [params.onProgress]
 */
async function hydrateEntity({ entity, userId, signal = null, onProgress }) {
  /** Records held back because the user has unsynced work on them. */
  let guardedTotal = 0
  /** Queued mutations that became conflicts because the server moved. */
  let conflictTotal = 0
  const repository = REPOSITORIES[entity]

  let cursor = await syncMetaRepository.get(cursorKey(entity), { userId })
  let written = 0
  let deleted = 0
  let pages = 0

  for (;;) {
    if (signal?.aborted) return { entity, result: null, written, deleted, pages }

    if (pages >= MAX_PAGES_PER_ENTITY) {
      return { entity, result: HYDRATION_RESULT.PAGE_LIMIT, written, deleted, pages, guarded: guardedTotal, conflicts: conflictTotal }
    }

    // --- fetch ------------------------------------------------------------
    let page
    try {
      const feed = await fetchChanges(
        { cursors: cursor ? { [entity]: cursor } : {}, entities: [entity], limit: PAGE_SIZE },
        { signal },
      )
      page = feed?.entities?.[entity]
    } catch (error) {
      const { result } = classifyError(error)
      // The cursor is untouched, so the next run resumes from the last page
      // that actually landed.
      return { entity, result, written, deleted, pages, error, guarded: guardedTotal, conflicts: conflictTotal }
    }

    if (!page || !Array.isArray(page.records)) {
      return { entity, result: HYDRATION_RESULT.MALFORMED, written, deleted, pages, guarded: guardedTotal, conflicts: conflictTotal }
    }

    // --- write, and only then advance -------------------------------------
    try {
      /*
       * `putMany` is one transaction for the whole page — 250 records, not one
       * transaction each. Records arrive already owner-scoped by the server;
       * `owner` is stamped locally because the API does not send it (the CRM's
       * DTOs omit it deliberately) and the index needs a value.
       */
      /*
       * Phase 7 — a pull must not overwrite an unsynced local change.
       *
       * `putMany` marks what it writes as `synced`, which is a lie for a record
       * the user has edited offline: their change would disappear from the
       * register while its queue entry still claimed to be pending. Records
       * with something queued are held back here and handled as metadata only;
       * if the server has moved past what the queued mutation assumed, that
       * mutation becomes a conflict rather than a stale overwrite waiting to
       * happen. See `reconcile.js`.
       */
      const { writable, guarded, conflicts } = await partitionPulledRecords({
        entity, records: page.records, userId,
      })

      guardedTotal += guarded
      conflictTotal += conflicts

      const count = await repository.putMany(writable, {
        userId,
        owner: userId,
        status: SYNC_STATUS.SYNCED,
      })

      deleted += await applyDeletions({ entity, deletions: page.deleted, userId })
      written += count
    } catch (error) {
      /*
       * The page did not land. The cursor stays where it was, so this page is
       * fetched again next time — which is the whole reason writes precede the
       * cursor.
       */
      return { entity, result: HYDRATION_RESULT.WRITE_FAILED, written, deleted, pages, error, guarded: guardedTotal, conflicts: conflictTotal }
    }

    pages += 1

    // --- the cursor, last -------------------------------------------------
    if (page.nextCursor && page.nextCursor !== cursor) {
      await syncMetaRepository.set(cursorKey(entity), page.nextCursor, { userId })
      cursor = page.nextCursor
    }

    onProgress?.({ entity, pages, written, deleted, hasMore: page.hasMore })

    if (!page.hasMore) {
      await syncMetaRepository.setLastPull(entity, new Date().toISOString(), { userId })
      return { entity, result: HYDRATION_RESULT.COMPLETED, written, deleted, pages, guarded: guardedTotal, conflicts: conflictTotal }
    }
  }
}

/**
 * Hydrates the local database for one authenticated user.
 *
 * Never throws. Every failure is reported in the returned summary, because the
 * caller is application startup and a rejected promise there is a broken CRM.
 *
 * @param {object} params
 * @param {object} params.user   The `/auth/status` user. Its `id` is required.
 * @param {string[]} [params.entities]
 * @param {?AbortSignal} [params.signal]
 * @param {(progress: object) => void} [params.onProgress]
 * @returns {Promise<object>} A summary. Inspect `result` per entity.
 */
export async function hydrate({ user, entities = HYDRATION_ENTITIES, signal = null, onProgress } = {}) {
  const startedAt = new Date().toISOString()

  if (!isAvailable()) {
    // Private browsing, a disabled store, an old browser. Not an error — this
    // deployment simply has no local database, and the CRM works online.
    return { result: HYDRATION_RESULT.UNAVAILABLE, startedAt, entities: {} }
  }

  const userId = user?.id ? String(user.id) : null
  if (!userId) {
    return { result: HYDRATION_RESULT.UNAUTHENTICATED, startedAt, entities: {} }
  }

  /*
   * The identity, first.
   *
   * The database is named per user, so this row is what a later phase reads to
   * know whose cache it has opened. `identityRepository.save` scrubs anything
   * credential-shaped, so passing the whole user object cannot persist a token
   * even by accident — but only the four fields below are passed anyway.
   */
  try {
    await identityRepository.save({
      userId,
      displayName: user.displayName ?? null,
      email: user.email ?? null,
      role: user.role ?? null,
      /*
       * `/auth/status` does not send a permission list, so this is empty rather
       * than guessed. A local authorisation decision must never be invented
       * from a role name; the server remains the authority.
       */
      permissions: [],
    }, { userId })
  } catch {
    // A cache that cannot record who it belongs to is not one to fill.
    return { result: HYDRATION_RESULT.WRITE_FAILED, startedAt, entities: {} }
  }

  const requested = entities.filter((entity) => HYDRATION_ENTITIES.includes(entity))
  const results = {}

  /*
   * Sequential, deliberately.
   *
   * Three concurrent hydrations would put three requests in flight against an
   * endpoint rate-limited per user, and would interleave three write streams
   * into one IndexedDB connection. Sequential is slower and is the behaviour
   * that finishes.
   */
  for (const entity of requested) {
    if (signal?.aborted) break

    results[entity] = await hydrateEntity({ entity, userId, signal, onProgress })

    /*
     * An expired session or a revoked permission will not fix itself for the
     * next entity, so the run stops rather than producing two more identical
     * failures.
     */
    const outcome = results[entity].result
    if (outcome === HYDRATION_RESULT.UNAUTHENTICATED || outcome === HYDRATION_RESULT.FORBIDDEN) {
      break
    }
  }

  const outcomes = Object.values(results).map((r) => r.result)
  const everyEntityCompleted =
    outcomes.length === requested.length && outcomes.every((r) => r === HYDRATION_RESULT.COMPLETED)

  await syncMetaRepository
    .set(META.LAST_STATUS, everyEntityCompleted ? 'ok' : 'failed', { userId })
    .catch(() => {})

  return {
    result: everyEntityCompleted
      ? HYDRATION_RESULT.COMPLETED
      : (outcomes.find((r) => r && r !== HYDRATION_RESULT.COMPLETED) ?? HYDRATION_RESULT.COMPLETED),
    startedAt,
    finishedAt: new Date().toISOString(),
    entities: results,
    written: Object.values(results).reduce((sum, r) => sum + r.written, 0),
  }
}

export default hydrate
