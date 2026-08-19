/**
 * Account — CRM identity and connected mailboxes.
 *
 * ## The two sections, and why they are two
 *
 * Before Phase 13.2 this page described one thing: "your Microsoft account",
 * which was simultaneously the person's CRM login and the mailbox the CRM sent
 * through. Google sign-in split those apart, and the page has to say so plainly,
 * because the distinction is the one thing a non-technical user must understand
 * here:
 *
 *   **Your profile**        — who am I in the CRM?              (Google)
 *   **Connected mailboxes** — which addresses can the CRM use?  (Microsoft)
 *
 * The wording is deliberately non-technical throughout. Nobody in an office
 * needs to read the words "OAuth", "token" or "Graph" to add a mailbox, so this
 * page says Connected, Default, Reconnect and Disconnect and nothing else.
 *
 * The page is useful with zero mailboxes. That is the normal state immediately
 * after a first Google sign-in, and it is the state from which the primary
 * action here — connecting one — is taken.
 */

import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import {
  disconnectMailbox,
  setDefaultMailbox,
  startMailboxConnect,
} from '@/api/services/mailbox.service'
import { Card } from '@/components/common/Card'
import { DocumentCenter } from '@/components/profile/DocumentCenter'
import { SignatureEditor } from '@/components/profile/SignatureEditor'
import { ProfileCompletion } from '@/components/profile/ProfileCompletion'
import {
  ProfileDetailCards,
  ProfileOverviewCard,
} from '@/components/profile/EmployeeProfileSections'
import { PerformanceDashboard } from '@/admin/components/performance/PerformanceDashboard'
import {
  deleteMyDocument,
  documentFileUrl,
  fetchMyDocuments,
  fetchMyPerformance,
  fetchMyProfile,
  removeMyPhoto,
  updateMyDocument,
  updateMyProfile,
  uploadMyDocument,
  uploadMyPhoto,
} from '@/api/services/profile.service'
import { GoogleIcon } from '@/components/common/GoogleIcon'
import { MicrosoftIcon } from '@/components/common/MicrosoftIcon'
import { Button } from '@/components/ui/Button'
import { useApiResource } from '@/hooks/useApiResource'
import { useAuth } from '@/hooks/useAuth'
import { ROUTE_PATHS } from '@/routes/paths'

/** Explains a failed mailbox connection in words an office user can act on. */
const CONNECT_ERRORS = {
  access_denied: 'Sign-in was cancelled, or permission was not granted.',
  flow_invalid: 'That connection link had expired or was already used. Please try again.',
  session_required: 'Your CRM session ended before the mailbox was connected. Sign in and try again.',
  owned_elsewhere: 'That mailbox is already connected to a different CRM account.',
  not_configured: 'Microsoft is not set up on this server yet.',
  exchange_failed: 'Microsoft could not complete the connection. Please try again.',
  profile_failed: 'The mailbox was connected but its details could not be read.',
  consent_required: 'Extra permission is needed. Ask an administrator to approve this app.',
  /**
   * Microsoft rejected the authorization code.
   *
   * Almost always an expired or already-used code — the user sat on the consent
   * screen, or came back via the Back button. Worth its own wording because the
   * remedy is simply to try again, which a bare "UNAUTHORIZED" does not convey.
   */
  UNAUTHORIZED: 'That connection attempt expired or had already been used. Please try again.',
  account_mismatch:
    'That is a different Microsoft account. To reconnect a mailbox, sign in with that same address — ' +
    'or use “Connect Microsoft mailbox” to add a new one.',
  target_missing: 'The mailbox you were reconnecting is no longer in your list.',
  use_connect_mailbox:
    'Use “Connect Microsoft mailbox” below. Signing in with Microsoft no longer changes who you are in the CRM.',
}

/** Per-status presentation for a mailbox row. */
const STATUS_STYLES = {
  connected: { label: 'Connected', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  degraded: { label: 'Needs attention', className: 'bg-amber-50 text-amber-800 ring-amber-200' },
  expired: { label: 'Needs reconnecting', className: 'bg-amber-50 text-amber-800 ring-amber-200' },
  error: { label: 'Unavailable', className: 'bg-red-50 text-red-700 ring-red-200' },
  disconnected: { label: 'Disconnected', className: 'bg-slate-100 text-slate-600 ring-slate-200' },
  not_configured: { label: 'Not set up', className: 'bg-slate-100 text-slate-600 ring-slate-200' },
}

function StatusPill({ status }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.disconnected

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${style.className}`}
    >
      {style.label}
    </span>
  )
}

/** Formats an ISO date as a readable local string. */
function formatDate(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toLocaleString()
}

/**
 * One connected mailbox.
 *
 * Disconnect asks for confirmation, because it is the only irreversible control
 * on the page — reconnecting means going back through Microsoft. The wording
 * states what is *not* affected, since "disconnect" reads to most people as if
 * it might take their mail history with it.
 */
function MailboxRow({ mailbox, isBusy, onSetDefault, onDisconnect }) {
  const needsReconnect = !mailbox.canSend

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3.5">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <MicrosoftIcon className="size-3.5 shrink-0" />
          <span className="truncate text-sm font-medium text-slate-900">
            {mailbox.emailAddress ?? mailbox.displayName ?? 'Microsoft mailbox'}
          </span>
          {mailbox.isDefault && (
            <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700 ring-1 ring-inset ring-brand-200">
              Default
            </span>
          )}
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <StatusPill status={mailbox.status} />
          {mailbox.isDefault && <span>Automatic emails are sent from here.</span>}
          {!mailbox.isDefault && mailbox.connectedAt && (
            <span>Connected {formatDate(mailbox.connectedAt)}</span>
          )}

          {/*
            Account stays the registry; Provider holds the technical detail —
            folders, sync state, run history. The link carries the mailbox id so
            that page opens on this one rather than the workspace default.
          */}
          <Link
            to={`${ROUTE_PATHS.PROVIDER}?mailbox=${mailbox.id}`}
            className="font-medium text-brand-600 underline-offset-2 hover:underline"
          >
            View sync details
          </Link>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {needsReconnect ? (
          /*
            Reconnect names the mailbox it is repairing.
            Without `mailboxId` the server cannot tell a repair from an addition,
            and signing in with a different Microsoft account would overwrite
            this row's identity instead of being refused.
          */
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              startMailboxConnect({ returnPath: ROUTE_PATHS.ACCOUNT, mailboxId: mailbox.id })
            }
          >
            Reconnect
          </Button>
        ) : (
          !mailbox.isDefault && (
            <Button
              variant="secondary"
              size="sm"
              disabled={isBusy}
              onClick={() => onSetDefault(mailbox)}
            >
              Set as default
            </Button>
          )
        )}

        <Button
          variant="ghost"
          size="sm"
          disabled={isBusy}
          onClick={() => onDisconnect(mailbox)}
          className="text-red-600 hover:bg-red-50 hover:text-red-700"
        >
          Disconnect
        </Button>
      </div>
    </li>
  )
}

export function AccountPage() {
  const auth = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  /**
   * The employee profile (Phase 17.2).
   *
   * `draft` mirrors the server's shape so a section can be edited without a
   * per-field state tree. It is re-seeded from every successful read, so a
   * cancelled edit reverts to what the server actually holds rather than to
   * whatever was typed before.
   */
  const profileLoader = useCallback((options) => fetchMyProfile(options), [])
  const profile = useApiResource(profileLoader)

  /**
   * Your own performance (Phase 17.3).
   *
   * The same payload your manager sees for you, from the same engine. A system
   * that scores people and then hides the score from them is one nobody should
   * build, and two engines — one for the console, one for the employee — would
   * eventually show you a different number from the one you are judged on.
   */
  const performanceLoader = useCallback(
    (options) => fetchMyPerformance({ ...options, range: { preset: 'last30' } }),
    [],
  )
  const performance = useApiResource(performanceLoader)

  const documentLoader = useCallback((options) => fetchMyDocuments(options), [])
  const documents = useApiResource(documentLoader)

  const [draft, setDraft] = useState({})

  useEffect(() => {
    if (!profile.data) return

    setDraft({
      phone: profile.data.phone,
      employeeId: profile.data.employeeId,
      department: profile.data.department,
      designation: profile.data.designation,
      dateOfBirth: profile.data.dateOfBirth,
      gender: profile.data.gender,
      address: { ...profile.data.address },
      emergencyContact: { ...profile.data.emergencyContact },
    })
  }, [profile.data])

  /**
   * Saves the draft.
   *
   * Empty strings become `null` so clearing a field actually clears it — the
   * schema treats `""` as "no value", and sending it would leave the old value
   * in place on some paths and store an empty string on others.
   */
  const saveProfile = useCallback(async () => {
    const clean = (value) =>
      typeof value === 'string' ? (value.trim() || null) : value

    const patch = {
      phone: clean(draft.phone),
      employeeId: clean(draft.employeeId),
      department: clean(draft.department),
      designation: clean(draft.designation),
      dateOfBirth: clean(draft.dateOfBirth),
      gender: clean(draft.gender),
      address: Object.fromEntries(
        Object.entries(draft.address ?? {}).map(([key, value]) => [key, clean(value)]),
      ),
      emergencyContact: Object.fromEntries(
        Object.entries(draft.emergencyContact ?? {}).map(([key, value]) => [key, clean(value)]),
      ),
    }

    await updateMyProfile(patch)
    await profile.refresh()
  }, [draft, profile])

  const [isSigningOut, setIsSigningOut] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [feedback, setFeedback] = useState(null)

  const mailboxResult = searchParams.get('mailbox')
  const failureReason = searchParams.get('reason')
  const connectedAddress = searchParams.get('address')

  /**
   * The connect callback returns with `?mailbox=connected|reconnected|error`.
   * Once read, the parameters are stripped so a refresh does not replay a stale
   * banner.
   */
  useEffect(() => {
    if (!mailboxResult) return

    if (mailboxResult === 'connected' || mailboxResult === 'reconnected') {
      setFeedback({
        tone: 'success',
        message:
          mailboxResult === 'reconnected'
            ? `${connectedAddress ?? 'That mailbox'} was reconnected.`
            : `${connectedAddress ?? 'The mailbox'} is now connected.`,
      })
      auth.refresh()
    } else {
      setFeedback({
        tone: 'error',
        message:
          CONNECT_ERRORS[failureReason] ??
          `The mailbox could not be connected (${failureReason ?? 'unknown error'}).`,
      })
    }

    const next = new URLSearchParams(searchParams)
    next.delete('mailbox')
    next.delete('reason')
    next.delete('address')
    setSearchParams(next, { replace: true })
    // Runs once per callback arrival; including `auth` or `searchParams` would
    // re-trigger it on every refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mailboxResult])

  const handleSetDefault = useCallback(
    async (mailbox) => {
      setBusyId(mailbox.id)
      setFeedback(null)
      try {
        await setDefaultMailbox(mailbox.id)
        await auth.refresh()
        setFeedback({
          tone: 'success',
          message: `${mailbox.emailAddress ?? 'That mailbox'} is now the default sender.`,
        })
      } catch (error) {
        // `httpClient` normalises every failure to a `message`, and the server
        // words these to be actionable, so it is shown as-is.
        setFeedback({ tone: 'error', message: error?.message ?? 'That did not work.' })
      } finally {
        setBusyId(null)
      }
    },
    [auth],
  )

  const handleDisconnect = useCallback(
    async (mailbox) => {
      const address = mailbox.emailAddress ?? 'this mailbox'

      // eslint-disable-next-line no-alert
      const confirmed = window.confirm(
        `Disconnect ${address}?\n\n` +
          'The CRM will stop sending and reading mail through it. ' +
          'Your mail history, leads, companies and campaigns are all kept.',
      )
      if (!confirmed) return

      setBusyId(mailbox.id)
      setFeedback(null)
      try {
        await disconnectMailbox(mailbox.id)
        await auth.refresh()
        setFeedback({ tone: 'success', message: `${address} was disconnected.` })
      } catch (error) {
        // `httpClient` normalises every failure to a `message`, and the server
        // words these to be actionable, so it is shown as-is.
        setFeedback({ tone: 'error', message: error?.message ?? 'That did not work.' })
      } finally {
        setBusyId(null)
      }
    },
    [auth],
  )

  const handleSignOut = async () => {
    setIsSigningOut(true)
    try {
      await auth.signOut()
    } finally {
      setIsSigningOut(false)
    }
  }

  const mailboxes = auth.mailboxes ?? []
  const signedInWithGoogle = auth.user?.provider === 'google'

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Account</h1>
        <p className="mt-1 text-sm text-slate-500">
          Your CRM profile, and the mailboxes this CRM can send and receive email through.
        </p>
      </div>

      {/* --- Result of a connect attempt, or an action on this page ------ */}
      {feedback && (
        <div
          role="alert"
          className={
            feedback.tone === 'success'
              ? 'rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800'
              : 'rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800'
          }
        >
          {feedback.message}
        </div>
      )}

      {auth.hasApiError && (
        <div
          role="alert"
          className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          <p className="font-medium">Could not reach the API.</p>
          <p className="mt-0.5">{auth.error?.message}</p>
        </div>
      )}

      {/* --- Employee profile (Phase 17.2) --------------------------------
          Placed above the CRM/mailbox sections: this is the page a person
          opens to manage *themselves*, and the mailbox plumbing below is a
          setting rather than an identity. */}
      {profile.error ? (
        <Card title="Your employee profile">
          <p role="alert" className="text-sm text-red-700">
            {profile.error.message}
          </p>
        </Card>
      ) : profile.isLoading || !profile.data ? (
        <div className="space-y-4">
          <div className="skeleton h-36" />
          <div className="skeleton h-24" />
        </div>
      ) : (
        <div className="space-y-4">
          <ProfileOverviewCard
            profile={profile.data}
            canEdit
            onPhoto={async (file) => {
              await uploadMyPhoto(file)
              await profile.refresh()
            }}
            onRemovePhoto={async () => {
              await removeMyPhoto()
              await profile.refresh()
            }}
          />

          <Card title="Profile completion">
            <ProfileCompletion completion={profile.data.completion} />
          </Card>

          <ProfileDetailCards
            profile={profile.data}
            draft={draft}
            setDraft={setDraft}
            canEdit
            onSave={saveProfile}
          />

          <SignatureEditor />

          <Card
            title="Documents"
            description="Identity documents and your résumé. An administrator reviews each one."
          >
            <DocumentCenter
              data={documents.data}
              isLoading={documents.isLoading}
              mode="employee"
              fileUrl={documentFileUrl}
              onUpload={async (file, meta) => {
                await uploadMyDocument(file, meta)
                await documents.refresh()
              }}
              onReplace={async (id, file) => {
                await updateMyDocument(id, { file })
                await documents.refresh()
              }}
              onDelete={async (id) => {
                await deleteMyDocument(id)
                await documents.refresh()
              }}
            />
          </Card>

          <Card
            title="Your performance"
            description="The last 30 days, derived from your own mail, campaigns, enquiries and recorded actions. This is exactly what an administrator sees for you."
          >
            {performance.error ? (
              <p role="alert" className="text-sm text-red-700">
                {performance.error.message ?? 'Your performance could not be loaded.'}
              </p>
            ) : (
              <PerformanceDashboard
                data={performance.data}
                isLoading={performance.isInitialLoading}
                audience="self"
              />
            )}
          </Card>
        </div>
      )}

      {/* --- Section 1 — CRM profile ------------------------------------- */}
      <Card title="Your profile" description="Who you are signed in as in this CRM.">
        {auth.authenticated && auth.user ? (
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900">
                {auth.user.displayName ?? 'Signed in'}
              </p>
              <p className="mt-0.5 truncate text-sm text-slate-500">{auth.user.email}</p>

              <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-slate-600">
                {signedInWithGoogle ? (
                  <>
                    <GoogleIcon className="size-3.5" />
                    Signed in with Google
                  </>
                ) : (
                  <>
                    <MicrosoftIcon className="size-3.5" />
                    Signed in with Microsoft
                  </>
                )}
                <span aria-hidden="true" className="text-emerald-600">
                  ✓
                </span>
              </p>

              {auth.user.roleLabel && (
                <p className="mt-1 text-xs text-slate-400">{auth.user.roleLabel}</p>
              )}
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={handleSignOut}
              isLoading={isSigningOut}
              loadingLabel="Signing out…"
            >
              Sign out
            </Button>
          </div>
        ) : (
          <p className="text-sm text-slate-500">You are not signed in.</p>
        )}
      </Card>

      {/* --- Section 2 — Connected mailboxes ----------------------------- */}
      <Card
        title="Connected mailboxes"
        description="The email addresses this CRM can send from and read replies in."
      >
        {mailboxes.length === 0 ? (
          <div className="py-2">
            <p className="text-sm font-medium text-slate-900">
              No Microsoft mailboxes connected.
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Connect a mailbox to send and receive email through the CRM. Everything else in
              the CRM works without one.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {mailboxes.map((mailbox) => (
              <MailboxRow
                key={mailbox.id}
                mailbox={mailbox}
                isBusy={busyId === mailbox.id}
                onSetDefault={handleSetDefault}
                onDisconnect={handleDisconnect}
              />
            ))}
          </ul>
        )}

        <div className="mt-4 border-t border-slate-100 pt-4">
          <Button
            variant="microsoft"
            size="md"
            disabled={!auth.isReady || !auth.configured || !auth.authenticated}
            onClick={() => startMailboxConnect({ returnPath: ROUTE_PATHS.ACCOUNT })}
          >
            <MicrosoftIcon className="size-4" />
            Connect Microsoft mailbox
          </Button>

          {auth.isReady && !auth.configured && (
            <p className="mt-2 text-xs text-amber-700">
              Microsoft is not set up on this server, so no mailbox can be connected yet.
            </p>
          )}

          {mailboxes.length > 0 && (
            <p className="mt-2 text-xs text-slate-500">
              You can connect more than one. Microsoft will ask which account to use.
            </p>
          )}
        </div>
      </Card>

      {/* --- Permissions this app requests -------------------------------- */}
      {auth.scopesRequested?.length > 0 && (
        <Card
          title="Permissions requested"
          description="Granted by you when you connect a mailbox. No calendar access is requested."
        >
          <ul className="flex flex-wrap gap-2">
            {auth.scopesRequested.map((scope) => (
              <li
                key={scope}
                className="rounded-md bg-slate-100 px-2 py-1 font-mono text-xs text-slate-700"
              >
                {scope}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}

export default AccountPage
