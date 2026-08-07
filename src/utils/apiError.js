/**
 * Helpers for interpreting normalised API errors.
 *
 * `httpClient` normalises every failure to `{ message, status, code, details,
 * isNetwork }`. These helpers turn that into UI decisions, in one place, so every
 * page reacts to a 401 or a network failure identically.
 *
 * Kept out of the component files so those export only components and Fast
 * Refresh keeps working.
 */

/**
 * @typedef {'unauthorized'|'sessionExpired'|'serverError'|'networkError'|'noData'|'forbidden'} ErrorVariant
 */

/**
 * True when a rejection is an aborted request rather than a failure.
 *
 * ## Why this has to live here
 *
 * `httpClient` rejects with a **plain normalised object**, not an Error — so the
 * rejected value has no `name` and is not an instance of anything. Guards
 * written as `error.name !== 'CanceledError'` therefore read `undefined`,
 * conclude the request genuinely failed, and show the user
 * "Request was cancelled." That is exactly what happened on the campaign
 * wizard: React re-runs an effect on mount, the cleanup aborts the first
 * in-flight batch, and the abort was rendered as an error banner.
 *
 * `isCanceled` is the flag the interceptor actually sets. The Axios-native
 * shapes are still accepted so this stays correct for any call that bypasses
 * the interceptor, and `signal.aborted` can be passed by callers that hold the
 * controller.
 *
 * @param {unknown} error
 * @returns {boolean}
 */
export function isCancelledError(error) {
  return (
    error?.isCanceled === true ||
    error?.code === 'ERR_CANCELED' ||
    error?.code === 'CANCELED' ||
    error?.name === 'CanceledError' ||
    error?.name === 'AbortError'
  )
}

/**
 * Maps a normalised error to an `ErrorScreen` variant.
 *
 * The order matters: a network failure has no HTTP status at all, so it must be
 * checked before any status comparison.
 *
 * @param {?{ status?: ?number, code?: string, isNetwork?: boolean }} error
 * @returns {ErrorVariant}
 */
export function resolveErrorVariant(error) {
  if (!error) return 'serverError'
  if (error.isNetwork) return 'networkError'
  if (error.status === 401) return 'sessionExpired'
  if (error.status === 403) return 'forbidden'
  return 'serverError'
}

/**
 * True when an error means the caller's session is no longer valid.
 *
 * Used to decide whether to re-check authentication rather than simply showing a
 * generic failure.
 *
 * @param {?{ status?: ?number }} error
 * @returns {boolean}
 */
export function isAuthenticationError(error) {
  return error?.status === 401
}

export default { resolveErrorVariant, isAuthenticationError, isCancelledError }
