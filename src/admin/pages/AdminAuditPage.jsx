/**
 * The audit log.
 *
 * Rebuilt in Phase 14.7. The previous version read `/admin/audit/summary` and
 * showed counts plus twenty recent rows, because instrumentation did not exist
 * and there was nothing else honest to show. There is now.
 *
 * ## Two views of one query
 *
 * **Table** for investigation — every column, sortable filters, exportable.
 * **Timeline** for review — the same entries grouped Today / Yesterday /
 * Earlier, which is how somebody reads a log they are not searching.
 *
 * They share one filter state, so switching views never silently changes what
 * is being shown. The grouping is the server's, so "Today" means the server's
 * day rather than the reader's timezone.
 *
 * ## The whole filter lives in the URL
 *
 * An audit finding gets shared. `?category=auth&result=denied&preset=last7` is
 * a link a colleague opens to the same evidence — and Back restores the filter
 * rather than dumping the reader at an unfiltered log.
 *
 * ## Paging is server-side and cursor-based
 *
 * The log is the only collection here that only grows. `skip()` gets slower
 * every week and shifts under a reader as new entries arrive, so "next" follows
 * a keyset cursor. Page numbers remain for jumping, capped by the server.
 *
 * ## Nothing on this page can write
 *
 * There is no create, no edit, no delete, and no retention control. Retention
 * is configuration, shown here as a statement of policy rather than a switch —
 * an audit log an operator can shorten from the interface is not evidence.
 */

import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Download, FileClock, List, RefreshCw, Rows3, ShieldAlert } from 'lucide-react'

import {
  AdminCard,
  AdminDateRange,
  AdminEmptyState,
  AdminErrorState,
  AdminFilterBar,
  AdminFilterSelect,
  AdminPageContainer,
  AdminSearch,
  AdminStatCard,
  AdminTable,
} from '@/admin/components'
import { AuditDetailDrawer } from '@/admin/components/audit/AuditDetailDrawer'
import { AuditResultBadge, AuditSeverityBadge } from '@/admin/components/audit/AuditPrimitives'
import { useAdminBreadcrumbs, useAdminResource, useDebouncedValue } from '@/admin/hooks'
import { useDateRange } from '@/admin/hooks/useDateRange'
import {
  auditExportUrl,
  fetchAuditFacets,
  fetchAuditLogs,
  fetchAuditOverview,
  fetchAuditTimeline,
} from '@/admin/services/admin.service'
import { EMPTY, formatCount, formatDateTime, formatRelative } from '@/admin/utils/format'
import { Button } from '@/components/ui/Button'

const PAGE_SIZE = 25

export function AdminAuditPage() {
  const breadcrumb = useAdminBreadcrumbs()
  const [params, setParams] = useSearchParams()
  const { query: rangeQuery, range, setRange } = useDateRange()

  const [selectedId, setSelectedId] = useState(null)

  const read = useCallback((key, fallback = '') => params.get(key) ?? fallback, [params])

  const write = useCallback(
    (changes) => {
      const next = new URLSearchParams(params)

      for (const [key, value] of Object.entries(changes)) {
        if (!value) next.delete(key)
        else next.set(key, String(value))
      }

      // Any filter change returns to the first page. Page 6 of a narrower
      // result set is empty, and an empty audit log reads as "nothing
      // happened" rather than as "you are past the end".
      if (!('page' in changes)) next.delete('page')
      setParams(next, { replace: true })
    },
    [params, setParams],
  )

  const view = read('view', 'table')
  const searchInput = read('q')
  const search = useDebouncedValue(searchInput)
  const page = Number(read('page', '1')) || 1

  /** Everything the server filters on. One object, shared by all four requests. */
  const filters = useMemo(
    () => ({
      ...rangeQuery,
      category: read('category'),
      action: read('action'),
      result: read('result'),
      severity: read('severity'),
      entityType: read('entityType'),
      actor: read('actor'),
      mailboxId: read('mailboxId'),
      campaignId: read('campaignId'),
      leadId: read('leadId'),
      // Below the server's two-character minimum the term is dropped rather
      // than sent, or every first keystroke would be a 422.
      search: search.length >= 2 ? search : '',
    }),
    [rangeQuery, search, read],
  )

  const listLoader = useCallback(
    (options) => fetchAuditLogs({ ...filters, limit: PAGE_SIZE, page, ...options }),
    [filters, page],
  )
  const { data, error, isLoading, isRefreshing, refresh } = useAdminResource(listLoader, {
    deps: [filters, page],
    enabled: view === 'table',
  })

  const timelineLoader = useCallback(
    (options) => fetchAuditTimeline({ ...filters, limit: 50, ...options }),
    [filters],
  )
  const timeline = useAdminResource(timelineLoader, {
    deps: [filters],
    enabled: view === 'timeline',
  })

  const facetLoader = useCallback((options) => fetchAuditFacets({ ...filters, ...options }), [filters])
  const facets = useAdminResource(facetLoader, { deps: [filters] })

  const overviewLoader = useCallback((options) => fetchAuditOverview(options), [])
  const overview = useAdminResource(overviewLoader)

  const rows = data?.items ?? []
  const pagination = data?.pagination ?? {}

  const columns = useMemo(
    () => [
      {
        key: 'occurredAt',
        header: 'Time',
        width: 'w-44',
        render: (row) => (
          <div className="min-w-0">
            <p className="whitespace-nowrap text-slate-800">{formatRelative(row.occurredAt)}</p>
            <p className="whitespace-nowrap text-xs text-slate-400">
              {formatDateTime(row.occurredAt)}
            </p>
          </div>
        ),
      },
      {
        key: 'actor',
        header: 'User',
        render: (row) => (
          <div className="min-w-0">
            <p className="truncate font-medium text-slate-900">{row.actor?.email ?? EMPTY}</p>
            {row.actor?.role && <p className="truncate text-xs text-slate-500">{row.actor.role}</p>}
          </div>
        ),
      },
      {
        key: 'category',
        header: 'Category',
        render: (row) => <span className="text-slate-600">{row.categoryLabel}</span>,
      },
      {
        key: 'action',
        header: 'Action',
        render: (row) => (
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-slate-800">{row.actionLabel}</span>
            {row.severity === 'critical' && <AuditSeverityBadge severity={row.severity} />}
          </div>
        ),
      },
      {
        key: 'target',
        header: 'Target',
        render: (row) =>
          row.target?.name || row.target?.id ? (
            <span className="block max-w-56 truncate text-slate-600">
              {row.target.name ?? row.target.id}
            </span>
          ) : (
            <span className="text-slate-400">{EMPTY}</span>
          ),
      },
      {
        key: 'result',
        header: 'Result',
        render: (row) => <AuditResultBadge result={row.result} reason={row.resultReason} />,
      },
      {
        key: 'ip',
        header: 'IP',
        cellClassName: 'tabular-nums',
        render: (row) => <span className="text-slate-600">{row.ip ?? EMPTY}</span>,
      },
      {
        key: 'device',
        header: 'Device',
        render: (row) => (
          <span className="block max-w-40 truncate text-slate-600" title={row.userAgent ?? undefined}>
            {row.device ?? EMPTY}
          </span>
        ),
      },
    ],
    [],
  )

  const activeFilterCount = [
    'category', 'action', 'result', 'severity', 'entityType', 'actor',
    'mailboxId', 'campaignId', 'leadId',
  ].filter((key) => read(key)).length + (searchInput ? 1 : 0)

  const actions = (
    <>
      <div role="group" aria-label="View" className="inline-flex rounded-lg bg-slate-100 p-0.5">
        {[
          { value: 'table', label: 'Table', icon: Rows3 },
          { value: 'timeline', label: 'Timeline', icon: List },
        ].map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => write({ view: option.value === 'table' ? '' : option.value })}
            aria-pressed={view === option.value}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              view === option.value
                ? 'bg-white text-slate-900 shadow-card'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <option.icon className="size-3.5" aria-hidden="true" />
            {option.label}
          </button>
        ))}
      </div>

      {/* An anchor, not a button: the response is a file with a
          Content-Disposition, and letting the browser navigate to it gets the
          filename and the download indicator for free. */}
      {['csv', 'json'].map((format) => (
        <Button
          key={format}
          as="a"
          href={auditExportUrl({ ...filters, format })}
          variant="secondary"
          size="sm"
        >
          <Download className="size-3.5" aria-hidden="true" />
          {format.toUpperCase()}
        </Button>
      ))}

      <Button variant="secondary" size="sm" onClick={refresh} isLoading={isRefreshing}>
        <RefreshCw className="size-3.5" aria-hidden="true" />
        Refresh
      </Button>

      {/* The reporting period closes the action row, so every screen puts it in
          the same place: page title left, page actions then period top-right.
          Same component, same `range` state, same `setRange` — the request is
          byte-for-byte what it was when this sat in a bar below the title. */}
      <AdminDateRange value={range} onChange={setRange} resolved={data?.range} />
    </>
  )

  return (
    <AdminPageContainer
      title="Audit log"
      subtitle="Who did what, when, from where"
      breadcrumb={breadcrumb}
      isRefreshing={isRefreshing}
      actions={actions}
    >
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <AdminStatCard
          label="Entries recorded"
          value={formatCount(overview.data?.total ?? 0)}
          icon={FileClock}
          isLoading={overview.isLoading}
        />
        <AdminStatCard
          label="Matching this filter"
          // Null while searching: the server skips the count because counting a
          // text match costs as much as running it. Shown as a dash with a
          // reason rather than a zero, which would read as "no results".
          value={
            pagination.total === null || pagination.total === undefined
              ? EMPTY
              : formatCount(pagination.total)
          }
          hint={pagination.totalOmitted ?? undefined}
          isLoading={isLoading}
        />
        <AdminStatCard
          label="Events tracked"
          value={formatCount(overview.data?.coverage?.eventCount ?? 0)}
          hint={overview.data?.coverage?.note}
          isLoading={overview.isLoading}
        />
        <AdminStatCard
          label="Retention"
          value={
            overview.data?.retention
              ? overview.data.retention.enabled
                ? `${overview.data.retention.days} days`
                : 'Indefinite'
              : EMPTY
          }
          icon={ShieldAlert}
          hint={overview.data?.retention?.note}
          isLoading={overview.isLoading}
        />
      </div>

      <AdminCard padded={false}>
        <AdminFilterBar
          activeCount={activeFilterCount}
          onReset={() =>
            write({
              q: '', category: '', action: '', result: '', severity: '',
              entityType: '', actor: '', mailboxId: '', campaignId: '', leadId: '',
            })
          }
          search={
            <AdminSearch
              value={searchInput}
              onChange={(value) => write({ q: value })}
              placeholder="Search summary, target or user"
              label="Search the audit log"
            />
          }
        >
          {/* Options come from the server with counts. Every category is offered
              even at zero, so an operator can select one and learn that nothing
              happened — an absent option would read as an absent feature. */}
          <AdminFilterSelect
            label="Category"
            value={read('category')}
            onChange={(value) => write({ category: value, action: '' })}
            options={(facets.data?.categories ?? []).map((option) => ({
              value: option.value,
              label: `${option.label} (${option.count})`,
            }))}
            allLabel="All categories"
          />
          <AdminFilterSelect
            label="Action"
            value={read('action')}
            onChange={(value) => write({ action: value })}
            options={(facets.data?.actions ?? [])
              .filter((option) => !read('category') || option.category === read('category'))
              .map((option) => ({ value: option.value, label: option.label }))}
            allLabel="All actions"
          />
          <AdminFilterSelect
            label="Result"
            value={read('result')}
            onChange={(value) => write({ result: value })}
            options={(facets.data?.results ?? []).map((option) => ({
              value: option.value,
              label: `${option.value} (${option.count})`,
            }))}
            allLabel="Any result"
          />
          <AdminFilterSelect
            label="Severity"
            value={read('severity')}
            onChange={(value) => write({ severity: value })}
            options={(facets.data?.severities ?? []).map((option) => ({
              value: option.value,
              label: `${option.value} (${option.count})`,
            }))}
            allLabel="Any severity"
          />
          <AdminFilterSelect
            label="User"
            value={read('actor')}
            onChange={(value) => write({ actor: value })}
            options={(facets.data?.actors ?? []).map((option) => ({
              value: option.id,
              label: `${option.email ?? option.id} (${option.count})`,
            }))}
            allLabel="Anyone"
          />
          <AdminFilterSelect
            label="Entity"
            value={read('entityType')}
            onChange={(value) => write({ entityType: value })}
            options={(facets.data?.entityTypes ?? []).map((option) => ({
              value: option.value,
              label: option.value,
            }))}
            allLabel="Any entity"
          />
        </AdminFilterBar>

        {error ? (
          <div className="p-5">
            <AdminErrorState error={error} onRetry={refresh} />
          </div>
        ) : view === 'timeline' ? (
          <AuditTimeline resource={timeline} onSelect={setSelectedId} />
        ) : (
          <>
            <AdminTable
              columns={columns}
              rows={rows}
              isLoading={isLoading}
              onRowClick={(row) => setSelectedId(row.id)}
              caption="Audit entries, newest first"
              empty={
                <AdminEmptyState
                  title="Nothing matches this filter"
                  description="Widen the date range, or clear the filters above."
                  compact
                />
              }
            />

            {/* Cursor paging: "load more" rather than page numbers, because the
                server cannot cheaply know how many pages a text search has and
                a page control that lies about its extent is worse than none. */}
            <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-3">
              <p className="text-xs text-slate-500">
                {rows.length === 0
                  ? 'No entries'
                  : `Showing ${rows.length} entr${rows.length === 1 ? 'y' : 'ies'}${
                      pagination.total ? ` of ${formatCount(pagination.total)}` : ''
                    }`}
              </p>

              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page <= 1 || isLoading}
                  onClick={() => write({ page: String(page - 1) })}
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!pagination.hasMore || isLoading}
                  onClick={() => write({ page: String(page + 1) })}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </AdminCard>

      <AuditDetailDrawer
        entryId={selectedId}
        isOpen={Boolean(selectedId)}
        onClose={() => setSelectedId(null)}
      />
    </AdminPageContainer>
  )
}

/**
 * The grouped view.
 *
 * Groups arrive from the server already ordered and already non-empty, so this
 * renders what it is given rather than deciding what "Today" means — which it
 * cannot do correctly from the browser's timezone.
 */
function AuditTimeline({ resource, onSelect }) {
  const { data, error, isLoading, refresh } = resource

  if (error) {
    return (
      <div className="p-5">
        <AdminErrorState error={error} onRetry={refresh} />
      </div>
    )
  }

  if (isLoading) {
    return <div className="space-y-3 p-5">{[0, 1, 2, 3, 4].map((n) => (
      <div key={n} className="skeleton h-12" />
    ))}</div>
  }

  const groups = data?.groups ?? []

  if (groups.length === 0) {
    return (
      <div className="p-5">
        <AdminEmptyState
          title="Nothing matches this filter"
          description="Widen the date range, or clear the filters above."
          compact
        />
      </div>
    )
  }

  return (
    <div className="divide-y divide-slate-100">
      {groups.map((group) => (
        <section key={group.key}>
          <h3 className="sticky top-0 z-10 border-b border-slate-100 bg-slate-50/90 px-5 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 backdrop-blur">
            {group.label}
            <span className="ml-2 font-normal normal-case tracking-normal text-slate-400">
              {group.items.length}
            </span>
          </h3>

          <ol>
            {group.items.map((entry) => (
              <li key={entry.id}>
                <button
                  type="button"
                  onClick={() => onSelect(entry.id)}
                  className="flex w-full items-start gap-3 px-5 py-3 text-left transition-colors hover:bg-slate-50"
                >
                  <span
                    className={`mt-1.5 size-1.5 shrink-0 rounded-full ${
                      entry.result === 'success' ? 'bg-brand-500' : 'bg-red-500'
                    }`}
                    aria-hidden="true"
                  />

                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-800">
                      <span className="font-medium">{entry.actionLabel}</span>
                      {entry.target?.name && (
                        <span className="text-slate-600"> — {entry.target.name}</span>
                      )}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {entry.actor?.email ?? 'Unknown user'} · {formatRelative(entry.occurredAt)}
                      {entry.ip ? ` · ${entry.ip}` : ''}
                    </p>
                  </div>

                  {entry.result !== 'success' && (
                    <AuditResultBadge result={entry.result} reason={entry.resultReason} />
                  )}
                </button>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  )
}

export default AdminAuditPage
