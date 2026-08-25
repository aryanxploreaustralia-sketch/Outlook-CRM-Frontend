/**
 * Provider connection and synchronisation control.
 *
 * The operator's view of the integration: what is connected, what its
 * credentials look like, when it last synced, and the controls to connect,
 * disconnect and sync.
 *
 * Deliberately reports state it would be easy to hide — a degraded connection, a
 * failed folder, an expiring token — because those are exactly what someone
 * opens this page to find out.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  FolderTree,
  History,
  Link2,
  Link2Off,
  Mailbox,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react'

import { validateConnection } from '@/api/services/provider.service'
import { ErrorScreen } from '@/components/common/ErrorScreen'
import { ConnectionBadge, SyncBadge } from '@/components/provider/ProviderBadge'
import { MailboxSelector } from '@/components/provider/MailboxSelector'
import { MockModeBanner } from '@/components/provider/MockModeBanner'
import { CardRow, StatusCard } from '@/components/dashboard/StatusCard'
import { Button } from '@/components/ui/Button'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { formatDateTime, formatRelative } from '@/constants/provider.constants'
import { SystemStatusCard } from '@/components/dashboard/SystemStatusCard'
import { useAccountStatus } from '@/hooks/useAccountStatus'
import { useProvider } from '@/hooks/useProvider'
import { ROUTE_PATHS } from '@/routes/paths'
import { resolveErrorVariant } from '@/utils/apiError'

/** Folders offered as individual sync targets. */
const SYNC_TARGETS = [
  { folder: null, label: 'Sync everything' },
  { folder: 'inbox', label: 'Inbox' },
  { folder: 'sent', label: 'Sent' },
  { folder: 'drafts', label: 'Drafts' },
  { folder: 'archive', label: 'Archive' },
]

export function ProviderPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  /**
   * The selected mailbox lives in the URL.
   *
   * `?mailbox=<id>` rather than component state, so a refresh keeps the
   * selection, Back and Forward move between mailboxes, and the Account page
   * can link straight to one mailbox's technical detail. It is an opaque
   * database id — never a token, never an address.
   */
  const selectedId = searchParams.get('mailbox')

  /*
   * Platform reachability, moved here from the dashboard.
   *
   * `/account/status` already returned `backend`, `database` and `graph`; the
   * dashboard was the page rendering them. This is the integration page, and
   * "is Graph answering" is the question it exists to answer — so the card
   * lives here now. Existing hook, existing endpoint, no new request shape.
   */
  const accountStatus = useAccountStatus()

  const {
    status,
    mailboxes,
    isInitialLoading,
    isError,
    error,
    refresh,
    isMockMode,
    action,
    isBusy,
    actionError,
    lastRun,
    // `connect` is deliberately not taken: connecting and reconnecting are
    // mailbox-targeted flows that live on Account. The hook still exposes it
    // for the dashboard's status card, which has no mailbox context.
    disconnect,
    sync,
  } = useProvider({ mailboxId: selectedId })

  const [probe, setProbe] = useState(null)
  const [isProbing, setIsProbing] = useState(false)

  const mailbox = status?.mailbox
  const isConnected = status?.connected

  /**
   * Which mailbox the page settles on when the URL names none.
   *
   * Default sender if it is usable, else any connected mailbox, else the first
   * registered one — so the page opens on something actionable rather than on a
   * broken mailbox that happens to sort first.
   */
  const initialId = useMemo(() => {
    if (mailboxes.length === 0) return null

    const preferred = mailboxes.find((box) => box.isDefault && box.canSend)
    const connected = mailboxes.find((box) => box.canSend)

    return (preferred ?? connected ?? mailboxes[0]).id
  }, [mailboxes])

  /**
   * Writes that choice into the URL once it is known.
   *
   * `replace` keeps it out of history: landing on `/provider` and being given a
   * mailbox is not a navigation the user made, so Back should leave the page
   * rather than undo a selection they never chose.
   */
  useEffect(() => {
    if (selectedId || !initialId) return

    const next = new URLSearchParams(searchParams)
    next.set('mailbox', initialId)
    setSearchParams(next, { replace: true })
  }, [selectedId, initialId, searchParams, setSearchParams])

  /**
   * A mailbox id in the URL that is not this workspace's.
   *
   * The server answers 404 for it, so rather than leaving the page in an error
   * state the selection is dropped and the default takes over.
   */
  useEffect(() => {
    if (!selectedId || mailboxes.length === 0) return
    if (mailboxes.some((box) => box.id === selectedId)) return

    const next = new URLSearchParams(searchParams)
    next.delete('mailbox')
    setSearchParams(next, { replace: true })
  }, [selectedId, mailboxes, searchParams, setSearchParams])

  const handleSelect = useCallback(
    (id) => {
      const next = new URLSearchParams(searchParams)
      next.set('mailbox', id)
      // A real navigation this time, so Back returns to the previous mailbox.
      setSearchParams(next)
      // The previous mailbox's probe result must not linger under a new heading.
      setProbe(null)
    },
    [searchParams, setSearchParams],
  )

  /**
   * Live round trip, distinct from the stored status this page renders.
   *
   * Scoped to the selected mailbox, and the response reports the address
   * Microsoft answered with — so the result is evidence of which credential was
   * used rather than an echo of what was asked.
   */
  const handleValidate = useCallback(async () => {
    setIsProbing(true)
    setProbe(null)
    try {
      setProbe(await validateConnection({ mailboxId: selectedId }))
    } catch (caught) {
      setProbe({ status: 'error', reason: caught?.message ?? 'Validation failed.' })
    } finally {
      setIsProbing(false)
    }
  }, [selectedId])

  const handleDisconnect = useCallback(() => {
    const address = mailbox?.emailAddress ?? 'this mailbox'
    if (
      !window.confirm(
        `Disconnect ${address}?\n\nSynced messages are kept, and it stays listed on Account so you can reconnect it.`,
      )
    ) {
      return
    }
    void disconnect()
  }, [disconnect, mailbox])

  if (isError && !status) {
    return (
      <ErrorScreen variant={resolveErrorVariant(error)} message={error?.message} onRetry={refresh} />
    )
  }

  if (isInitialLoading) {
    return (
      <div className="space-y-5" aria-busy="true">
        <div className="h-6 w-64 animate-pulse rounded-md bg-slate-200/80" />
        <div className="grid gap-5 lg:grid-cols-2">
          <SkeletonCard rows={4} />
          <SkeletonCard rows={4} />
        </div>
      </div>
    )
  }

  const token = status?.token
  const sync_ = status?.sync

  /**
   * No mailboxes at all — an empty state, not an error.
   *
   * A workspace that has connected nothing has nothing for this page to
   * describe, and the useful response is the one action that changes that.
   */
  if (mailboxes.length === 0) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
            Mail provider
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Connection, credentials and mailbox synchronisation.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white px-5 py-8 text-center shadow-card">
          <Mailbox className="mx-auto size-8 text-slate-300" aria-hidden="true" />
          <p className="mt-3 text-sm font-medium text-slate-900">
            No Microsoft mailboxes have been connected.
          </p>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
            Connect one from Account to synchronise folders and send mail through the CRM.
          </p>
          <Button as={Link} to={ROUTE_PATHS.ACCOUNT} variant="primary" size="sm" className="mt-4">
            <Link2 className="size-3.5" aria-hidden="true" />
            Connect Microsoft mailbox
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* --- Heading -------------------------------------------------------- */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
            Mail provider
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Connection, credentials and mailbox synchronisation.
          </p>
        </div>

        {/* Both carry the selection, so the sub-pages open on the same mailbox. */}
        <div className="flex flex-wrap gap-2">
          <Button
            as={Link}
            to={`${ROUTE_PATHS.PROVIDER_FOLDERS}${selectedId ? `?mailbox=${selectedId}` : ''}`}
            variant="secondary"
            size="sm"
          >
            <FolderTree className="size-4" aria-hidden="true" />
            Folders
          </Button>
          <Button
            as={Link}
            to={`${ROUTE_PATHS.PROVIDER_HISTORY}${selectedId ? `?mailbox=${selectedId}` : ''}`}
            variant="secondary"
            size="sm"
          >
            <History className="size-4" aria-hidden="true" />
            Sync history
          </Button>
        </div>
      </div>

      {/* --- Mailbox selector ------------------------------------------------ */}
      <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-card">
        <MailboxSelector
          mailboxes={mailboxes}
          selectedId={selectedId}
          onSelect={handleSelect}
          disabled={isBusy || isProbing}
        />
        <p className="mt-2 text-xs text-slate-500">
          Everything below refers to this mailbox. Changing it does not change which mailbox the
          CRM sends from — that is the default sender, set on{' '}
          <Link to={ROUTE_PATHS.ACCOUNT} className="underline underline-offset-2 hover:text-slate-700">
            Account
          </Link>
          .
        </p>
      </div>

      {/* --- Selected mailbox is not usable ---------------------------------- */}
      {!isConnected && mailbox && (
        <div
          role="status"
          className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-medium">
                {mailbox.emailAddress ?? 'This mailbox'} is {mailbox.statusReason === 'user_disconnected' ? 'disconnected' : 'not currently usable'}.
              </p>
              <p className="mt-0.5">
                Synchronising and testing need a live connection. Its folders and history below are
                the last known state.
              </p>
            </div>
          </div>

          <Button
            as={Link}
            to={ROUTE_PATHS.ACCOUNT}
            variant="secondary"
            size="sm"
            className="shrink-0"
          >
            Reconnect on Account
          </Button>
        </div>
      )}

      {isMockMode && <MockModeBanner reason={status?.fallbackReason} />}

      {actionError && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-medium">{actionError.message}</p>
            {actionError.code && (
              <p className="mt-0.5 font-mono text-xs text-red-700">{actionError.code}</p>
            )}
          </div>
        </div>
      )}

      {/* --- Last run summary ---------------------------------------------- */}
      {lastRun && (
        <div
          role="status"
          className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${
            lastRun.status === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : lastRun.status === 'partial'
                ? 'border-amber-200 bg-amber-50 text-amber-800'
                : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          {lastRun.status === 'success' ? (
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          ) : (
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          )}
          <div className="min-w-0 flex-1">
            <p className="font-medium">
              {lastRun.statusLabel} — {lastRun.totals.messagesCreated} new,{' '}
              {lastRun.totals.messagesUpdated} updated, {lastRun.totals.messagesSkipped} unchanged
            </p>
            {lastRun.errors?.length > 0 && (
              <ul className="mt-1 list-inside list-disc text-xs">
                {lastRun.errors.map((entry, index) => (
                  <li key={index}>
                    {entry.folder ? `${entry.folder}: ` : ''}
                    {entry.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* --- Platform status ------------------------------------------------ */}
      <SystemStatusCard
        status={accountStatus.status}
        isRefreshing={accountStatus.isLoading}
        onRefresh={accountStatus.refresh}
      />

      {/* --- Cards ---------------------------------------------------------- */}
      <div className="grid gap-5 lg:grid-cols-2">
        <StatusCard
          title="Connection"
          description={status?.provider?.label ?? 'No provider connected'}
          icon={Link2}
          iconTone="bg-blue-50 text-blue-600 ring-blue-600/10"
          badge={<ConnectionBadge status={mailbox?.status ?? 'disconnected'} size="sm" />}
          footer={
            <div className="flex flex-wrap gap-2">
              {isConnected ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleDisconnect}
                  isLoading={action === 'disconnect'}
                  disabled={isBusy}
                >
                  <Link2Off className="size-3.5" aria-hidden="true" />
                  Disconnect
                </Button>
              ) : (
                /*
                  Reconnecting happens on Account, where the flow can be bound to
                  this specific mailbox and refuse a different Microsoft account.
                  The legacy `/provider/connect` button is not offered here: it
                  adopts whatever the *session* is attached to, which for a
                  Google session is nothing, and could never repair a named
                  mailbox.
                */
                <Button as={Link} to={ROUTE_PATHS.ACCOUNT} size="sm" disabled={isBusy}>
                  <Link2 className="size-3.5" aria-hidden="true" />
                  Reconnect on Account
                </Button>
              )}

              <Button
                variant="secondary"
                size="sm"
                onClick={handleValidate}
                isLoading={isProbing}
                // Needs a live connection: probing a disconnected mailbox can
                // only ever report the failure the badge already shows.
                disabled={isBusy || !isConnected}
                title={!isConnected ? 'Reconnect this mailbox first' : undefined}
              >
                <ShieldCheck className="size-3.5" aria-hidden="true" />
                Test connection
              </Button>
            </div>
          }
        >
          <CardRow label="Mailbox" value={mailbox?.emailAddress} />
          <CardRow label="Account" value={mailbox?.displayName} />
          <CardRow label="Provider" value={status?.provider?.label} />
          <CardRow label="Connected" value={formatDateTime(mailbox?.connectedAt)} />
          {mailbox?.statusReason && (
            <CardRow label="Reason" value={mailbox.statusReason} />
          )}
          {probe && (
            <CardRow
              label="Live probe"
              value={
                <span className={probe.status === 'connected' ? 'text-emerald-700' : 'text-red-700'}>
                  {probe.status === 'connected' ? 'Reachable' : (probe.reason ?? probe.status)}
                </span>
              }
            />
          )}

          {/*
            The address Microsoft answered with.

            Shown because it is the evidence that the probe used *this*
            mailbox's credential — with several mailboxes in one workspace, a
            result that merely repeated the address we asked about would prove
            nothing. A mismatch is called out loudly: it would mean a credential
            is attached to the wrong registry row.
          */}
          {probe?.verifiedAs && (
            <CardRow
              label="Authenticated as"
              value={
                <span
                  className={probe.identityMatches === false ? 'text-red-700' : 'text-slate-900'}
                >
                  {probe.verifiedAs}
                  {probe.identityMatches === false && ' — does not match this mailbox'}
                </span>
              }
            />
          )}
        </StatusCard>

        <StatusCard
          title="Credentials"
          description="Token lifecycle for this connection"
          icon={ShieldCheck}
          iconTone="bg-teal-50 text-teal-600 ring-teal-600/10"
        >
          <CardRow label="Status" value={token?.status ?? 'Not established'} />
          <CardRow label="Expires" value={formatDateTime(token?.expiresAt)} />
          <CardRow
            label="Expires in"
            value={
              token?.expiresInSeconds != null
                ? `${Math.floor(token.expiresInSeconds / 60)} minutes`
                : null
            }
          />
          <CardRow label="Last refresh" value={formatDateTime(token?.lastRefresh)} />
          <CardRow
            label="Managed by"
            value={token?.managedByMsal ? 'MSAL token cache' : 'Provider record'}
          />
          {token?.refreshFailureCount > 0 && (
            <CardRow label="Refresh failures" value={String(token.refreshFailureCount)} />
          )}
        </StatusCard>
      </div>

      {/* --- Synchronisation ------------------------------------------------ */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-violet-50 text-violet-600 ring-1 ring-inset ring-violet-600/10">
              <RefreshCw className="size-[18px]" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Synchronisation</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                {sync_?.totalMessagesSynced ?? 0} messages synced across{' '}
                {sync_?.folderCount ?? 0} folders
              </p>
            </div>
          </div>

          <SyncBadge status={sync_?.status ?? 'idle'} size="sm" />
        </header>

        <div className="grid gap-4 px-5 py-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-slate-500">Last sync</p>
            <p className="mt-0.5 text-sm font-medium text-slate-900">
              {formatRelative(sync_?.lastSyncAt)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Last successful</p>
            <p className="mt-0.5 text-sm font-medium text-slate-900">
              {formatRelative(sync_?.lastSuccessfulSyncAt)}
            </p>
          </div>
          <div>
            <p className="flex items-center gap-1 text-xs text-slate-500">
              <Clock className="size-3" aria-hidden="true" />
              Next sync
            </p>
            {/* Stated as advisory: no scheduler runs in this phase, and implying
                one would promise behaviour the system does not have. */}
            <p className="mt-0.5 text-sm font-medium text-slate-900">
              {sync_?.nextSyncAt ? `${formatRelative(sync_.nextSyncAt)} (manual)` : 'Manual only'}
            </p>
          </div>
        </div>

        {/* Per-folder state */}
        {sync_?.folders?.length > 0 && (
          <div className="border-t border-slate-100 px-5 py-3">
            <p className="mb-2 text-xs font-medium text-slate-600">Folder state</p>
            <ul className="grid gap-1.5 sm:grid-cols-2">
              {sync_.folders.map((folder) => (
                <li
                  key={folder.id}
                  className="flex items-center justify-between gap-2 rounded-md bg-slate-50 px-3 py-1.5"
                >
                  <span className="truncate text-xs capitalize text-slate-700">{folder.folder}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400">
                      {folder.messagesSynced} msgs
                    </span>
                    <SyncBadge status={folder.syncStatus} size="sm" />
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3">
          {SYNC_TARGETS.map(({ folder, label }) => (
            <Button
              key={label}
              variant={folder === null ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => sync(folder)}
              isLoading={action === `sync:${folder ?? 'all'}`}
              disabled={isBusy || !isConnected}
              title={!isConnected ? 'Connect a mailbox first' : undefined}
            >
              <RefreshCw className="size-3.5" aria-hidden="true" />
              {label}
            </Button>
          ))}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => sync(null, 'full')}
            isLoading={action === 'sync:all'}
            disabled={isBusy || !isConnected}
            title="Ignore stored sync tokens and re-read every folder"
          >
            Full resync
          </Button>
        </div>
      </section>
    </div>
  )
}

export default ProviderPage
