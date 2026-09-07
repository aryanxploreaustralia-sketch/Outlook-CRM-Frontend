/**
 * Where a signed-in account belongs.
 *
 * One pure function, so the answer cannot differ between the front door
 * (`RootRedirect`), the login page's already-signed-in shortcut, and the guard
 * that refuses the CRM. Three call sites disagreeing about the destination is
 * precisely how a redirect loop is built, and the only reliable way to prevent
 * one is to have a single place that decides.
 *
 * ## The two inputs are deliberately independent
 *
 * `hasAdminAccess` comes from the server, derived from `roleMatrix.js` — the
 * same table the admin routes are gated by. `userPanelAccess` is a field on the
 * user document. Nothing here converts one into the other:
 *
 *   - a person with `userPanelAccess` gains no administrative capability;
 *   - an administrator is not given the CRM by being an administrator.
 *
 * `role` is consulted for exactly one thing — an owner's *preference* for the
 * console — and never as a grant. An owner still reaches `/admin` only because
 * `AdminLayout` gates on `adminAccess`, and still reaches the CRM only if the
 * flag permits it. Changing the line below could send somebody to a screen they
 * are not allowed to see; it could not let them see it.
 *
 * ## Why this cannot loop
 *
 * Every branch returns a terminal destination. `NO_ACCESS` is a rendered page
 * rather than another redirect, so the one case with nowhere to go stops rather
 * than bouncing between two guards that each believe the other should handle it.
 */

import { ADMIN_PATHS } from '@/admin/routes/adminPaths'
import { ROUTE_PATHS } from '@/routes/paths'

/** The role whose home is the console rather than the CRM. */
const OWNER_ROLE = 'owner'

/**
 * Reads the flag the way every layer reads it.
 *
 * Absent means permitted. Accounts created before the field existed have no
 * value stored, and they have always been able to open the CRM — treating
 * `undefined` as a refusal would lock out every one of them on the day this
 * shipped.
 *
 * @param {?object} user
 * @returns {boolean}
 */
export function hasUserPanelAccess(user) {
  return user?.userPanelAccess !== false
}

/**
 * @param {object}   params
 * @param {?object}  params.user            The account, as `/auth/status` returned it.
 * @param {boolean}  params.hasAdminAccess  Server-computed; never inferred from a role here.
 * @returns {string} A path. Always terminal.
 */
export function resolveLanding({ user, hasAdminAccess }) {
  const canUseCrm = hasUserPanelAccess(user)

  /**
   * An owner's default workspace is the console.
   *
   * True whether or not they also hold the CRM — the flag decides what else is
   * open to them, not where they start. `hasAdminAccess` is still required, so
   * an owner whose permissions were somehow narrowed is not sent to a door that
   * would refuse them.
   */
  if (user?.role === OWNER_ROLE && hasAdminAccess) {
    return ADMIN_PATHS.ROOT
  }

  // Everybody else works in the CRM, which is the existing behaviour and stays
  // the default for every non-owner role.
  if (canUseCrm) {
    return ROUTE_PATHS.DASHBOARD
  }

  // The CRM is closed to them, but the console is not — an administrator who
  // does no CRM work at all.
  if (hasAdminAccess) {
    return ADMIN_PATHS.ROOT
  }

  // Neither surface. A page, not a redirect.
  return ROUTE_PATHS.NO_ACCESS
}

export default resolveLanding
