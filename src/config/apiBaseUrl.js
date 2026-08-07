/**
 * Resolution of the one URL every API request is built from.
 *
 * ## Why this module exists
 *
 * The address of an endpoint is assembled from three independently-owned parts:
 *
 *   origin      https://crmbackend.xploreaustralia.com   deployment (env var)
 *   prefix      /api                                     server's API_PREFIX
 *   endpoint    /v1/auth/status                          `@/api/endpoints`
 *
 * Before this module, `VITE_API_BASE_URL` was read and used verbatim, so the
 * split between "origin + prefix" and "endpoint" was a convention rather than a
 * rule. An operator pointing the build at the API had no way to know which
 * parts were already accounted for, and every wrong guess produced a different
 * broken URL:
 *
 *   https://api.example.com                → /v1/auth/status         (no prefix)
 *   https://api.example.com/api/v1         → /api/v1/v1/auth/status  (doubled)
 *   https://api.example.com/api/v1/auth/status
 *                                          → /api/v1/auth/status/v1/auth/status
 *
 * All three are the *same* mistake — including more of the path than the base
 * owns — and all three are silent, because a concatenation cannot fail.
 *
 * So the base is no longer trusted: it is reduced to the part it is allowed to
 * contribute. Everything from the version segment onwards belongs to the
 * endpoint registry and is discarded here; the prefix is then guaranteed to be
 * present exactly once. The function is idempotent, which is the property that
 * matters — feeding it its own output, or any of the four spellings above,
 * yields the same base.
 *
 * Kept free of `import.meta.env` and of every other import so it is a pure
 * function of its arguments: `@/config/env` decides what to feed it, and this
 * file decides what that means.
 */

/**
 * A path segment that names an API version, e.g. `v1`.
 *
 * The marker for "the endpoint registry owns everything from here on". Matched
 * as a whole segment so a host path like `/v1beta-docs` is left alone.
 */
const VERSION_SEGMENT = /^v\d+$/i

/** Recognises a base that already carries its own scheme. */
const ABSOLUTE_URL = /^[a-z][a-z\d+\-.]*:\/\//i

/**
 * Splits a path into segments, discarding the empties that leading, trailing
 * and doubled slashes produce. `//api//v1/` and `/api/v1` both become
 * `['api', 'v1']`, so the rest of this module never has to think about slashes.
 *
 * @param {string} path
 * @returns {string[]}
 */
function toSegments(path) {
  return String(path ?? '')
    .split('/')
    .filter(Boolean)
}

/**
 * Renders segments back to a path with exactly one leading slash and no
 * trailing one. An empty list becomes `''` rather than `'/'`, so it can be
 * concatenated onto an origin without leaving a dangling slash.
 *
 * @param {string[]} segments
 * @returns {string}
 */
function toPath(segments) {
  return segments.length > 0 ? `/${segments.join('/')}` : ''
}

/**
 * Normalises the server's API prefix.
 *
 * Accepts `api`, `/api`, `/api/` or an empty value (a server mounting its
 * routes at the root). Returns `''` or a path with one leading slash.
 *
 * @param {string} [raw]
 * @returns {string}
 */
export function normaliseApiPrefix(raw) {
  return toPath(toSegments(raw))
}

/**
 * Reduces a configured base URL to the part it is allowed to own.
 *
 * @param {string} [rawBase]
 *   `VITE_API_BASE_URL`. An origin, optionally with a path. Empty means
 *   same-origin, which is what the dev-server proxy and a reverse-proxy
 *   deployment both want.
 * @param {string} [rawPrefix]
 *   `VITE_API_PREFIX`, matching the server's `API_PREFIX`. The default is
 *   applied by the caller in `@/config/env`; an absent value here means a
 *   server that mounts its routes at the root.
 * @returns {{ baseUrl: string, origin: string, prefix: string, notes: string[] }}
 *   `baseUrl` is what Axios and every URL builder use. `notes` records only the
 *   repairs that indicate a misconfiguration, for the startup log — a silently
 *   repaired configuration is how the original fault survived a deployment.
 *   Adding the prefix to an origin-only base is normal and is not recorded.
 */
export function resolveApiBaseUrl(rawBase, rawPrefix) {
  const notes = []
  const prefix = normaliseApiPrefix(rawPrefix)
  const prefixSegments = toSegments(prefix)

  const base = String(rawBase ?? '').trim()

  let origin = ''
  let pathSegments = []

  if (base === '' || base === '/') {
    // Same-origin. The browser resolves the result against the page, which is
    // what a reverse proxy in front of both apps expects.
    origin = ''
  } else if (ABSOLUTE_URL.test(base)) {
    let parsed
    try {
      parsed = new URL(base)
    } catch {
      throw new Error(
        `[config] VITE_API_BASE_URL is not a valid URL: "${base}". ` +
          'Expected an origin such as "https://crmbackend.xploreaustralia.com".',
      )
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error(
        `[config] VITE_API_BASE_URL must use http or https, received "${parsed.protocol}//".`,
      )
    }

    origin = parsed.origin
    pathSegments = toSegments(parsed.pathname)

    if (parsed.search || parsed.hash) {
      notes.push('dropped the query string and fragment — a base URL carries neither')
    }
  } else if (base.startsWith('/')) {
    // A root-relative base such as "/api". Same-origin with a path.
    pathSegments = toSegments(base)
  } else {
    // A bare host: "crmbackend.xploreaustralia.com". Recoverable, and the
    // alternative is a request to a *relative path* named after the host,
    // which 404s in a way that looks nothing like its cause.
    const parsed = new URL(`https://${base}`)
    origin = parsed.origin
    pathSegments = toSegments(parsed.pathname)
    notes.push(`no scheme given — assuming https, so the base is "${origin}"`)
  }

  // Everything from the version segment onwards is the endpoint registry's to
  // contribute. This is the single rule that makes "/api/v1", "/api/v1/auth" and
  // "/api/v1/auth/status" all collapse back to "/api".
  const versionAt = pathSegments.findIndex((segment) => VERSION_SEGMENT.test(segment))
  if (versionAt !== -1) {
    const discarded = toPath(pathSegments.slice(versionAt))
    pathSegments = pathSegments.slice(0, versionAt)
    notes.push(
      `removed "${discarded}" — the version and endpoint path come from the ` +
        'endpoint registry, not from the base URL',
    )
  }

  // Guarantee the prefix appears exactly once, at the end.
  const endsWithPrefix =
    prefixSegments.length === 0 ||
    (pathSegments.length >= prefixSegments.length &&
      prefixSegments.every(
        (segment, index) =>
          pathSegments[pathSegments.length - prefixSegments.length + index] === segment,
      ))

  // Deliberately not recorded as a note. A base holding the origin alone is the
  // documented, correct configuration, so adding the prefix is this function
  // doing its job — warning about it would train the reader to ignore the
  // messages that do indicate a mistake.
  if (!endsWithPrefix) {
    pathSegments = [...pathSegments, ...prefixSegments]
  }

  const path = toPath(pathSegments)

  // A same-origin deployment with no prefix has nothing left to say; "/" keeps
  // it a valid base rather than an empty string Axios would treat as absent.
  const baseUrl = origin + path || '/'

  return { baseUrl, origin, prefix, notes }
}

export default resolveApiBaseUrl
