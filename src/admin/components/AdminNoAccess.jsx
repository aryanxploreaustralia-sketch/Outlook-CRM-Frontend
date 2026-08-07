/**
 * Shown when an account holds no admin capability at all.
 *
 * Distinct from `AdminRoute`'s per-page refusal, and the distinction is worth
 * making: that one says *not this page*, which implies others. This one says
 * *not this console*, and offers the way back to the product the person actually
 * works in.
 *
 * ## Wording
 *
 * It does not enumerate what they are missing. A refusal that lists the seven
 * permissions the console needs reads as a checklist to go and request, and for
 * a Sales or Support account the correct answer is simply that administration is
 * not part of their job. It names their role — which is the useful fact — and
 * points at the person who can change it.
 *
 * Sign-out is offered because the most likely reason somebody lands here is that
 * they are signed in as the wrong account.
 */

import { Link } from 'react-router-dom'
import { ShieldOff } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { ROUTE_PATHS } from '@/routes/paths'

/**
 * @param {{ roleLabel?: ?string, onSignOut?: () => void }} props
 */
export function AdminNoAccess({ roleLabel, onSignOut }) {
  return (
    <div role="alert" className="grid min-h-svh place-items-center bg-slate-50 px-6">
      <div className="flex max-w-md flex-col items-center text-center">
        <span className="grid size-14 place-items-center rounded-2xl bg-slate-200 text-slate-500">
          <ShieldOff className="size-7" aria-hidden="true" />
        </span>

        <h1 className="mt-5 text-lg font-semibold text-slate-900">
          Administration is not available for your account
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          {roleLabel ? (
            <>
              Your account is <span className="font-medium text-slate-700">{roleLabel}</span>, which
              does not include access to the administration console.
            </>
          ) : (
            'Your account does not include access to the administration console.'
          )}{' '}
          Everything you need for your work is in the CRM.
        </p>

        <p className="mt-3 rounded-lg bg-white px-3 py-2 text-xs text-slate-500 ring-1 ring-slate-200">
          If you think this is wrong, ask an administrator to review your role.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <Button as={Link} to={ROUTE_PATHS.DASHBOARD} size="sm">
            Go to the CRM
          </Button>
          {onSignOut && (
            <Button variant="secondary" size="sm" onClick={onSignOut}>
              Sign out
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

export default AdminNoAccess
