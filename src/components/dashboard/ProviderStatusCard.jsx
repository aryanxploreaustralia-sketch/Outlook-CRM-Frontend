/**
 * Provider status on the dashboard.
 *
 * Answers the five questions someone glances at a dashboard for: is it
 * connected, to what, when did it last sync, when will it sync next, and did
 * anything go wrong. Anything deeper belongs on the provider page, which this
 * links to.
 *
 * Fetches its own data rather than taking it from the dashboard payload: the
 * status endpoint performs no provider round trip, and keeping it separate means
 * the rest of the dashboard is not held up if the provider module is slow.
 */

import { Link } from 'react-router-dom'
import { AlertTriangle, Cloud, FolderTree, Inbox, RefreshCw } from 'lucide-react'

import { ConnectionBadge, SyncBadge } from '@/components/provider/ProviderBadge'
import { Button } from '@/components/ui/Button'
import { formatRelative } from '@/constants/provider.constants'
import { useProvider } from '@/hooks/useProvider'
import { ROUTE_PATHS } from '@/routes/paths'

/** One figure in the counter row. */
function Stat({ label, value, tone = 'text-slate-900' }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[11px] text-slate-500">{label}</p>
      <p className={`truncate text-sm font-semibold ${tone}`}>{value}</p>
    </div>
  )
}

export function ProviderStatusCard() {
  const { status, isInitialLoading, isMockMode, action, isBusy, sync } = useProvider()

  if (isInitialLoading) {
    return (
      <section
        className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card"
        aria-busy="true"
      >
        <div className="border-b border-slate-100 px-5 py-4">
          <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
        </div>
        <div className="space-y-3 px-5 py-4">
          <div className="h-8 w-full animate-pulse rounded bg-slate-100" />
          <div className="h-8 w-full animate-pulse rounded bg-slate-100" />
        </div>
      </section>
    )
  }

  const mailbox = status?.mailbox
  const sync_ = status?.sync
  const errorCount = sync_?.errorCount ?? 0
  const isConnected = status?.connected

  return (
    <section className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
      <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-sky-50 text-sky-600 ring-1 ring-inset ring-sky-600/10">
            <Cloud className="size-[18px]" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-slate-900">Mail provider</h2>
            <p className="truncate text-xs text-slate-500">
              {status?.provider?.label ?? 'No provider connected'}
            </p>
          </div>
        </div>

        <ConnectionBadge status={mailbox?.status ?? 'disconnected'} size="sm" />
      </header>

      <div className="flex-1 px-5 py-4">
        {isMockMode && (
          <p className="mb-3 rounded-md bg-violet-50 px-2.5 py-1.5 text-[11px] text-violet-800 ring-1 ring-inset ring-violet-600/20">
            Simulated data — no live mailbox is configured.
          </p>
        )}

        <dl className="mb-3 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-xs text-slate-500">Connected account</dt>
            <dd
              className="min-w-0 truncate text-right text-sm font-medium text-slate-900"
              title={mailbox?.emailAddress ?? undefined}
            >
              {mailbox?.emailAddress ?? <span className="text-slate-400">Not connected</span>}
            </dd>
          </div>

          <div className="flex items-center justify-between gap-3">
            <dt className="text-xs text-slate-500">Sync state</dt>
            <dd>
              <SyncBadge status={sync_?.status ?? 'idle'} size="sm" />
            </dd>
          </div>
        </dl>

        <div className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 px-3 py-2.5 sm:grid-cols-4">
          <Stat label="Last sync" value={formatRelative(sync_?.lastSyncAt)} />
          <Stat
            label="Next sync"
            value={sync_?.nextSyncAt ? formatRelative(sync_.nextSyncAt) : 'Manual'}
          />
          <Stat label="Messages" value={sync_?.totalMessagesSynced ?? 0} />
          <Stat
            label="Errors"
            value={errorCount}
            tone={errorCount > 0 ? 'text-red-600' : 'text-slate-900'}
          />
        </div>

        {errorCount > 0 && (
          <p className="mt-2 flex items-start gap-1.5 text-xs text-red-700">
            <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
            <span>
              The last run reported {errorCount} error{errorCount === 1 ? '' : 's'}.{' '}
              <Link to={ROUTE_PATHS.PROVIDER_HISTORY} className="font-medium underline">
                See history
              </Link>
            </span>
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3">
        <Button
          size="sm"
          onClick={() => sync()}
          isLoading={action === 'sync:all'}
          disabled={isBusy || !isConnected}
          title={!isConnected ? 'Connect a mailbox first' : undefined}
        >
          <RefreshCw className="size-3.5" aria-hidden="true" />
          Sync now
        </Button>

        <Button as={Link} to={ROUTE_PATHS.PROVIDER} variant="secondary" size="sm">
          <Inbox className="size-3.5" aria-hidden="true" />
          Manage
        </Button>

        <Button as={Link} to={ROUTE_PATHS.PROVIDER_FOLDERS} variant="ghost" size="sm">
          <FolderTree className="size-3.5" aria-hidden="true" />
          {sync_?.folderCount ?? 0} folders
        </Button>
      </div>
    </section>
  )
}

export default ProviderStatusCard
