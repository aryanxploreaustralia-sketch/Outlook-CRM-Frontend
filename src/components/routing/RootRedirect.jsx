/**
 * What `/` does.
 *
 * The root URL is an entry point, not a page. It asks who is here and sends them
 * where they belong:
 *
 *   signed out            ->  /login
 *   owner                 ->  /admin      (their default workspace)
 *   CRM access            ->  /dashboard  (the existing behaviour, unchanged)
 *   console access only   ->  /admin
 *   neither               ->  /no-access
 *
 * The choice itself lives in `routes/landing.js` rather than here, because the
 * login page's already-signed-in shortcut has to reach the identical answer.
 * Two call sites deciding separately is how a redirect loop is built.
 *
 * It previously rendered a static "Phase 1" overview describing which modules
 * were not built yet, which meant the CRM's front door showed a development
 * roadmap to anyone who opened it.
 *
 * ## Why this reads the same source as the route guard
 *
 * `useAuth` is the application's only authority on the session; it holds what
 * `GET /v1/auth/status` returned. Deciding here from anything else — a
 * localStorage flag, a cookie the client cannot actually read — would create a
 * second, weaker answer that could disagree with `ProtectedRoute` and put the
 * browser in a redirect loop between the two.
 *
 * ## Why it waits
 *
 * `isReady` is false while that first status request is in flight. Redirecting
 * during it would send every signed-in user to `/login` on a cold load, and the
 * login page — which redirects authenticated visitors onward — would send them
 * back, producing exactly the `/ -> /login -> / -> /login` bounce this has to
 * avoid. Waiting one render is what makes the decision correct rather than
 * merely fast.
 *
 * An unreachable API is treated as "not signed in" and lands on `/login`. That
 * page renders its own error state and offers a retry, so the user sees the
 * real problem instead of a spinner that never resolves.
 */

import { Navigate } from 'react-router-dom'

import { LoadingScreen } from '@/components/common/LoadingScreen'
import { useAdminAccess } from '@/hooks/useAdminAccess'
import { useAuth } from '@/hooks/useAuth'
import { resolveLanding } from '@/routes/landing'
import { ROUTE_PATHS } from '@/routes/paths'

export function RootRedirect() {
  const auth = useAuth()

  /**
   * The console half of the decision.
   *
   * Server-computed and already deferred until the session is confirmed, so
   * this adds no request for an anonymous visitor. It is the same hook the
   * sidebar uses, so the answer is shared rather than asked for twice.
   */
  const { hasAdminAccess, isReady: accessReady } = useAdminAccess()

  if (!auth.isReady) {
    return <LoadingScreen fullScreen message="Starting the CRM" detail="One moment." />
  }

  if (!auth.authenticated) {
    return <Navigate to={ROUTE_PATHS.LOGIN} replace />
  }

  /**
   * Wait for the console answer before choosing.
   *
   * `hasAdminAccess` is false until known, and deciding on that provisional
   * false would send an administrator whose CRM access is off to the no-access
   * page for a moment before correcting itself — a flash of a refusal they are
   * not actually subject to. One extra render is the cheaper mistake.
   */
  if (!accessReady) {
    return <LoadingScreen fullScreen message="Starting the CRM" detail="One moment." />
  }

  return <Navigate to={resolveLanding({ user: auth.user, hasAdminAccess })} replace />
}

export default RootRedirect
