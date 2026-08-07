/**
 * Configured Axios instance shared by the whole application.
 *
 * Responsibilities:
 *  - apply the base URL, timeout and default headers in one place;
 *  - attach a correlation id so a browser request can be traced in server logs;
 *  - normalise every failure into a single predictable shape.
 *
 * That last point matters: without it, callers end up writing defensive chains
 * like `err.response?.data?.message ?? err.message ?? 'Unknown'` at every call
 * site. Here it is done once.
 */

import axios from 'axios'

import { API_BASE_URL, apiPath, toEndpointPath } from '@/api/apiUrl'
import { env } from '@/config/env'
import { logger } from '@/utils/logger'

/**
 * The shape every rejected request resolves to.
 *
 * @typedef  {object}  NormalisedError
 * @property {string}  message   Human-readable, safe to show in the UI.
 * @property {?number} status    HTTP status, or null when the request never landed.
 * @property {string}  code      Machine-readable discriminator.
 * @property {?object} details   Field-level validation errors, when supplied.
 * @property {boolean} isNetwork True when the server was never reached.
 * @property {boolean} isCanceled True when the caller aborted the request.
 */

/**
 * Detects a request the caller deliberately aborted.
 *
 * Axios reports cancellation as `ERR_CANCELED` / `CanceledError`, which is easy
 * to mistake for a network failure — the request also never reached the server.
 * The distinction matters: an abort is a normal part of superseding an in-flight
 * request or unmounting a component, so it must not be logged as an error or
 * surfaced to the user as "the server is unreachable".
 *
 * @param {unknown} error
 * @returns {boolean}
 */
function isCancellation(error) {
  return (
    error?.code === 'ERR_CANCELED' ||
    error?.name === 'CanceledError' ||
    error?.config?.signal?.aborted === true
  )
}

const httpClient = axios.create({
  // Already normalised by `@/config/apiBaseUrl` and joined by `@/api/apiUrl`;
  // read from there rather than from config, so this instance and the URLs
  // built for navigations and downloads cannot drift apart.
  baseURL: API_BASE_URL,
  timeout: env.apiTimeout,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  // Send cookies so the future Microsoft OAuth session flows work unchanged.
  withCredentials: true,
})

/** Generates a short id used to correlate a browser request with a server log line. */
function createRequestId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

httpClient.interceptors.request.use(
  (config) => {
    config.headers['X-Request-Id'] = createRequestId()

    // Last line of defence against a doubled prefix. `baseURL` already carries
    // the origin and `/api`, so an endpoint that also spells one of them out
    // would produce `/api/api/v1/...` — the class of fault this layer exists to
    // make impossible. Absolute URLs are left alone: Axios ignores `baseURL`
    // for those, so there is nothing to duplicate.
    if (typeof config.url === 'string' && !/^[a-z][a-z\d+\-.]*:\/\//i.test(config.url)) {
      config.url = toEndpointPath(config.url)
    }

    // Log what the browser will actually request, not an approximation of it.
    // The old form concatenated `baseURL` and `url` directly, so it printed
    // `/api/v1/health` for a base of `/api/` — one slash away from the real
    // request, which is exactly the detail worth reading a debug log for.
    logger.debug(`→ ${config.method?.toUpperCase()} ${apiPath(config.url)}`)
    return config
  },
  (error) => Promise.reject(error),
)

httpClient.interceptors.response.use(
  (response) => {
    logger.debug(`← ${response.status} ${response.config.url}`)
    return response
  },
  (error) => {
    /** @type {NormalisedError} */
    let normalised

    // Checked first, and returned before the logging below: an aborted request
    // is expected control flow, not a fault worth reporting.
    if (isCancellation(error)) {
      return Promise.reject({
        message: 'Request was cancelled.',
        status: null,
        code: 'CANCELED',
        details: null,
        isNetwork: false,
        isCanceled: true,
      })
    }

    if (error.response) {
      // The server responded with a non-2xx status.
      const { status, data } = error.response
      normalised = {
        message: data?.message ?? `Request failed with status ${status}.`,
        status,
        code: data?.code ?? 'HTTP_ERROR',
        details: data?.errors ?? null,
        isNetwork: false,
      }
    } else if (error.code === 'ECONNABORTED') {
      normalised = {
        message: `The request timed out after ${env.apiTimeout}ms.`,
        status: null,
        code: 'TIMEOUT',
        details: null,
        isNetwork: true,
      }
    } else {
      // No response at all — server down, DNS failure, CORS block, offline.
      //
      // The browser deliberately withholds which of those it was, so the log
      // line carries the base URL instead: a wrong one and a CORS rejection are
      // by far the most common causes in a deployed build, and both are
      // diagnosable the moment the address being called is visible.
      normalised = {
        message: 'Unable to reach the server. Please check that the API is running.',
        status: null,
        code: 'NETWORK_ERROR',
        details: null,
        isNetwork: true,
        baseUrl: API_BASE_URL,
      }
    }

    // Every non-cancellation path shares this flag, so consumers can read it
    // unconditionally rather than testing for its presence.
    normalised.isCanceled = false

    logger.error(normalised.message, {
      code: normalised.code,
      status: normalised.status,
      url: apiPath(error.config?.url ?? ''),
    })
    return Promise.reject(normalised)
  },
)

export { httpClient }
export default httpClient
