/**
 * Typed, validated access to Vite environment variables.
 *
 * Importing `import.meta.env` directly across the codebase makes typos silent
 * (`import.meta.env.VITE_API_URI` simply reads as `undefined`). Funnelling every
 * read through this module means a misconfigured environment fails at startup
 * with a clear message instead of at runtime with a confusing network error.
 */

/**
 * Reads a variable, falling back to a default when one is provided.
 *
 * @param {string} key Variable name, including the mandatory `VITE_` prefix.
 * @param {{ required?: boolean, fallback?: string }} [options]
 * @returns {string}
 */
function read(key, options = {}) {
  const { required = false, fallback } = options
  const raw = import.meta.env[key]
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

export const env = Object.freeze({
  /** Human-readable application name, shown in the UI and document title. */
  appName: read('VITE_APP_NAME', { fallback: 'Outlook Automation CRM' }),

  /**
   * Base URL every API request is prefixed with.
   *
   * Defaults to the relative `/api` so the Vite dev-server proxy handles it in
   * development and a reverse proxy handles it in production.
   */
  apiBaseUrl: read('VITE_API_BASE_URL', { fallback: '/api' }),

  /** Request timeout in milliseconds. */
  apiTimeout: Number(read('VITE_API_TIMEOUT', { fallback: '15000' })),

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

export default env
