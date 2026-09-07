/**
 * The four words the interface is allowed to say about connectivity.
 *
 * Phase 8 adds no state of its own. Every value below is derived from data the
 * Phase 7 coordinator and the existing read layer already publish, so there is
 * nothing here that can disagree with them — the derivation is a projection, not
 * a second opinion.
 *
 * ## Why "checking" exists
 *
 * `navigator.onLine` reports whether the device has *a* network, not whether
 * this server can be reached, and the two differ often enough to matter — a
 * captive portal is "online" and answers nothing. Rather than assert either way
 * before the first sync has resolved, the interface says it is checking. It is
 * the same honesty rule `ConnectionBadge` applies to mailbox status: an absent
 * answer is not a negative one.
 */

import { SYNC_STATE } from '@/offline/sync/coordinator'

/** What the indicator may display. */
export const CONNECTION_UX = Object.freeze({
  ONLINE: 'online',
  OFFLINE: 'offline',
  CHECKING: 'checking',
  SYNCING: 'syncing',
})

/** Copy, in one place, so the indicator and the banner cannot drift apart. */
export const CONNECTION_LABEL = Object.freeze({
  [CONNECTION_UX.ONLINE]: 'Online',
  [CONNECTION_UX.OFFLINE]: 'Offline',
  [CONNECTION_UX.CHECKING]: 'Checking connection…',
  [CONNECTION_UX.SYNCING]: 'Syncing…',
})

/** The longer form, for the banner and for screen readers. */
export const CONNECTION_DETAIL = Object.freeze({
  [CONNECTION_UX.ONLINE]: 'Connected to the CRM.',
  [CONNECTION_UX.OFFLINE]: 'Offline — changes will sync when you’re back online.',
  [CONNECTION_UX.CHECKING]: 'Checking the connection to the CRM.',
  [CONNECTION_UX.SYNCING]: 'Syncing your changes with the CRM.',
})

/**
 * Projects the coordinator's state and the browser's onLine flag into one word.
 *
 * Order matters and is deliberate:
 *
 *  1. **Syncing wins over everything.** It is the most specific thing that can
 *     be true, and a user watching a spinner wants to know work is happening
 *     more than they want to be told they are online.
 *  2. **The browser's "offline" is trusted.** `navigator.onLine === false` is
 *     reliable in the negative direction: the device genuinely has no network.
 *     The positive direction is the unreliable one, which is why it does not
 *     short-circuit to ONLINE below.
 *  3. **The coordinator's OFFLINE outranks a hopeful onLine flag.** The
 *     coordinator learned it by actually failing to reach the server, which is
 *     better evidence than the browser's guess.
 *
 * @param {object}  params
 * @param {boolean} params.isOffline    From the existing read layer.
 * @param {?string} params.syncStatus   A `SYNC_STATE` value.
 * @param {boolean} params.hasSynced    Whether a sync has ever succeeded.
 * @returns {string} A `CONNECTION_UX` value.
 */
export function deriveConnectionUx({ isOffline, syncStatus, hasSynced = true }) {
  if (syncStatus === SYNC_STATE.SYNCING) return CONNECTION_UX.SYNCING
  if (isOffline) return CONNECTION_UX.OFFLINE
  if (syncStatus === SYNC_STATE.OFFLINE) return CONNECTION_UX.OFFLINE

  /*
   * Online according to the browser, but nothing has confirmed the server yet.
   * Reported as checking rather than online, so the indicator never claims a
   * connection the application has not actually made.
   */
  if (!hasSynced && !syncStatus) return CONNECTION_UX.CHECKING

  return CONNECTION_UX.ONLINE
}

/**
 * How an entity's local data should be described when the list is empty.
 *
 * The distinction Phase 8 exists to make: an empty table means one of two very
 * different things, and rendering both as "No leads found" tells a consultant
 * the CRM is empty when in fact their device has never downloaded it.
 *
 * Derived entirely from metadata the sync layer already writes — `lastPull:
 * <entity>` and `lastStatus` — so no new bookkeeping is introduced and no count
 * is fabricated.
 *
 * @param {object}  params
 * @param {?string} params.lastPull   ISO time of the last successful pull, or null.
 * @param {?string} params.lastStatus 'ok' | 'failed' | 'never' | null.
 * @returns {'downloaded'|'never-downloaded'|'unknown'}
 *   `downloaded` — the entity was fetched and is genuinely empty.
 *   `never-downloaded` — nothing has ever arrived; an empty list means nothing.
 *   `unknown` — metadata unreadable; the caller keeps its existing wording.
 */
export function deriveHydrationState({ lastPull, lastStatus }) {
  // A successful pull is the only thing that licenses "there are zero records".
  if (lastPull) return 'downloaded'

  // Explicitly never attempted, or attempted and never succeeded.
  if (lastStatus === 'never' || lastStatus === 'failed' || lastStatus == null) {
    return 'never-downloaded'
  }

  /*
   * `lastStatus === 'ok'` with no `lastPull` should not happen — the pull writes
   * both. Rather than guess which half is right, say so and let the caller fall
   * back to its existing message.
   */
  return 'unknown'
}

/**
 * "Last synced" in words, from the existing `lastSuccessfulSyncAt`.
 *
 * Returns null when there has never been a successful sync, so the caller
 * renders "Not synced yet" rather than a timestamp that would be a fiction.
 *
 * @param {?string} isoTime
 * @param {number}  [now]
 * @returns {?string}
 */
export function describeLastSync(isoTime, now = Date.now()) {
  if (!isoTime) return null

  const then = new Date(isoTime).getTime()
  if (Number.isNaN(then)) return null

  const seconds = Math.round((now - then) / 1000)

  // A clock skew or a sync that finished microseconds ago both land here. "Just
  // now" is true for both and is better than a negative duration.
  if (seconds < 45) return 'Just now'

  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`

  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`

  const days = Math.round(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

export default deriveConnectionUx
