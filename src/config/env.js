/**
 * Typed, validated access to Vite environment variables.
 *
 * Importing `import.meta.env` directly across the codebase makes typos silent
 * (`import.meta.env.VITE_API_URI` simply reads as `undefined`). Funnelling every
 * read through this module means a misconfigured environment fails at startup
 * with a clear message instead of at runtime with a confusing network error.
 *
 * The API base URL gets more than a read: it is normalised by
 * `@/config/apiBaseUrl` before anything sees it, so the several plausible
 * spellings an operator might configure all collapse to one canonical value.
 * See that module for why.
 */

import { resolveApiBaseUrl } from '@/config/apiBaseUrl'

/**
 * Cleans one variable's value, falling back to a default when it is absent.
 *
 * ## Why the value is passed in rather than looked up
 *
 * The obvious signature is `read('VITE_APP_NAME')`, reading
 * `import.meta.env[key]` internally. It works, and it quietly ruins the build.
 *
 * Vite replaces `import.meta.env.VITE_APP_NAME` with a literal at build time,
 * one property at a time. A *computed* access cannot be resolved statically, so
 * Vite falls back to inlining the entire environment object — including the
 * variables only the dev server uses. `VITE_DEV_PROXY_TARGET` was shipped to
 * production that way, publishing `http://localhost:5000` in the bundle and
 * defeating the dead-code elimination that would otherwise drop it.
 *
 * Passing `import.meta.env.VITE_X` at the call site keeps every access static,
 * so each variable is inlined individually and unused ones vanish. The key is
 * still passed, for the error message.
 *
 * @param {string} key Variable name, including the mandatory `VITE_` prefix.
 * @param {unknown} raw The value, read statically by the caller.
 * @param {{ required?: boolean, fallback?: string }} [options]
 * @returns {string}
 */
function read(key, raw, options = {}) {
  const { required = false, fallback } = options
  const value = typeof raw === 'string' ? raw.trim() : raw

  if (value === undefined || value === '') {
    if (required) {
      throw new Error(
        `[config] Missing required environment variable "${key}". ` +
          'Copy frontend/.env.example to frontend/.env and fill it in.',
      )
    }
    return fallback
  }

  return value
}

/**
 * The resolved API base, computed once at module load.
 *
 * `VITE_API_BASE_URL` names the API's **origin** and nothing more —
 * `https://crmbackend.xploreaustralia.com`, or empty for a same-origin
 * deployment where the dev-server proxy or a reverse proxy forwards `/api`.
 * `VITE_API_PREFIX` mirrors the server's `API_PREFIX`. The `/v1` and the path
 * after it are contributed by `@/api/endpoints` and must never appear in
 * either variable; if they do, the resolver strips them rather than producing
 * a doubled URL.
 */
const resolvedApi = resolveApiBaseUrl(
  read('VITE_API_BASE_URL', import.meta.env.VITE_API_BASE_URL, { fallback: '' }),
  read('VITE_API_PREFIX', import.meta.env.VITE_API_PREFIX, { fallback: '/api' }),
)

export const env = Object.freeze({
  /** Human-readable application name, shown in the UI and document title. */
  appName: read('VITE_APP_NAME', import.meta.env.VITE_APP_NAME, {
    fallback: 'Outlook Automation CRM',
  }),

  /**
   * Canonical base every API request is built from, e.g.
   * `https://crmbackend.xploreaustralia.com/api` or `/api`.
   *
   * Already normalised — nothing downstream should inspect, trim or extend it.
   * Join a path onto it with `apiUrl()` from `@/api/apiUrl`.
   */
  apiBaseUrl: resolvedApi.baseUrl,

  /** The API's origin, or `''` when the deployment is same-origin. */
  apiOrigin: resolvedApi.origin,

  /** The server's route prefix, normalised. Part of `apiBaseUrl` already. */
  apiPrefix: resolvedApi.prefix,

  /** Request timeout in milliseconds. */
  apiTimeout: Number(
    read('VITE_API_TIMEOUT', import.meta.env.VITE_API_TIMEOUT, { fallback: '15000' }),
  ),

  /** Vite's own mode flags, re-exported so nothing else touches import.meta. */
  mode: import.meta.env.MODE,
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
})

if (Number.isNaN(env.apiTimeout) || env.apiTimeout <= 0) {
  throw new Error(
    `[config] VITE_API_TIMEOUT must be a positive number, received "${import.meta.env.VITE_API_TIMEOUT}".`,
  )
}

/**
 * Report every correction the resolver made, in every environment.
 *
 * Deliberately not gated on `DEV`. A base URL is configured at *build* time and
 * only ever wrong in the environment the developer is not looking at, so the
 * one place this message is worth printing is the production console — where
 * the first symptom is otherwise a 404 whose URL nothing in the source
 * explains.
 */
if (resolvedApi.notes.length > 0) {
  console.warn(
    `[config] VITE_API_BASE_URL="${import.meta.env.VITE_API_BASE_URL ?? ''}" was normalised ` +
      `to "${env.apiBaseUrl}":\n` +
      resolvedApi.notes.map((note) => `  • ${note}`).join('\n') +
      '\n  VITE_API_BASE_URL should name the API origin only, e.g. ' +
      '"https://crmbackend.xploreaustralia.com". The "/api" prefix comes from ' +
      'VITE_API_PREFIX and the "/v1/..." path from src/api/endpoints.js.',
  )
}

/**
 * Refuse a production build that would call the API on its own origin.
 *
 * When the site and the API share a host this is correct and common, so it
 * cannot be an error — but shipping the development default unchanged is how
 * the browser ended up requesting `https://crm.xploreaustralia.com/api/...`
 * from a site that serves no API. Stating it plainly at boot costs one line and
 * names the cause immediately.
 */
if (env.isProduction && env.apiOrigin === '') {
  console.warn(
    '[config] No VITE_API_BASE_URL was set for this production build, so API ' +
      `requests go to this site's own origin (${env.apiBaseUrl}). That is correct ` +
      'only if a reverse proxy forwards it to the API. If the API is on its own ' +
      'host, set VITE_API_BASE_URL and rebuild — the value is compiled into the ' +
      'bundle and cannot be changed after `npm run build`.',
  )
}

export default env
