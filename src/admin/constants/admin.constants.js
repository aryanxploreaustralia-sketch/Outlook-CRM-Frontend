/**
 * Shared admin constants.
 *
 * Anything a second admin component would otherwise re-declare lives here, so a
 * tone, a page size or a status word never means two different things on two
 * screens.
 *
 * ## What Phase 14.2 removed
 *
 * `ADMIN_VIEW_STATE`, `ADMIN_STUB_LATENCY_MS` and `ADMIN_PLACEHOLDER_NOTICE`.
 * All three existed to support fixtures and the developer state switch. There is
 * a backend now: state comes from the request, and a banner announcing that the
 * figures are fake would be false.
 *
 * `ADMIN_USER_STATUS.INVITED` went too. `User` has no invitation state — that
 * needs a `Membership` document, which Phase 14.3 introduces — and a filter
 * option that can never match is a filter the user concludes is broken.
 */

/**
 * Semantic tones used by stat cards, health tiles and inline badges.
 *
 * Deliberately a small closed set. Every admin surface picks from these five, so
 * "amber" cannot come to mean *degraded* on one page and *pending* on another.
 */
export const ADMIN_TONE = Object.freeze({
  NEUTRAL: 'neutral',
  BRAND: 'brand',
  SUCCESS: 'success',
  WARNING: 'warning',
  DANGER: 'danger',
})

/** Default rows per page for every admin table. Matches the server's default. */
export const ADMIN_PAGE_SIZE = 25

/** Options offered by the pagination control. The server caps at 100. */
export const ADMIN_PAGE_SIZE_OPTIONS = Object.freeze([10, 25, 50, 100])

/**
 * Account lifecycle states. Mirrors `USER_STATUS` in the backend.
 *
 * Phase 14.2 had only two, because `User` had only two booleans to derive from.
 * Phase 14.3A added the `status` field, and with it the two states the booleans
 * could never express: an account created by an administrator that nobody has
 * signed into, and one that was soft-deleted before any of this existed.
 */
export const ADMIN_USER_STATUS = Object.freeze({
  INVITED: 'invited',
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  DISABLED: 'disabled',
})

export const ADMIN_USER_STATUS_LABELS = Object.freeze({
  [ADMIN_USER_STATUS.INVITED]: 'Invited',
  [ADMIN_USER_STATUS.ACTIVE]: 'Active',
  [ADMIN_USER_STATUS.SUSPENDED]: 'Suspended',
  [ADMIN_USER_STATUS.DISABLED]: 'Disabled',
})

/**
 * Badge tone per status. The label always carries the meaning as well — colour
 * is never the only signal.
 *
 * `invited` is informational rather than a warning: an invitation waiting to be
 * accepted is the system working, not a fault.
 */
export const ADMIN_USER_STATUS_TONE = Object.freeze({
  [ADMIN_USER_STATUS.INVITED]: 'info',
  [ADMIN_USER_STATUS.ACTIVE]: 'success',
  [ADMIN_USER_STATUS.SUSPENDED]: 'danger',
  [ADMIN_USER_STATUS.DISABLED]: 'neutral',
})

/**
 * Component health, matching `HEALTH_STATE` in the backend admin module.
 *
 * Four states rather than a boolean: "reachable but slow" and "not reachable"
 * call for different responses. `UNKNOWN` is honest rather than optimistic — a
 * probe that could not run has proved nothing.
 */
export const ADMIN_HEALTH_STATE = Object.freeze({
  HEALTHY: 'healthy',
  WARNING: 'warning',
  OFFLINE: 'offline',
  UNKNOWN: 'unknown',
})

export const ADMIN_HEALTH_STATE_LABELS = Object.freeze({
  [ADMIN_HEALTH_STATE.HEALTHY]: 'Healthy',
  [ADMIN_HEALTH_STATE.WARNING]: 'Warning',
  [ADMIN_HEALTH_STATE.OFFLINE]: 'Offline',
  [ADMIN_HEALTH_STATE.UNKNOWN]: 'Unknown',
})

/** Badge tone per health state. The label always carries the meaning too. */
export const ADMIN_HEALTH_TONE = Object.freeze({
  [ADMIN_HEALTH_STATE.HEALTHY]: 'success',
  [ADMIN_HEALTH_STATE.WARNING]: 'warning',
  [ADMIN_HEALTH_STATE.OFFLINE]: 'danger',
  [ADMIN_HEALTH_STATE.UNKNOWN]: 'neutral',
})

/**
 * Stated on the screens whose data is real but whose *scope* is not yet the
 * organization.
 *
 * Every figure the admin API returns covers the whole deployment, because there
 * is no organization boundary to scope it to until Phase 14.3. Saying so is
 * cheaper than a reader assuming it means something narrower.
 */
export const ADMIN_SCOPE_NOTICE =
  'Figures cover the entire deployment. Per-organization scoping arrives with the workspace model in a later phase.'

export default ADMIN_TONE
