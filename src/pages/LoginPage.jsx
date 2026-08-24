/**
 * Sign-in page.
 *
 * The public entry point to the authenticated app, and the destination the OAuth
 * callback uses to report a *failed* sign-in — the post-login path sits behind a
 * route guard, which would bounce an unauthenticated browser and discard the
 * error before the user saw it.
 *
 * An already-authenticated visitor is redirected straight through, so a
 * bookmarked `/login` does not become a dead end.
 */

import { useEffect } from 'react'
import { Navigate, useLocation, useSearchParams } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'

import {
  startGoogleSignIn,
  startMicrosoftAdminSignIn,
  startMicrosoftSignIn,
} from '@/api/services/auth.service'
import { GoogleIcon } from '@/components/common/GoogleIcon'
import { MicrosoftIcon } from '@/components/common/MicrosoftIcon'
import { Button } from '@/components/ui/Button'
import { LoadingScreen } from '@/components/common/LoadingScreen'
import { env } from '@/config/env'
import { useAuth } from '@/hooks/useAuth'
import { ROUTE_PATHS } from '@/routes/paths'

/**
 * Human explanations for the OAuth error codes the callback can return.
 * Anything unmapped falls back to a generic message rather than showing a raw code.
 */
const ERROR_MESSAGES = {
  access_denied: 'Sign-in was cancelled, or consent was not granted.',
  missing_code: 'Microsoft did not return an authorization code. Please try again.',
  UNAUTHORIZED: 'That sign-in attempt was invalid or had already been used. Please try again.',
  SERVICE_UNAVAILABLE: 'Microsoft sign-in is not configured on this server.',
  consent_required: 'Additional consent is required. Ask an administrator to approve this app.',
  invalid_client: 'The server’s Microsoft credentials were rejected. Check the client secret.',
  sign_in_failed: 'Sign-in could not be completed. Please try again.',

  /**
   * Phase 13.2 — Microsoft is no longer a way in.
   *
   * Worth its own message rather than falling through to a generic failure,
   * because nothing is broken: the person tried a sign-in method that has been
   * retired, and the useful reply names the one that works and says their
   * mailboxes are safe.
   */
  microsoft_signin_disabled:
    'Microsoft is no longer used to sign in to the CRM — sign in with Google above. ' +
    'Your Microsoft mailboxes are unaffected; connect and manage them from Account once you are in.',

  /**
   * Administrator sign-in (Phase 14.8B).
   *
   * `not_admin` is deliberately the plainest of these. Somebody who reaches it
   * has proved who they are and simply is not an administrator — that is not an
   * error they can fix by retrying, and telling them to try again would be a
   * lie.
   */
  not_admin:
    'You do not have administrator access. Sign in with Google to use the CRM instead.',
  /**
   * Phase 14.8C wording.
   *
   * No longer "no account exists for that address" — that was true of the old
   * email-matching rule and is misleading now. An account may well exist; what
   * is missing is a *link* between it and this Microsoft identity, and only an
   * owner can make one.
   */
  no_account:
    'No organization access. Contact an existing Organization Owner to be invited or linked.',
  bootstrap_taken:
    'This organization has just been claimed by another account. Ask them to invite you.',
  suspended: 'That account has been suspended. Contact an administrator.',
  personal_account:
    'Administrator sign-in needs a work or school account, not a personal Microsoft account.',
  unverified_email: 'Microsoft did not return a verified email address for that account.',
  flow_invalid: 'That sign-in link was invalid or had already been used. Please try again.',
  exchange_failed: 'Microsoft sign-in could not be completed. Please try again.',
  not_configured: 'Microsoft sign-in is not configured on this server yet.',

  // --- Google (Phase 13.1) ------------------------------------------------
  //
  // Mirrors `GOOGLE_AUTH_ERROR` on the server. Every one of these is something
  // a person can act on, which is the whole reason the callback returns a code
  // rather than a generic failure.
  google_not_configured: 'Google sign-in is not configured on this server yet.',
  google_unreachable: 'Could not reach Google. Please try again in a moment.',
  google_code_rejected: 'That sign-in expired or had already been used. Please try again.',
  google_flow_invalid: 'That sign-in link was invalid or had already been used. Please try again.',
  google_email_unverified:
    'Google has not verified that email address. Verify it with Google, then try again.',
  google_no_email: 'That Google account has no email address, so it cannot be used to sign in.',
  google_domain_not_allowed:
    'That Google account is not permitted to use this CRM. Use your work Google account.',
  account_inactive: 'This CRM account is not active. Contact an administrator.',
  account_deleted: 'This CRM account has been removed. Contact an administrator.',
  google_nonce_mismatch: 'That sign-in could not be matched to this browser. Please try again.',
  google_token_expired: 'That sign-in expired. Please try again.',
  google_bad_audience: 'That sign-in was not issued for this application.',
  google_bad_signature: 'That sign-in could not be verified. Please try again.',

  /*
   * The one refusal an operator can actually clear.
   *
   * The account was removed and re-created; the removed record still holds this
   * Google identity, and the unique index covers deleted documents — so the new
   * account cannot claim it. An administrator releases it from
   * Admin -> Users -> the removed account -> Sign-in identities -> Unlink.
   */
  google_identity_held_by_deleted:
    'This Google account is still linked to a removed CRM account. Ask an administrator to unlink it from that account, then try again.',

  /*
   * Token-verification failures, deliberately given one shared wording.
   *
   * Which check failed — algorithm, issuer, key, timing — describes our
   * verification internals and says nothing a person signing in can act on. The
   * distinction is kept in the server log, where it is useful.
   */
  google_no_id_token: 'That sign-in could not be verified. Please try again.',
  google_malformed_token: 'That sign-in could not be verified. Please try again.',
  google_bad_algorithm: 'That sign-in could not be verified. Please try again.',
  google_unknown_key: 'That sign-in could not be verified. Please try again.',
  google_bad_issuer: 'That sign-in could not be verified. Please try again.',
  google_token_not_yet_valid: 'That sign-in could not be verified. Please try again.',
}

/**
 * What Google is asked for.
 *
 * Identity only, and the list says so plainly. It is deliberately short: this
 * CRM does not request Gmail access of any kind, and a user glancing at the
 * sign-in page should be able to see that for themselves.
 */
const PERMISSION_SUMMARY = [
  'Your name and profile picture',
  'Your email address, and whether Google has verified it',
]

export function LoginPage() {
  const auth = useAuth()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()

  /**
   * Two callbacks report failure here, under different keys.
   *
   * `auth=error` is the employee flow; `admin=error` is the administrator door
   * added in Phase 14.8B. Separate keys rather than one, so the page can say
   * *which* sign-in failed — "you are not an administrator" is confusing copy
   * to show somebody who clicked the Google button.
   */
  const isAdminFailure = searchParams.get('admin') === 'error'
  const failureReason =
    isAdminFailure || searchParams.get('auth') === 'error' ? searchParams.get('reason') : null

  /**
   * Strip the error parameters once read, so a refresh does not replay a stale
   * banner. `replace` keeps it out of the history stack.
   */
  useEffect(() => {
    if (!searchParams.has('auth') && !searchParams.has('admin')) return

    const next = new URLSearchParams(searchParams)
    next.delete('auth')
    next.delete('admin')
    next.delete('reason')
    setSearchParams(next, { replace: true })
    // Runs once per arrival with an `auth` parameter; adding searchParams here
    // would re-trigger it on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Wait for the session check before deciding anything.
  if (!auth.isReady) {
    return <LoadingScreen fullScreen message="Checking your session" />
  }

  // Already signed in — go where the user was originally headed.
  if (auth.authenticated) {
    const destination = location.state?.from ?? ROUTE_PATHS.DASHBOARD
    return <Navigate to={destination} replace />
  }

  return (
    <main className="grid min-h-svh place-items-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md">
        {/* --- Brand ------------------------------------------------------- */}
        <div className="mb-6 flex flex-col items-center text-center">
          <img
            src="/xplore-logo-mark.svg"
            alt=""
            aria-hidden="true"
            className="size-12 rounded-xl bg-white object-contain p-1 shadow-card"
          />
          <h1 className="mt-3 text-xl font-semibold tracking-tight text-slate-900">
            {env.appName}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Choose how you are signing in.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-card">
          {/* --- Callback failure ---------------------------------------- */}
          {failureReason && (
            <div
              role="alert"
              className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            >
              <p className="font-medium">
                {isAdminFailure ? 'Administrator sign-in was refused.' : 'Sign-in did not complete.'}
              </p>
              <p className="mt-0.5">
                {ERROR_MESSAGES[failureReason] ?? 'Sign-in could not be completed. Please try again.'}
              </p>
            </div>
          )}

          {/* --- API unreachable ---------------------------------------- */}
          {auth.hasApiError && (
            <div
              role="alert"
              className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
            >
              <p className="font-medium">Cannot reach the server.</p>
              <p className="mt-0.5">{auth.error?.message}</p>
            </div>
          )}

          {/* --- Google not configured ---------------------------------- */}
          {!auth.googleConfigured && !auth.hasApiError && (
            <div
              role="alert"
              className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
            >
              <p className="font-medium">Google sign-in is not configured.</p>
              <p className="mt-0.5">
                Add the OAuth client values to{' '}
                <code className="font-mono text-xs">backend/.env</code>. See{' '}
                <code className="font-mono text-xs">docs/GOOGLE_SETUP.md</code>.
              </p>
            </div>
          )}

          {/*
            Two doors, labelled by who they are for rather than by the provider.

            "Continue with Google" alone does not tell an administrator which
            button is theirs, and a person who picks the wrong one learns only
            after a full round trip to an identity provider. The caption under
            each is doing the real work here.
          */}
          <div className="space-y-3">
            <div>
              <Button
                variant="google"
                size="lg"
                fullWidth
                disabled={!auth.googleConfigured || auth.hasApiError}
                onClick={() =>
                  startGoogleSignIn({
                    returnPath: location.state?.from ?? ROUTE_PATHS.DASHBOARD,
                  })
                }
              >
                <GoogleIcon className="size-4" />
                Continue with Google
              </Button>
              <p className="mt-1.5 text-center text-xs text-slate-500">
                Employee portal &mdash; the CRM, your enquiries and your mailbox.
              </p>
            </div>

            <div className="flex items-center gap-3" aria-hidden="true">
              <span className="h-px flex-1 bg-slate-200" />
              <span className="text-[11px] uppercase tracking-wider text-slate-400">or</span>
              <span className="h-px flex-1 bg-slate-200" />
            </div>

            <div>
              <Button
                variant="secondary"
                size="lg"
                fullWidth
                disabled={!auth.configured || auth.hasApiError}
                onClick={startMicrosoftAdminSignIn}
              >
                <MicrosoftIcon className="size-4" />
                Continue with Microsoft
              </Button>
              <p className="mt-1.5 text-center text-xs text-slate-500">
                Organization Owner portal &mdash; administrators only.
              </p>
            </div>
          </div>

          {/*
            The legacy Microsoft path, shown ONLY while Google is unconfigured.

            Without it a deployment that has not yet created its Google OAuth
            client would have a login page with one disabled button and no way
            in — which is not "running normally". It disappears the moment
            Google is configured, so the finished product has exactly one
            sign-in method, as specified.

            The Microsoft OAuth routes themselves are untouched by this phase
            and remain how a mailbox is authorised in Phase 13.2.
          */}
          {/*
            `microsoftSignInAllowed` is the server's own policy, reported by
            `/auth/status`, not something inferred here.

            The previous condition — "Google is not configured" — was a proxy
            for it, and a proxy that could disagree with the server. The server
            is the only thing that knows whether a Microsoft sign-in will be
            honoured or bounced back with `microsoft_signin_disabled`, and a
            button that starts a flow the server refuses is worse than no
            button.
          */}
          {auth.microsoftSignInAllowed && auth.configured && !auth.hasApiError && (
            <>
              <div className="my-4 flex items-center gap-3">
                <span className="h-px flex-1 bg-slate-200" aria-hidden="true" />
                <span className="text-[11px] uppercase tracking-wider text-slate-400">
                  or use the previous method
                </span>
                <span className="h-px flex-1 bg-slate-200" aria-hidden="true" />
              </div>

              <Button
                variant="secondary"
                size="lg"
                fullWidth
                onClick={() =>
                  startMicrosoftSignIn({
                    returnPath: location.state?.from ?? ROUTE_PATHS.DASHBOARD,
                  })
                }
              >
                <MicrosoftIcon className="size-4" />
                Sign in with Microsoft
              </Button>
            </>
          )}

          {/* --- What is being requested -------------------------------- */}
          <div className="mt-6 border-t border-slate-100 pt-5">
            <p className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
              <ShieldCheck className="size-3.5 text-emerald-600" aria-hidden="true" />
              Google will share
            </p>
            <ul className="mt-2 space-y-1.5">
              {PERMISSION_SUMMARY.map((item) => (
                <li key={item} className="flex gap-2 text-xs text-slate-500">
                  <span className="text-slate-300" aria-hidden="true">
                    &#9679;
                  </span>
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-slate-400">
              Google is used to identify you, and nothing else — no access to Gmail, Drive,
              Calendar or Contacts is requested. Your password is handled by Google and never
              seen or stored by this application.
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}

export default LoginPage
