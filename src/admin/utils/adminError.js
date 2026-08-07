/**
 * Error interpretation for the admin module.
 *
 * Kept out of `AdminErrorState.jsx` because a file exporting both a component
 * and a function defeats Fast Refresh — the same reason `@/utils/apiError`
 * exists apart from `ErrorScreen`, which that file documents.
 */

import { resolveErrorVariant } from '@/utils/apiError'

/**
 * Maps a normalised API error to an `ErrorScreen` variant.
 *
 * Extends `resolveErrorVariant` rather than replacing it. The shared helper
 * covers 401, 403 and network failure, which is what the CRM pages need; two
 * more matter here and are handled without widening a util nine CRM pages
 * depend on:
 *
 *  - **404** — an admin endpoint the server does not recognise. A real state
 *    during a partial rollout, and it reads very differently from "the server
 *    broke": the fix is deploying the API, not retrying.
 *  - **429** — the admin read limiter. A screen left polling hits it, and
 *    "wait a moment" is the correct advice where "try again" is not.
 *
 * Order matters: a network failure carries no HTTP status at all, so the status
 * comparisons here run before delegating, and `resolveErrorVariant` tests
 * `isNetwork` before its own.
 *
 * @param {?{ status?: ?number, code?: string, isNetwork?: boolean }} error
 * @returns {'unauthorized'|'sessionExpired'|'forbidden'|'serverError'|'networkError'|'noData'|'notFound'|'rateLimited'}
 */
export function resolveAdminErrorVariant(error) {
  if (error?.isNetwork) return 'networkError'
  if (error?.status === 404) return 'notFound'
  if (error?.status === 429) return 'rateLimited'

  return resolveErrorVariant(error)
}

export default resolveAdminErrorVariant
