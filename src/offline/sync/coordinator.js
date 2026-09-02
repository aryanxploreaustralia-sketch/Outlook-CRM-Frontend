/**
 * The one thing that decides when the CRM synchronises, and in what order.
 *
 * Before this existed there were two independent triggers: hydration ran once
 * per session from its own hook, and the queue drained from another on its own
 * `online` listener. Nothing stopped them overlapping, and overlapping is
 * exactly when the interesting failures happen — a pull writing a record while
 * a push is reconciling it. This replaces both triggers with a single
 * serialised run.
 *
 * ## Order: drain, then pull. Deliberately.
 *
 * Both orders were reasoned through:
 *
 * **Pull first** would fetch the server's version of a record the user has
 * edited offline, and hydration writes what it fetches. The local edit would be
 * overwritten in the cache before it had ever been sent — the mutation would
 * survive in the queue, but the register would show the server's values and the
 * user's typing would appear to have been discarded. It also masks conflicts:
 * adopting the server version updates the local copy, and the queued edit is
 * then pushed on top of data it was never written against.
 *
 * **Drain first** sends what the user did, gets it accepted or refused on its
 * own terms, and only then asks the server what the world now looks like. A
 * mutation that is accepted comes back in the pull as the server's own record;
 * one that is refused becomes a conflict *before* anything overwrites it.
 *
 * So: drain, then pull. `reconcile.js` covers the remaining case — a pull that
 * lands on a record whose mutation could not be drained (offline mid-run, or
 * already conflicted) — by refusing to overwrite it.
 *
 * ## What it will not do
 *
 * It does not resolve conflicts, retry a conflict, reset a cursor, or clear
 * local data on an authentication failure. Every one of those would destroy
 * information that only a person can supply.
 */

import { QUEUE_STATUS, STORE } from '@/offline/db/schema.js'
import { META, metaKey, syncMetaRepository } from '@/offline/repositories/syncMetaRepository.js'
import { openDatabase, isAvailable } from '@/offline/db/database.js'
import { DRAIN_RESULT, drain } from '@/offline/write/processor.js'
import { HYDRATION_RESULT, hydrate } from '@/offline/sync/hydrate.js'

/** What the application may observe about synchronisation. */
export const SYNC_STATE = Object.freeze({
  IDLE: 'idle',
  SYNCING: 'syncing',
  OFFLINE: 'offline',
  PARTIAL: 'partial',
  ERROR: 'error',
  CONFLICT: 'conflict',
  UNAUTHENTICATED: 'unauthenticated',
})

/** Persisted, non-sensitive, and never a credential. */
export const SYNC_META = Object.freeze({
  LAST_SYNC_AT: 'lastSyncAt',
  LAST_SUCCESS_AT: 'lastSuccessfulSyncAt',
  LAST_ERROR: 'lastSyncError',
})

/** Backoff schedule for temporary failures. Bounded, and it stops growing. */
export const BACKOFF_MS = Object.freeze([5_000, 15_000, 60_000, 300_000, 900_000])

/**
 * How long a `processing` entry may sit before it is presumed abandoned.
 *
 * Long on purpose. A shorter window risks resetting an entry another tab is
 * actively sending, which would push the same mutation twice — survivable,
 * because the server's idempotency key makes a duplicate push harmless, but
 * still worth not doing. Fifteen minutes is far longer than any request and far
 * shorter than "stuck forever", which is the state this exists to prevent.
 */
export const STALE_PROCESSING_MS = 15 * 60 * 1000

/** The single lock. One synchronisation per tab, whatever asked for it. */
let running = false

/** Backoff bookkeeping, kept in memory so a reload starts willing to try. */
let consecutiveFailures = 0
let nextAttemptAt = 0

/** Observers of the state, so the UI does not poll. */
const listeners = new Set()
let state = { status: SYNC_STATE.IDLE, at: null, reason: null, error: null }

function publish(next) {
  state = { ...state, ...next }
  for (const listener of listeners) {
    try { listener(state) } catch { /* one bad listener must not stop the rest */ }
  }
}

/** Subscribes to sync state. Returns an unsubscribe. */
export function onSyncState(listener) {
  listeners.add(listener)
  listener(state)
  return () => listeners.delete(listener)
}

export const getSyncState = () => state
export const isSyncing = () => running

/**
 * Returns entries abandoned mid-flight to `pending`.
 *
 * A tab closed while a mutation was in flight leaves it `processing` forever:
 * the drain only picks up `pending`, so without this the mutation would never
 * be retried and never be visible as a failure. The staleness window is what
 * keeps this from stealing work another tab is doing right now.
 *
 * `retryCount` is **not** incremented — the attempt may well have succeeded on
 * the server, and the idempotency key means a repeat is safe. Charging it a
 * failed attempt would eat the retry budget for something that never failed.
 */
export async function recoverStaleProcessing({ userId, now = Date.now() } = {}) {
  const db = await openDatabase(userId)
  const entries = await db.getAll(STORE.SYNC_QUEUE)

  const stale = entries.filter((entry) => {
    if (entry.status !== QUEUE_STATUS.PROCESSING) return false
    const at = entry.lastAttemptAt ? new Date(entry.lastAttemptAt).getTime() : 0
    return now - at > STALE_PROCESSING_MS
  })

  if (stale.length === 0) return 0

  const transaction = db.transaction(STORE.SYNC_QUEUE, 'readwrite')
  await Promise.all(stale.map((entry) => transaction.store.put({
    ...entry,
    status: QUEUE_STATUS.PENDING,
    lastError: 'Recovered after the previous attempt was interrupted.',
  })))
  await transaction.done

  return stale.length
}

/** Counts the queue by status. */
async function queueCounts(userId) {
  try {
    const db = await openDatabase(userId)
    const entries = await db.getAll(STORE.SYNC_QUEUE)
    return {
      pending: entries.filter((e) => e.status === QUEUE_STATUS.PENDING).length,
      failed: entries.filter((e) => e.status === QUEUE_STATUS.FAILED).length,
      conflict: entries.filter((e) => e.status === QUEUE_STATUS.CONFLICT).length,
      processing: entries.filter((e) => e.status === QUEUE_STATUS.PROCESSING).length,
    }
  } catch {
    return { pending: 0, failed: 0, conflict: 0, processing: 0 }
  }
}

const write = async (key, value, userId) => {
  try { await syncMetaRepository.set(metaKey(key), value, { userId }) } catch { /* metadata only */ }
}

/** Whether the browser is certain there is no network. A hint, in one direction. */
const definitelyOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false

/**
 * Runs one synchronisation.
 *
 * @param {object} params
 * @param {object} params.user     From `useAuth`. Needs `id`.
 * @param {string} [params.reason] For diagnostics: 'startup' | 'online' | 'visible' | 'manual'.
 * @param {boolean} [params.force] Ignore the backoff window. Manual only.
 * @param {?AbortSignal} [params.signal]
 * @returns {Promise<object>} A summary. Never throws.
 */
export async function runSync({ user, reason = 'manual', force = false, signal = null } = {}) {
  const userId = user?.id ? String(user.id) : null

  if (!userId) return { ran: false, status: SYNC_STATE.UNAUTHENTICATED, reason }
  if (!isAvailable()) return { ran: false, status: SYNC_STATE.ERROR, reason, error: 'IndexedDB unavailable' }

  // One at a time. A second caller is told so rather than queued behind the first.
  if (running) return { ran: false, status: SYNC_STATE.SYNCING, reason, busy: true }

  /*
   * The backoff window. A manual request ignores it — somebody watching the
   * screen and pressing the button has better information than the schedule.
   */
  if (!force && Date.now() < nextAttemptAt) {
    return { ran: false, status: state.status, reason, deferred: true, retryAt: nextAttemptAt }
  }

  // A request that certainly cannot reach the server is not worth making.
  if (!force && definitelyOffline()) {
    publish({ status: SYNC_STATE.OFFLINE, at: new Date().toISOString(), reason })
    return { ran: false, status: SYNC_STATE.OFFLINE, reason }
  }

  running = true
  publish({ status: SYNC_STATE.SYNCING, at: new Date().toISOString(), reason, error: null })

  const summary = { ran: true, reason, recovered: 0, push: null, pull: null }

  try {
    await write(SYNC_META.LAST_SYNC_AT, new Date().toISOString(), userId)

    // --- 0. rescue anything a previous run abandoned ----------------------
    summary.recovered = await recoverStaleProcessing({ userId })

    // --- 1. push: the user's own work goes first --------------------------
    summary.push = await drain({ userId, signal })

    /*
     * A push that stopped because the network or the session failed makes the
     * pull pointless: it would fail the same way, and a second failure adds
     * nothing but a request. The queue is untouched and the run backs off.
     */
    if (summary.push.result === DRAIN_RESULT.OFFLINE) {
      return finish(summary, SYNC_STATE.OFFLINE, userId, 'The server could not be reached.')
    }
    if (summary.push.result === DRAIN_RESULT.UNAUTHENTICATED) {
      return finish(summary, SYNC_STATE.UNAUTHENTICATED, userId, 'The session has expired.')
    }

    // --- 2. pull: what the world looks like now ---------------------------
    summary.pull = await hydrate({ user, signal })

    const entities = Object.values(summary.pull.entities ?? {})
    const failedEntities = entities.filter((e) => e.result !== HYDRATION_RESULT.COMPLETED)

    if (summary.pull.result === HYDRATION_RESULT.UNAUTHENTICATED) {
      return finish(summary, SYNC_STATE.UNAUTHENTICATED, userId, 'The session has expired.')
    }
    if (summary.pull.result === HYDRATION_RESULT.OFFLINE) {
      return finish(summary, SYNC_STATE.OFFLINE, userId, 'The server could not be reached.')
    }

    const counts = await queueCounts(userId)

    /*
     * A conflict is reported as such even when everything else went perfectly.
     * It is the one outcome that needs a person, so it must not be hidden
     * behind a green "synced".
     */
    if (counts.conflict > 0) {
      return finish(summary, SYNC_STATE.CONFLICT, userId, null, { success: true })
    }

    /*
     * Partial: some entities landed and some did not. The ones that landed keep
     * their cursors — `hydrate` persists per entity, after its own writes — so
     * the next run resumes only what is behind rather than starting over.
     */
    if (failedEntities.length > 0) {
      return finish(summary, SYNC_STATE.PARTIAL, userId,
        `${failedEntities.length} of ${entities.length} entities did not complete.`)
    }

    return finish(summary, SYNC_STATE.IDLE, userId, null, { success: true })
  } catch (error) {
    // `drain` and `hydrate` both resolve rather than reject, so this is a
    // genuine surprise. Recorded, never swallowed silently.
    return finish(summary, SYNC_STATE.ERROR, userId, String(error?.message ?? error))
  } finally {
    running = false
  }
}

/** Records the outcome, sets the backoff, and publishes the state. */
function finish(summary, status, userId, error, { success = false } = {}) {
  const at = new Date().toISOString()

  if (success) {
    consecutiveFailures = 0
    nextAttemptAt = 0
    write(SYNC_META.LAST_SUCCESS_AT, at, userId)
    write(SYNC_META.LAST_ERROR, null, userId)
  } else {
    /*
     * Bounded exponential backoff, and it stops at the last step rather than
     * growing without limit. A conflict is not a failure of the connection, so
     * it does not back anything off — it is reported and the schedule stays as
     * it was.
     */
    consecutiveFailures += 1
    const index = Math.min(consecutiveFailures - 1, BACKOFF_MS.length - 1)
    nextAttemptAt = Date.now() + BACKOFF_MS[index]
    if (error) write(SYNC_META.LAST_ERROR, { at, message: error }, userId)
  }

  publish({ status, at, error: error ?? null })
  return { ...summary, status, error: error ?? null, retryAt: nextAttemptAt || null }
}

/** Test seam: forget the backoff schedule and the lock. */
export function resetCoordinator() {
  running = false
  consecutiveFailures = 0
  nextAttemptAt = 0
  state = { status: SYNC_STATE.IDLE, at: null, reason: null, error: null }
}

/** When the next automatic attempt may run. 0 means "now". */
export const nextAttempt = () => nextAttemptAt

export { queueCounts }

export default {
  runSync, onSyncState, getSyncState, isSyncing, recoverStaleProcessing,
  resetCoordinator, nextAttempt, queueCounts,
  SYNC_STATE, SYNC_META, BACKOFF_MS, STALE_PROCESSING_MS,
}
