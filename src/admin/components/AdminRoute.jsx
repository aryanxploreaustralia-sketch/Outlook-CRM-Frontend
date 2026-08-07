/**
 * Route-level permission gate for the admin console.
 *
 * ## The three states, in a deliberate order
 *
 * The order mirrors `ProtectedRoute`'s and for the same reason it documents:
 * deciding too early turns a transient state into a wrong answer.
 *
 *  1. **Not resolved yet** — render a loading screen. Refusing before the grant
 *     set has arrived would show "access denied" to an owner on every hard
 *     refresh, which is the most common way this guard is got wrong.
 *  2. **The fetch failed** — say the permissions could not be read. That is not
 *     the same as being refused, and telling somebody they lack access because
 *     the server was briefly unreachable sends them to ask for a grant they
 *     already have.
 *  3. **Genuinely refused** — a clear 403 screen naming what is required.
 *
 * ## Why it does not redirect
 *
 * A redirect to the dashboard loses the URL and looks like a bug — the user
 * clicked a link and landed somewhere else with no explanation. A stated refusal
 * keeps the address, says what happened, and offers the way back.
 *
 * ## Not the security boundary
 *
 * Typing the URL directly reaches this component, which refuses. But even if it
 * did not, every screen behind it loads from an endpoint that enforces the same
 * permission server-side. This exists so the product behaves sensibly, not so it
 * is safe.
 */

import { Link } from 'react-router-dom'
import { LockKeyhole } from 'lucide-react'

import { usePermissions } from '@/admin/hooks/usePermissions'
import { ADMIN_PATHS } from '@/admin/routes/adminPaths'
import { AdminErrorState } from '@/admin/components/AdminErrorState'
import { LoadingScreen } from '@/components/common/LoadingScreen'
import { Button } from '@/components/ui/Button'
import { ROUTE_PATHS } from '@/routes/paths'

/**
 * The refusal screen.
 *
 * Names the capability in the words the permission catalogue uses, and the
 * caller's role — the two things somebody needs in order to ask the right person
 * for the right thing.
 */
function AccessDenied({ required, role, roleLabel, catalogue, canReachConsole }) {
  const described = required
    .map((permission) => catalogue?.[permission] ?? permission)
    .filter(Boolean)

  return (
    <div role="alert" className="grid min-h-[60vh] place-items-center px-6">
      <div className="flex max-w-md flex-col items-center text-center">
        <span className="grid size-12 place-items-center rounded-xl bg-amber-50 text-amber-600 ring-1 ring-inset ring-amber-600/20">
          <LockKeyhole className="size-6" aria-hidden="true" />
        </span>

        <h2 className="mt-4 text-base font-semibold text-slate-900">
          You do not have access to this page
        </h2>

        <p className="mt-1.5 text-sm text-slate-500">
          {described.length === 1
            ? `It requires permission to ${described[0].toLowerCase()}.`
            : `It requires one of: ${described.map((item) => item.toLowerCase()).join(', ')}.`}{' '}
          Your account is {roleLabel ?? role ?? 'unknown'}.
        </p>

        <p className="mt-3 rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600">
          Ask an administrator if you believe you should have this.
        </p>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {/* Only offered when there is somewhere in the console to go back to.
              A "back to administration" button that lands on another refusal is
              worse than no button. */}
          {canReachConsole && (
            <Button as={Link} to={ADMIN_PATHS.DASHBOARD} variant="secondary" size="sm">
              Administration home
            </Button>
          )}
          <Button as={Link} to={ROUTE_PATHS.DASHBOARD} size="sm">
            Back to the CRM
          </Button>
        </div>
      </div>
    </div>
  )
}

/**
 * @param {{
 *   permission?: string,
 *   anyOf?: string[],
 *   children: import('react').ReactNode,
 * }} props
 *   Give `permission` for a single requirement or `anyOf` for a page reachable
 *   from several capabilities. Passing neither renders the children — used by
 *   the shell itself, which gates on `adminAccess` instead.
 */
export function AdminRoute({ permission, anyOf, children }) {
  const { isReady, error, can, canAny, role, roleLabel, catalogue, adminAccess } = usePermissions()

  // --- 1. Still resolving ---------------------------------------------------
  if (!isReady) {
    return <LoadingScreen fullScreen message="Checking your access" detail="One moment." />
  }

  // --- 2. Could not read the grants ----------------------------------------
  if (error) {
    return <AdminErrorState error={error} />
  }

  // --- 3. Refused -----------------------------------------------------------
  const required = permission ? [permission] : (anyOf ?? [])
  const allowed = required.length === 0 || (permission ? can(permission) : canAny(anyOf))

  if (!allowed) {
    return (
      <AccessDenied
        required={required}
        role={role}
        roleLabel={roleLabel}
        catalogue={catalogue}
        canReachConsole={adminAccess}
      />
    )
  }

  return children
}

export default AdminRoute
