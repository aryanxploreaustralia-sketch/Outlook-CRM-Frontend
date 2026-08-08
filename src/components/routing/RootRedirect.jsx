/**
 * What `/` does.
 *
 * The root URL is an entry point, not a page. It asks one question — is this
 * person signed in? — and sends them where that answer belongs:
 *
 *   signed out  ->  /login
 *   signed in   ->  /dashboard
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
import { useAuth } from '@/hooks/useAuth'
import { ROUTE_PATHS } from '@/routes/paths'

export function RootRedirect() {
  const auth = useAuth()

  if (!auth.isReady) {
    return <LoadingScreen fullScreen message="Starting the CRM" detail="One moment." />
  }

  return (
    <Navigate to={auth.authenticated ? ROUTE_PATHS.DASHBOARD : ROUTE_PATHS.LOGIN} replace />
  )
}

export default RootRedirect
