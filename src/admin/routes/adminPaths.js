/**
 * Admin route registry.
 *
 * Deliberately a *separate* file from `@/routes/paths`, not an extension of it.
 *
 * The CRM registry is read by `@/config/navigation`, which drives the sidebar
 * every existing user sees. Adding admin paths there would put them one careless
 * import away from appearing in the CRM navigation before Phase 14.2 has built
 * the permission checks that decide who may see them. Keeping the two registries
 * apart means the admin surface cannot leak into the CRM chrome by accident.
 *
 * Everything is nested under `/admin`, so a single route branch in the router
 * covers the whole module and removing that branch removes the whole module.
 */

/** The mount point. Every other path below is a child of it. */
export const ADMIN_ROOT = '/admin'

export const ADMIN_PATHS = Object.freeze({
  ROOT: ADMIN_ROOT,
  /** Admin home. Index route of the shell. */
  DASHBOARD: `${ADMIN_ROOT}`,
  USERS: `${ADMIN_ROOT}/users`,
  /** The user 360 dashboard. `:id` is substituted at the call site. */
  USER_DETAIL: `${ADMIN_ROOT}/users/:id`,
  ROLES: `${ADMIN_ROOT}/roles`,
  MAILBOXES: `${ADMIN_ROOT}/mailboxes`,
  ANALYTICS: `${ADMIN_ROOT}/analytics`,
  /** The team leaderboard. Shares the analytics permission. */
  TEAM: `${ADMIN_ROOT}/team`,
  CAMPAIGN_MONITOR: `${ADMIN_ROOT}/campaigns`,
  LEAD_MONITOR: `${ADMIN_ROOT}/leads`,
  AUDIT: `${ADMIN_ROOT}/audit`,
  HEALTH: `${ADMIN_ROOT}/health`,
  ORGANIZATION: `${ADMIN_ROOT}/organization`,
})

export default ADMIN_PATHS
