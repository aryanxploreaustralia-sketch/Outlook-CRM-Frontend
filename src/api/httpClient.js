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
  baseURL: env.apiBaseUrl,
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
    logger.debug(`→ ${config.method?.toUpperCase()} ${config.baseURL ?? ''}${config.url}`)
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
      normalised = {
        message: 'Unable to reach the server. Please check that the API is running.',
        status: null,
        code: 'NETWORK_ERROR',
        details: null,
        isNetwork: true,
      }
    }

    // Every non-cancellation path shares this flag, so consumers can read it
    // unconditionally rather than testing for its presence.
    normalised.isCanceled = false

    logger.error(normalised.message, { code: normalised.code, status: normalised.status })
    return Promise.reject(normalised)
  },
)

export { httpClient }
export default httpClient
