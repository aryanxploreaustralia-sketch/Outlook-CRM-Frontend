/**
 * Deciding what a pulled server record may do to a local one.
 *
 * ## The hazard this exists to remove
 *
 * Hydration writes a page with `putMany(records, { status: SYNCED })`, which
 * replaces the stored row wholesale. That is right for a record nobody has
 * touched locally, and wrong for one carrying an unsynced change: the user's
 * edit would vanish from the register the moment a background pull ran, while
 * its queue entry sat there still claiming it was pending. The mutation would
 * not be *lost* — it would eventually be sent — but for the interval in between
 * the interface would be lying about what the user had typed.
 *
 * Worse, a record the server had changed underneath would be adopted silently
 * and the queued edit would then be pushed on top of it, which is precisely the
 * stale overwrite Phase 6's version check exists to prevent.
 *
 * So a pull is filtered through here first. Records with nothing queued take
 * the fast path unchanged. Records with something queued are **not overwritten**
 * — the server's version is recorded as metadata, and if it has moved past what
 * the queued mutation was based on, that mutation becomes a conflict.
 *
 * ## What this never does
 *
 * It does not merge, does not choose a winner, and does not re-classify a
 * mutation that is `processing` (in flight, and the processor's business) or
 * `completed` (history). It raises a conflict only against a `pending` entry —
 * one already `failed` or `conflict` keeps the status it earned.
 */

import { META_KEY, OPERATION, QUEUE_STATUS, STORE } from '@/offline/db/schema.js'
import { openDatabase } from '@/offline/db/database.js'
import { metaOf } from '@/offline/repositories/recordRepository.js'

/**
 * The queue entries that make a record's local copy authoritative for now.
 *
 * All three mean the same thing from the user's point of view: there is
 * something here the server has not accepted, and it is still theirs.
 *
 *  - `pending`  — waiting to be sent, or skipped this round.
 *  - `conflict` — refused because the record moved; a person must settle it.
 *  - `failed`   — refused on its merits (403, 422). The change will never be
 *    sent unless somebody corrects it, so overwriting the local copy would
 *    quietly erase work the user can still see and still fix. This one is easy
 *    to miss precisely because the mutation is "finished".
 *
 * `processing` is excluded on purpose: it is in flight and belongs to the
 * processor, which reconciles it itself. `completed` is history.
 */
const GUARDING = new Set([QUEUE_STATUS.PENDING, QUEUE_STATUS.CONFLICT, QUEUE_STATUS.FAILED])

/**
 * Splits a pulled page into records that may be written and records that must
 * not be, and marks conflicts among the latter.
 *
 * @param {object} params
 * @param {string} params.entity
 * @param {object[]} params.records  The page, exactly as the server sent it.
 * @param {string} params.userId
 * @returns {Promise<{ writable: object[], guarded: number, conflicts: number }>}
 */
export async function partitionPulledRecords({ entity, records, userId }) {
  if (!Array.isArray(records) || records.length === 0) {
    return { writable: [], guarded: 0, conflicts: 0 }
  }

  const db = await openDatabase(userId)
  const queue = await db.getAll(STORE.SYNC_QUEUE)

  /*
   * Only entries that guard a record, indexed by the id they point at. A
   * pending CREATE points at a `local_…` id the server cannot have sent, so it
   * can never match here — which is correct: nothing on the server corresponds
   * to it yet.
   */
  const guardsById = new Map()
  for (const entry of queue) {
    if (entry.entity !== entity) continue
    if (!GUARDING.has(entry.status)) continue
    guardsById.set(String(entry.recordId), entry)
  }

  if (guardsById.size === 0) {
    return { writable: records, guarded: 0, conflicts: 0 }
  }

  const writable = []
  const guardedEntries = []

  for (const record of records) {
    const guard = guardsById.get(String(record.id))
    if (guard) guardedEntries.push({ record, guard })
    else writable.push(record)
  }

  if (guardedEntries.length === 0) {
    return { writable, guarded: 0, conflicts: 0 }
  }

  const conflicts = await markGuarded({ entity, guardedEntries, userId })
  return { writable, guarded: guardedEntries.length, conflicts }
}

/**
 * Records the server's version against a guarded record, and raises a conflict
 * when the server has moved past what the queued mutation assumed.
 *
 * The record's **business fields are left exactly as the user left them.** Only
 * the `_sync` envelope changes, which is the whole point of that envelope
 * existing separately from the record.
 */
async function markGuarded({ entity, guardedEntries, userId }) {
  const storeName = { leads: STORE.LEADS, contacts: STORE.CONTACTS, companies: STORE.COMPANIES }[entity]
  const db = await openDatabase(userId)
  const transaction = db.transaction([storeName, STORE.SYNC_QUEUE], 'readwrite')
  const records = transaction.objectStore(storeName)
  const queue = transaction.objectStore(STORE.SYNC_QUEUE)

  let conflicts = 0

  for (const { record, guard } of guardedEntries) {
    const stored = await records.get(String(record.id))
    const serverUpdatedAt = record.updatedAt ?? null

    if (stored) {
      // The server's version, remembered without adopting the server's values.
      await records.put({
        ...stored,
        [META_KEY]: { ...metaOf(stored), serverUpdatedAt },
      })
    }

    if (guard.status !== QUEUE_STATUS.PENDING) continue

    /*
     * Has the server moved since the user's change was written?
     *
     * A CREATE has no base version and cannot be judged this way — but it also
     * cannot appear here, because its id is local. For an UPDATE or a DELETE,
     * a base that no longer matches the server means somebody else edited the
     * record while this user was offline.
     *
     * Detected here rather than left for the push because acting early is what
     * stops the mutation being sent at all — and a conflict the user can see
     * before it is attempted is better than one reported afterwards.
     */
    const base = guard.baseUpdatedAt ?? null
    if (!base || !serverUpdatedAt) continue
    if (new Date(base).getTime() === new Date(serverUpdatedAt).getTime()) continue

    await queue.put({
      ...guard,
      status: QUEUE_STATUS.CONFLICT,
      lastError: 'The record changed on the server while this change was queued.',
      conflict: {
        detectedAt: new Date().toISOString(),
        conflictType: 'staleVersion',
        detectedBy: 'pull',
        entity,
        id: String(record.id),
        baseUpdatedAt: base,
        serverUpdatedAt,
        serverDeleted: record.isDeleted === true,
        operation: guard.operation === OPERATION.DELETE ? 'DELETE' : 'UPDATE',
      },
    })
    conflicts += 1
  }

  await transaction.done
  return conflicts
}

export default { partitionPulledRecords }
