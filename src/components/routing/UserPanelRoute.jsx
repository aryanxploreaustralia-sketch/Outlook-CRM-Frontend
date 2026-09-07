/**
 * Guards the CRM on the account's User Panel access.
 *
 * ## Why this is not a fourth branch in `ProtectedRoute`
 *
 * That file states plainly that it has three branches and will keep three, and
 * records the defect that produced the rule: a fourth branch checking mailbox
 * connectivity once blocked every CRM page for every Google session. The lesson
 * was that authentication and per-surface authorisation are different questions
 * and should not share a guard. This is the second question, so it gets its own
 * component and composes outside the first.
 *
 * ## What it deliberately does not do
 *
 * It does not consult permissions, and it cannot open the admin console. A
 * person refused here may still be an administrator — `resolveLanding` sends
 * them to `/admin`, and `AdminLayout` decides on its own whether that opens.
 * Nothing on this path can widen what anybody may administer.
 *
 * ## Not a security boundary
 *
 * The server is. Every CRM endpoint already authenticates, and this flag governs
 * which surface is *offered*, not what the API will answer — exactly the stance
 * `useAdminAccess` documents for the admin link. Hiding a route hides nothing,
 * which is why the flag is only writable through an admin-guarded endpoint.
 */

import { Navigate, useLocation, useSearchParams } from 'react-router-dom'

import { LoadingScreen } from '@/components/common/LoadingScreen'
import { useAdminAccess } from '@/hooks/useAdminAccess'
import { useAuth } from '@/hooks/useAuth'
import { hasUserPanelAccess, resolveLanding } from '@/routes/landing'
import { ROUTE_PATHS } from '@/routes/paths'
import { ADMIN_PATHS } from '@/admin/routes/adminPaths'

/**
 * @param {{ children?: import('react').ReactNode }} props
 */
export function UserPanelRoute({ children }) {
  const auth = useAuth()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { hasAdminAccess, isReady: accessReady } = useAdminAccess()

  /**
   * A sign-in that has just completed.
   *
   * Both OAuth callbacks redirect to `postLoginPath` with `auth=success`, so a
   * fresh arrival is recognisable from the URL alone — no backend change, no
   * new environment variable, and the token flow is untouched.
   *
   * Narrowed to the default post-login path on purpose. When the login flow
   * captured a `returnPath`, the callback lands on *that* page instead, and the
   * person asked for it before they were interrupted — sending an owner to the
   * console at that point would discard the very intent the return path exists
   * to preserve.
   */
  const isFreshLogin =
    searchParams.get('auth') === 'success' && location.pathname === ROUTE_PATHS.DASHBOARD

  if (isFreshLogin) {
    if (!accessReady) {
      return <LoadingScreen fullScreen message="Signing you in" detail="One moment." />
    }

    const landing = resolveLanding({ user: auth.user, hasAdminAccess })

    // Only an account whose workspace is not the CRM moves. For everybody else
    // this is where they already are, and re-navigating would be a no-op that
    // costs a render.
    if (landing !== ROUTE_PATHS.DASHBOARD) {
      return <Navigate to={landing} replace />
    }
  }

  /**
   * The common case, taken next and with no waiting.
   *
   * Every account that predates the field, and every ordinary employee, passes
   * here — so the hook's readiness never delays the CRM for the people who use
   * it. Only a refusal needs the console answer, and only to choose between two
   * destinations.
   */
  if (hasUserPanelAccess(auth.user)) {
    return children
  }

  // Refused, and the alternative depends on whether the console is open. Waiting
  // avoids sending an administrator to the no-access page on a provisional false.
  if (!accessReady) {
    return <LoadingScreen fullScreen message="Checking your access" detail="One moment." />
  }

  return <Navigate to={hasAdminAccess ? ADMIN_PATHS.ROOT : ROUTE_PATHS.NO_ACCESS} replace />
}

export default UserPanelRoute
