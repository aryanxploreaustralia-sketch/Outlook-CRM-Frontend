/**
 * Application-wide constant values.
 *
 * Keeping these in one place avoids magic strings drifting apart across
 * components as the CRM grows.
 */

/** Keys used for browser storage. Prefixed to avoid collisions on shared hosts. */
export const STORAGE_KEYS = Object.freeze({
  THEME: 'oac:theme',
  ACCESS_TOKEN: 'oac:access-token',
  /** Desktop sidebar collapse preference, persisted across reloads. */
  SIDEBAR_COLLAPSED: 'oac:sidebar-collapsed',

  /*
   * Column order per lead table.
   *
   * One key per table rather than one per panel, because the three tables do
   * not share a column set — a single key would have each of them discarding
   * the others' keys on every read. Keeping them apart is also what guarantees
   * the console's layout never follows somebody into the CRM.
   */
  LEAD_COLUMNS_CRM: 'oac:lead-columns:user',
  LEAD_COLUMNS_ADMIN_MONITOR: 'oac:lead-columns:admin-monitor',
  LEAD_COLUMNS_ADMIN_USER_LEADS: 'oac:lead-columns:admin-user-leads',
})

/** Request lifecycle states, used by data-fetching hooks. */
export const REQUEST_STATUS = Object.freeze({
  IDLE: 'idle',
  LOADING: 'loading',
  SUCCESS: 'success',
  ERROR: 'error',
})

/** Service health states reported by the backend. */
export const HEALTH_STATE = Object.freeze({
  UP: 'up',
  DOWN: 'down',
  UNKNOWN: 'unknown',
})

/** HTTP status codes the frontend reacts to explicitly. */
export const HTTP_STATUS = Object.freeze({
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
})
