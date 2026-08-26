/**
 * Synchronisation run history.
 *
 * Exists for the failure case. A successful sync needs no explanation; a run
 * that returned nothing, or half of what was expected, leaves no other trace —
 * and "sync isn't working" is not a report anyone can act on without knowing
 * which folder, which error and when.
 *
 * Expanding a run shows its per-folder breakdown, because a run is rarely
 * uniformly good or bad and the aggregate hides which part went wrong.
 */

import { useCallback, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  AlertCircle,
  ArrowLeft,
  ChevronDown,
  History,
  RefreshCw,
} from 'lucide-react'

import { fetchSyncHistory } from '@/api/services/provider.service'
import { ErrorScreen } from '@/components/common/ErrorScreen'
import { SyncBadge } from '@/components/provider/ProviderBadge'
import { Button } from '@/components/ui/Button'
import { formatDateTime, formatDuration, formatRelative } from '@/constants/provider.constants'
import { useApiResource } from '@/hooks/useApiResource'
import { ROUTE_PATHS } from '@/routes/paths'
import { DEFAULT_PAGE_SIZE, Pagination } from '@/components/ui/Pagination'
import { resolveErrorVariant } from '@/utils/apiError'

/** One counter in the run summary. */
function Metric({ label, value, tone = 'text-slate-900' }) {
  return (
    <div>
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className={`text-sm font-semibold ${tone}`}>{value}</p>
    </div>
  )
}

export function SyncHistoryPage() {
  const [page, setPage] = useState(1)
  // Rows per page is the reader's choice; changing it returns to page one,
  // because page 8 of a 25-row list is past the end of a 50-row one.
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [expandedId, setExpandedId] = useState(null)

  /**
   * Scoped to the mailbox the Provider page was showing.
   *
   * `SyncHistory` has recorded which mailbox produced each run since Phase 5,
   * so this is a filter over data that was always attributed — not new
   * bookkeeping. Defaulting to one mailbox matters because a list interleaving
   * runs from three of them reads as one mailbox behaving erratically.
   */
  const [searchParams] = useSearchParams()
  const mailboxId = searchParams.get('mailbox')

  /** Opt in to the whole workspace. Every row still names its own mailbox. */
  const [allMailboxes, setAllMailboxes] = useState(false)

  const fetcher = useCallback(
    ({ signal }) => fetchSyncHistory({ page, limit: pageSize, mailboxId, allMailboxes, signal }),
    [page, mailboxId, allMailboxes],
  )

  const { data, isInitialLoading, isLoading, isError, error, refresh } = useApiResource(fetcher)

  if (isError && !data) {
    return (
      <ErrorScreen variant={resolveErrorVariant(error)} message={error?.message} onRetry={refresh} />
    )
  }

  const runs = data?.items ?? []
  const meta = data?.meta

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <Link
            to={ROUTE_PATHS.PROVIDER}
            className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-slate-500 transition-colors hover:text-brand-600"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            Provider
          </Link>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
            Sync history
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Every synchronisation run, including those that failed.
            {mailboxId && !allMailboxes && ' Showing one mailbox.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Offered only when there is a mailbox scope to widen. */}
          {mailboxId && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setAllMailboxes((current) => !current)
                setPage(1)
              }}
            >
              {allMailboxes ? 'This mailbox only' : 'All mailboxes'}
            </Button>
          )}

          <Button variant="secondary" onClick={refresh} isLoading={isLoading}>
            <RefreshCw className="size-4" aria-hidden="true" />
            Refresh
          </Button>
        </div>
      </div>

      {isInitialLoading ? (
        <div className="space-y-2" aria-busy="true">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-16 animate-pulse rounded-lg bg-slate-200/70" />
          ))}
        </div>
      ) : runs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white py-12 text-center">
          <History className="mx-auto size-8 text-slate-300" aria-hidden="true" />
          <p className="mt-3 text-sm font-medium text-slate-700">No syncs yet</p>
          <p className="mt-1 text-sm text-slate-500">
            Runs appear here as soon as you synchronise a mailbox.
          </p>
          <Button as={Link} to={ROUTE_PATHS.PROVIDER} className="mt-4">
            Go to provider settings
          </Button>
        </div>
      ) : (
        <ul className="space-y-2">
          {runs.map((run) => {
            const isExpanded = expandedId === run.id
            const hasErrors = run.errors?.length > 0

            return (
              <li
                key={run.id}
                className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : run.id)}
                  aria-expanded={isExpanded}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50"
                >
                  <ChevronDown
                    className={`size-4 shrink-0 text-slate-400 transition-transform ${
                      isExpanded ? 'rotate-180' : ''
                    }`}
                    aria-hidden="true"
                  />

                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-900">
                      {formatRelative(run.startedAt)}
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-normal capitalize text-slate-600">
                        {run.mode}
                      </span>
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-normal capitalize text-slate-600">
                        {run.trigger}
                      </span>
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {/*
                        Which mailbox ran this. Shown only in the workspace-wide
                        list: in the per-mailbox view every row has the same
                        answer and repeating it would be noise.
                      */}
                      {allMailboxes && run.mailboxAddress && (
                        <span className="font-medium text-slate-600">
                          {run.mailboxAddress} ·{' '}
                        </span>
                      )}
                      {run.totals.messagesCreated} new · {run.totals.messagesUpdated} updated ·{' '}
                      {run.totals.messagesSkipped} unchanged · {formatDuration(run.durationMs)}
                    </p>
                  </div>

                  <SyncBadge status={run.status} size="sm" />
                </button>

                {/* Errors summarised on the collapsed row — the point of this
                    view is that a failure is visible without digging. */}
                {hasErrors && !isExpanded && (
                  <p className="flex items-start gap-1.5 border-t border-red-100 bg-red-50/70 px-4 py-2 text-xs text-red-700">
                    <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate">
                      {run.errors[0].folder ? `${run.errors[0].folder}: ` : ''}
                      {run.errors[0].message}
                      {run.errors.length > 1 && ` (+${run.errors.length - 1} more)`}
                    </span>
                  </p>
                )}

                {isExpanded && (
                  <div className="space-y-3 border-t border-slate-100 bg-slate-50/60 px-4 py-3">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                      <Metric label="Created" value={run.totals.messagesCreated} tone="text-emerald-700" />
                      <Metric label="Updated" value={run.totals.messagesUpdated} tone="text-blue-700" />
                      <Metric label="Deleted" value={run.totals.messagesDeleted} tone="text-red-700" />
                      <Metric label="Unchanged" value={run.totals.messagesSkipped} />
                      <Metric label="Conflicts" value={run.totals.conflictsResolved} tone="text-amber-700" />
                    </div>

                    <div>
                      <p className="mb-1.5 text-[11px] font-medium text-slate-600">Per folder</p>
                      <ul className="space-y-1">
                        {run.results.map((result) => (
                          <li
                            key={result.folder}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-white px-3 py-1.5 ring-1 ring-slate-200"
                          >
                            <span className="text-xs capitalize text-slate-700">
                              {result.folder}
                              <span className="ml-1.5 text-[10px] text-slate-400">
                                {result.mode}
                              </span>
                            </span>

                            <span className="flex items-center gap-2">
                              <span className="text-[11px] text-slate-500">
                                +{result.messagesCreated} / ~{result.messagesUpdated} /{' '}
                                {formatDuration(result.durationMs)}
                              </span>
                              <SyncBadge status={result.status} size="sm" />
                            </span>

                            {result.error && (
                              <p className="w-full text-[11px] text-red-600">
                                {result.error.code}: {result.error.message}
                              </p>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {hasErrors && (
                      <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2">
                        <p className="text-[11px] font-medium text-red-800">Errors</p>
                        <ul className="mt-1 space-y-0.5">
                          {run.errors.map((entry, index) => (
                            <li key={index} className="text-xs text-red-700">
                              <span className="font-mono text-[10px]">{entry.code}</span>
                              {entry.folder ? ` · ${entry.folder}` : ''} — {entry.message}
                              {entry.retryable && (
                                <span className="ml-1 text-[10px] text-red-500">(retryable)</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <dl className="grid gap-x-4 gap-y-1 text-[11px] sm:grid-cols-[auto_1fr]">
                      <dt className="text-slate-500">Started</dt>
                      <dd className="text-slate-700">{formatDateTime(run.startedAt)}</dd>
                      <dt className="text-slate-500">Finished</dt>
                      <dd className="text-slate-700">{formatDateTime(run.finishedAt)}</dd>
                      <dt className="text-slate-500">Correlation id</dt>
                      {/* Shown because it is what ties this run to provider-side logs. */}
                      <dd className="break-all font-mono text-slate-500">{run.correlationId}</dd>
                    </dl>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <Pagination
        page={page}
        pageSize={pageSize}
        totalItems={meta?.total ?? 0}
        onPageChange={setPage}
        onPageSizeChange={(next) => { setPageSize(next); setPage(1) }}
        noun="runs"
      />

      <p className="text-center text-xs text-slate-400">
        History is retained for 30 days.
      </p>
    </div>
  )
}

export default SyncHistoryPage
