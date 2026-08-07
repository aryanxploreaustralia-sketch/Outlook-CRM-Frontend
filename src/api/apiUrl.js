/**
 * The only place an API URL is assembled.
 *
 * Three separate patterns used to do this job, each written where it was
 * needed:
 *
 *   new URL(`${env.apiBaseUrl}${path}`, window.location.origin)   // sign-in
 *   `${httpClient.defaults.baseURL ?? ''}${path}`                 // downloads
 *   httpClient.get(path)                                          // everything else
 *
 * They agreed only by coincidence. The first two are template literals, so a
 * base with a trailing slash or a path without a leading one produced a
 * malformed URL that no type or test would catch, and reading
 * `httpClient.defaults.baseURL` made the Axios instance the de-facto owner of a
 * value it merely consumes.
 *
 * Now there is one join, one owner, and one representation. `env.apiBaseUrl` is
 * already normalised by `@/config/apiBaseUrl`; this module's only remaining job
 * is to attach a path and query string to it without introducing or losing a
 * slash.
 */

import { env } from '@/config/env'

/**
 * The canonical base, re-exported so consumers import it from the API layer
 * rather than reaching into config. Configure it via `VITE_API_BASE_URL`.
 */
export const API_BASE_URL = env.apiBaseUrl

/**
 * Endpoint paths must not repeat what the base already carries.
 *
 * The registry owns `/v1/...`; the base owns the origin and `/api`. An endpoint
 * written as `/api/v1/...` would sail through the concatenation below and
 * request `/api/api/v1/...`. Rather than trust the convention, the prefix is
 * stripped if it appears — and said out loud, because the registry is then
 * wrong and should be corrected at source.
 */
const reportedDuplicates = new Set()

/**
 * Reduces an endpoint path to the part the registry is allowed to own.
 *
 * Exported because `httpClient` needs it too: requests made through Axios join
 * `baseURL` themselves and so never pass through `apiPath` below, yet they are
 * the majority of calls and must be guarded the same way.
 *
 * @param {string} path Endpoint path from `@/api/endpoints`.
 * @returns {string}
 */
export function toEndpointPath(path) {
  const prefix = env.apiPrefix
  if (typeof path !== 'string' || !prefix || !path.startsWith(prefix)) return path

  const remainder = path.slice(prefix.length)
  // "/apiary/..." starts with "/api" as a string but not as a path segment.
  if (remainder !== '' && !remainder.startsWith('/')) return path

  if (!reportedDuplicates.has(path)) {
    reportedDuplicates.add(path)
    console.warn(
      `[api] The endpoint "${path}" begins with the API prefix "${prefix}", which ` +
        `the base URL already supplies. Requesting "${remainder}" instead. Remove ` +
        'the prefix from src/api/endpoints.js — endpoint paths start at the version.',
    )
  }

  return remainder
}

/**
 * Joins an endpoint path onto the base with exactly one separating slash.
 *
 * @param {string} [path]
 * @returns {string}
 */
export function apiPath(path = '') {
  const endpoint = toEndpointPath(String(path ?? '').trim())
  if (endpoint === '') return API_BASE_URL

  return `${API_BASE_URL.replace(/\/+$/, '')}/${endpoint.replace(/^\/+/, '')}`
}

/**
 * Builds a complete, absolute URL for an endpoint.
 *
 * Absolute rather than relative because the two callers that need a *string*
 * both hand it to the browser — `window.location.assign` for the OAuth
 * navigations, and an anchor's `href` for downloads. Both accept a relative
 * URL, but resolving it here means the value is identical whether the API is
 * on this origin or another one, which is precisely the difference that broke
 * production.
 *
 * Requests made through `httpClient` do **not** come this way: Axios applies
 * `API_BASE_URL` as its `baseURL`, so services pass the bare endpoint path.
 *
 * @param {string} path Endpoint path from `@/api/endpoints`.
 * @param {Record<string, unknown>} [params]
 *   Query parameters. Entries that are `null`, `undefined` or `''` are dropped,
 *   which is what every call site did by hand.
 * @returns {string}
 */
export function apiUrl(path, params) {
  const url = new URL(apiPath(path), globalThis.location?.origin ?? 'http://localhost')

  for (const [key, value] of Object.entries(params ?? {})) {
    if (value === null || value === undefined || value === '') continue
    url.searchParams.set(key, String(value))
  }

  return url.toString()
}

export default apiUrl
