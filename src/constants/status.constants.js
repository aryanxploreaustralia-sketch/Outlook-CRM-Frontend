/**
 * Status vocabulary shared with the API.
 *
 * These values mirror `backend/src/constants/systemStatus.js`. Any value the
 * server can emit must have an entry in the badge map, or it renders as the
 * neutral "unknown" fallback.
 */

/** Health of an infrastructure dependency. */
export const SERVICE_STATUS = Object.freeze({
  HEALTHY: 'healthy',
  DEGRADED: 'degraded',
  ERROR: 'error',
  OFFLINE: 'offline',
  NOT_CONFIGURED: 'not_configured',
  UNKNOWN: 'unknown',
})

/** Liveness of the API process. */
export const PROCESS_STATUS = Object.freeze({
  ONLINE: 'online',
  OFFLINE: 'offline',
})

/** State of the Microsoft mailbox connection. */
export const CONNECTION_STATUS = Object.freeze({
  CONNECTED: 'connected',
  REFRESHING: 'refreshing',
  EXPIRED: 'expired',
  DISCONNECTED: 'disconnected',
  NOT_CONNECTED: 'not_connected',
})

/** State of the caller's session. */
export const AUTH_STATUS = Object.freeze({
  ACTIVE: 'active',
  EXPIRED: 'expired',
  ANONYMOUS: 'anonymous',
})

/**
 * Legacy aliases from Phase 1.
 *
 * `SystemPage` and `AccountPage` were written against `up` / `down` / `unknown`.
 * They are kept as first-class values so those pages keep working unchanged —
 * removing them would break shipped functionality for no user-visible gain.
 */
export const LEGACY_STATUS = Object.freeze({
  UP: 'up',
  DOWN: 'down',
  UNKNOWN: 'unknown',
})

/**
 * Every value `StatusBadge` can render, as a flat list.
 *
 * Lives here rather than in the component so the badge file exports only a
 * component, which is what Fast Refresh requires to preserve state on edit.
 * Anything not in this list renders as the neutral "unknown" badge.
 */
export const SUPPORTED_STATUSES = Object.freeze([
  ...Object.values(CONNECTION_STATUS),
  ...Object.values(PROCESS_STATUS),
  ...Object.values(SERVICE_STATUS),
  ...Object.values(AUTH_STATUS),
  ...Object.values(LEGACY_STATUS),
])
