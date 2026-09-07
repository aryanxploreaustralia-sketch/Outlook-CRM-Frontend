/**
 * Signed in, but neither surface is open.
 *
 * The counterpart to `AdminNoAccess`, and deliberately its mirror rather than a
 * new visual idea: same centred card, same icon treatment, same two actions. A
 * person who reaches either has hit the same wall, and giving the two refusals
 * different designs would suggest they are different problems.
 *
 * ## Why it is a page and not a redirect
 *
 * This is the one state with nowhere to forward to. Every other guard in the
 * application answers a refusal by sending the browser somewhere better; this
 * case has no better place, so it must stop here. Redirecting to `/login` —
 * which forwards authenticated visitors straight back — is how the
 * `/login → / → /login` bounce gets built, and routing to `/dashboard` would
 * return to the guard that just refused. Rendering ends it.
 *
 * ## Wording
 *
 * It does not say "permission denied", because nothing was denied — the account
 * simply has no workspace configured yet, which is an administrative gap rather
 * than a wrongdoing. Sign-out is offered because the likeliest explanation is
 * being signed in as the wrong account.
 */

import { DoorClosed } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { useAuth } from '@/hooks/useAuth'

export function NoAccessPage() {
  const auth = useAuth()

  const roleLabel = auth.user?.roleLabel ?? null

  return (
    <div role="alert" className="grid min-h-svh place-items-center bg-slate-50 px-6">
      <div className="flex max-w-md flex-col items-center text-center">
        <span className="grid size-14 place-items-center rounded-2xl bg-slate-200 text-slate-500">
          <DoorClosed className="size-7" aria-hidden="true" />
        </span>

        <h1 className="mt-5 text-lg font-semibold text-slate-900">
          No workspace is available for your account
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          You are signed in
          {auth.user?.email ? (
            <>
              {' '}
              as <span className="font-medium text-slate-700">{auth.user.email}</span>
            </>
          ) : null}
          , but this account has not been given access to the CRM
          {roleLabel ? (
            <>
              , and its role — <span className="font-medium text-slate-700">{roleLabel}</span> — does
              not include the administration console
            </>
          ) : (
            ' or the administration console'
          )}
          .
        </p>

        <p className="mt-3 rounded-lg bg-white px-3 py-2 text-xs text-slate-500 ring-1 ring-slate-200">
          Ask an administrator to enable User Panel access for your account.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => auth.signOut?.()}>
            Sign out
          </Button>
        </div>
      </div>
    </div>
  )
}

export default NoAccessPage
