/**
 * Deciding where a read comes from.
 *
 * ## The rule, in one line
 *
 * The network is the source of truth whenever it can be reached; the cache
 * answers when it cannot, or when somebody deliberately asked it to.
 *
 * That ordering is not arbitrary. A cache that wins by default would show
 * yesterday's pipeline to a consultant with four bars of signal, and they would
 * have no way of knowing. So `AUTO` — the default — reaches for the network
 * first and falls back only on a genuine transport failure.
 *
 * ## Why `navigator.onLine` is a hint and not the decision
 *
 * `navigator.onLine === false` is trustworthy: the browser knows it has no
 * interface. `true` is nearly meaningless — it reports a link, not reachability,
 * and is `true` on a captive portal, behind a dead VPN, and on hotel wifi that
 * resolves DNS and nothing else. So it is used in one direction only: to skip a
 * request that certainly cannot succeed. A `true` reading still gets a real
 * attempt, and the attempt is what decides.
 *
 * ## Preference storage
 *
 * The explicit override lives in `localStorage`, per browser, because it is a
 * viewer convenience rather than account state — and because a preference that
 * needed the network to be read would be useless at the moment it matters. Every
 * access is guarded: `localStorage` throws outright in some privacy modes, and
 * a read-source preference is never worth breaking a page over.
 */

/** Where a read may come from. */
export const READ_SOURCE = Object.freeze({
  /** Network first, cache on failure. The default, and what ships enabled. */
  AUTO: 'auto',
  /** Network only. A failure is an error, never a silent stale answer. */
  ONLINE: 'online',
  /** Cache only. Useful for demonstrating offline behaviour on a live network. */
  LOCAL: 'local',
})

/** Which source actually served a result. Attached to every read. */
export const SERVED_BY = Object.freeze({
  ONLINE: 'online',
  LOCAL: 'local',
})

const STORAGE_KEY = 'xplore-crm:read-source'

/** Same-tab listeners. `storage` events only fire in *other* tabs. */
const listeners = new Set()

/**
 * Whether the browser is certain it has no network.
 *
 * Deliberately one-directional: see the note above on why `true` proves
 * nothing. In a non-browser context (the verification suite, SSR) this reports
 * online, so nothing silently takes the cache path in a test that meant to
 * exercise the network one.
 */
export function isDefinitelyOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

/** The stored preference, or `AUTO`. Never throws. */
export function getPreferredSource() {
  try {
    const stored = globalThis.localStorage?.getItem(STORAGE_KEY)
    return Object.values(READ_SOURCE).includes(stored) ? stored : READ_SOURCE.AUTO
  } catch {
    return READ_SOURCE.AUTO
  }
}

/**
 * Sets the preference and notifies this tab.
 *
 * @param {string} source One of `READ_SOURCE`.
 * @returns {string} The source now in force.
 */
export function setPreferredSource(source) {
  const next = Object.values(READ_SOURCE).includes(source) ? source : READ_SOURCE.AUTO

  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, next)
  } catch {
    /* Private mode, or storage disabled. The preference simply will not persist. */
  }

  for (const listener of listeners) {
    try { listener(next) } catch { /* one bad listener must not stop the rest */ }
  }

  return next
}

/** Subscribes to preference changes in this tab. Returns an unsubscribe. */
export function onPreferenceChange(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/**
 * The source a read should use right now.
 *
 * `AUTO` resolves to `LOCAL` only when the browser is certain there is no
 * network — otherwise to `ONLINE`, and `withLocalFallback` handles the case
 * where that turns out to be optimistic.
 *
 * @param {string} [preference] Defaults to the stored preference.
 * @returns {string} `READ_SOURCE.ONLINE` or `READ_SOURCE.LOCAL`.
 */
export function resolveSource(preference = getPreferredSource()) {
  if (preference === READ_SOURCE.LOCAL) return READ_SOURCE.LOCAL
  if (preference === READ_SOURCE.ONLINE) return READ_SOURCE.ONLINE
  return isDefinitelyOffline() ? READ_SOURCE.LOCAL : READ_SOURCE.ONLINE
}

/**
 * Whether this error means "the server was never reached".
 *
 * Only a transport failure justifies serving cached data. A 404, a 422 or a 500
 * are *answers* — the server was reached and said something, and quietly
 * replacing that with a stale local result would hide a real problem. `401` and
 * `403` are likewise answers, and the cache must not be used to paper over a
 * session that has ended.
 *
 * `httpClient` normalises a dropped connection and a timeout to
 * `isNetwork: true` with a null status, which is exactly the signal wanted.
 */
export function isTransportFailure(error) {
  if (!error) return false
  if (error.isCanceled) return false
  return error.isNetwork === true
}

export default {
  READ_SOURCE, SERVED_BY,
  isDefinitelyOffline, getPreferredSource, setPreferredSource,
  onPreferenceChange, resolveSource, isTransportFailure,
}
