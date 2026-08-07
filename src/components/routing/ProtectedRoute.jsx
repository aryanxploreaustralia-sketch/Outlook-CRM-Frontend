/**
 * Route guard for authenticated pages.
 *
 * Three states, in a deliberate order:
 *
 *  1. **Not resolved yet** — render a loading screen. Redirecting before the
 *     auth check completes would bounce a signed-in user to the login page on
 *     every hard refresh, which is the most common way this guard is got wrong.
 *
 *  2. **API unreachable** — render a network error, *not* a redirect. "The server
 *     is down" is not "you are signed out"; sending the user to a login page they
 *     also cannot use would be actively misleading.
 *
 *  3. **Genuinely anonymous** — redirect to the login page, remembering where the
 *     user was headed so they land there after signing in.
 *
 * This is the only place that decision is made, so no page can forget to make it.
 *
 * ## What this guard deliberately does not check
 *
 * Whether a Microsoft mailbox is connected.
 *
 * It used to, and that was the defect Phase 13.2 was opened to fix. A fourth
 * branch here rendered a full-page "Reconnect your Microsoft account" screen
 * whenever `outlookConnected` was false — which, after Google sign-in became the
 * CRM's identity, was *always*, because the flag was read from the session's
 * Outlook account and a Google session has none. A user who had signed in
 * perfectly successfully could reach nothing but the Account page.
 *
 * The deeper problem was that the check conflated two questions this phase
 * separated for good:
 *
 *   - *May this person use the CRM?*  — authentication, answered here.
 *   - *Can this operation reach a mailbox?* — authorisation for one action,
 *     answered at the point of that action.
 *
 * Leads, companies, templates, campaigns, settings and the dashboard need only
 * the first. Sending needs both, and asks for the second where it is actually
 * needed: the Compose page stays open with its send button disabled, and the
 * server refuses with an actionable 403. Neither pretends the session expired.
 *
 * So this file has three branches and will keep three. A mailbox check does not
 * belong in a route guard.
 */

import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { ErrorScreen } from '@/components/common/ErrorScreen'
import { LoadingScreen } from '@/components/common/LoadingScreen'
import { useAuth } from '@/hooks/useAuth'
import { ROUTE_PATHS } from '@/routes/paths'

/**
 * @param {{ children?: import('react').ReactNode }} props
 *   Renders `children` when given, otherwise an `<Outlet />` for nested routes.
 */
export function ProtectedRoute({ children }) {
  const auth = useAuth()
  const location = useLocation()

  // --- 1. Still resolving ---------------------------------------------------
  if (!auth.isReady) {
    return (
      <LoadingScreen fullScreen message="Checking your session" detail="One moment." />
    )
  }

  // --- 2. API unreachable --------------------------------------------------
  if (auth.hasApiError) {
    return (
      <ErrorScreen
        variant="networkError"
        message={auth.error?.message}
        onRetry={() => auth.refresh()}
        actionLabel="Retry"
      />
    )
  }

  // --- 3. Anonymous → login ------------------------------------------------
  if (!auth.authenticated) {
    return (
      <Navigate
        to={ROUTE_PATHS.LOGIN}
        replace
        // `replace` keeps the guarded URL out of history, so Back does not
        // bounce the user between the guard and the login page.
        state={{ from: location.pathname + location.search }}
      />
    )
  }

  return children ?? <Outlet />
}

export default ProtectedRoute
