/**
 * Team performance.
 *
 * The most socially consequential screen in the console: it ranks named
 * colleagues. Three decisions follow from that.
 *
 * **The score explains itself.** Every row's meter opens into the factors that
 * produced it, with actuals and targets. A ranking that will not show its
 * working is not evidence, and somebody will be asked about their position in
 * it.
 *
 * **The caveat is on the page, not in a tooltip.** The score counts activity,
 * not value. A consultant nursing one large account will rank below one handling
 * many small enquiries, and that is a property of the measure rather than of
 * them. It is stated where the ranking is read.
 *
 * **Raw metrics sit beside the score.** The columns the score is built from are
 * visible and sortable, so a reader who distrusts the composite can ignore it
 * entirely and sort by replies.
 *
 * Filtering, sorting and pagination are the server's. The score depends on the
 * whole window, so sorting a single page in the browser would rank people
 * against whoever happened to share their page.
 */

import { useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, Printer, RefreshCw } from 'lucide-react'

import {
  AdminBadge,
  AdminCard,
  AdminDateRange,
  AdminErrorState,
  AdminFilterBar,
  AdminFilterSelect,
  AdminPageContainer,
  AdminPagination,
  AdminScoreMeter,
  AdminSearch,
  AdminStatCard,
  AdminTable,
  AdminTableIdentity,
} from '@/admin/components'
import { PerformanceBadges } from '@/admin/components/performance/PerformanceDashboard'
import { PerformanceComparison } from '@/admin/components/performance/PerformanceComparison'
import { ADMIN_PAGE_SIZE, ADMIN_SCOPE_NOTICE } from '@/admin/constants/admin.constants'
import { ADMIN_ROLE_BADGE, ADMIN_ROLES } from '@/admin/constants/adminRoles.constants'
import { useAdminBreadcrumbs, useAdminResource, useDebouncedValue } from '@/admin/hooks'
import { useDateRange } from '@/admin/hooks/useDateRange'
import { usePermission } from '@/admin/hooks/usePermissions'
import { PERMISSIONS } from '@/admin/constants/permissions'
import { ADMIN_PATHS } from '@/admin/routes/adminPaths'
import { fetchAdminTeamPerformance } from '@/admin/services/admin.service'
import { downloadCsv, exportFilename, printView, toCsv } from '@/admin/utils/exportData'
import { formatCount, formatRelative } from '@/admin/utils/format'
import { UserAvatar } from '@/components/common/UserAvatar'
import { Button } from '@/components/ui/Button'

/** Numeric column. Tabular figures so digits line up down the column. */
const metricCell = (value) => (
  <span className="text-slate-700" style={{ fontVariantNumeric: 'tabular-nums' }}>
    {formatCount(value ?? 0)}
  </span>
)

export function AdminTeamPage() {
  const breadcrumb = useAdminBreadcrumbs()
  const navigate = useNavigate()

  /**
   * Whether a row opens.
   *
   * The leaderboard needs only `analytics.view`, but a person's 360 dashboard —
   * and the per-user trend endpoint behind it — need `users.view` as well: an
   * aggregate ranking and an individual's file are different disclosures. A
   * manager therefore holds the first and not the second, so without this the
   * rows would look clickable and every click would land on a 403.
   *
   * The ranking itself is unaffected. Only the drill-down is withheld.
   */
  const canOpenProfiles = usePermission(PERMISSIONS.USERS_VIEW)

  const { params, query: rangeQuery, range, setParams, setRange } = useDateRange()

  const read = useCallback((key, fallback = '') => params.get(key) ?? fallback, [params])

  const write = useCallback(
    (changes) => {
      const next = new URLSearchParams(params)

      for (const [key, value] of Object.entries(changes)) {
        if (!value) next.delete(key)
        else next.set(key, String(value))
      }

      if (!('page' in changes)) next.delete('page')
      setParams(next, { replace: true })
    },
    [params, setParams],
  )

  const searchInput = read('q')
  const search = useDebouncedValue(searchInput)
  const sort = read('sort', 'score')
  const page = Number(read('page', '1')) || 1

  const query = useMemo(
    () => ({
      ...rangeQuery,
      search,
      role: read('role'),
      sort,
      page,
      limit: ADMIN_PAGE_SIZE,
    }),
    [rangeQuery, search, sort, page, read],
  )

  const loader = useCallback(
    (options) => fetchAdminTeamPerformance({ ...query, ...options }),
    [query],
  )

  const { data, error, isLoading, isRefreshing, refresh } = useAdminResource(loader, {
    deps: [query],
  })

  const rows = data?.items ?? []
  const totals = data?.totals
  const scoring = data?.scoring
  const pagination = data?.pagination ?? { page, limit: ADMIN_PAGE_SIZE, total: 0, totalPages: 1 }

  /**
   * Sorting maps to the server's own keys.
   *
   * The table reports descending for all of them because every one of these
   * measures is "most first" — an ascending leaderboard would open on whoever
   * did least, which is not a view anybody asked for.
   */
  const onSortChange = (key) => write({ sort: key === sort ? 'score' : key })

  const exportColumns = [
    { key: 'rank', header: 'Rank' },
    { key: 'displayName', header: 'Name', value: (row) => row.displayName ?? '' },
    { key: 'email', header: 'Email' },
    { key: 'roleLabel', header: 'Role' },
    { key: 'status', header: 'Status' },
    { key: 'score', header: 'Score', value: (row) => row.performance.score },
    { key: 'emailsSent', header: 'Emails sent', value: (row) => row.metrics.emailsSent },
    { key: 'replies', header: 'Replies', value: (row) => row.metrics.replies },
    { key: 'leadsCreated', header: 'Enquiries', value: (row) => row.metrics.leadsCreated },
    { key: 'campaigns', header: 'Campaigns', value: (row) => row.metrics.campaigns },
    { key: 'companiesAdded', header: 'Companies added', value: (row) => row.metrics.companiesAdded },
    { key: 'contactsAdded', header: 'Contacts added', value: (row) => row.metrics.contactsAdded },
    {
      key: 'lastActivityAt',
      header: 'Last activity',
      value: (row) => row.lastActivityAt ?? 'None recorded',
    },
  ]

  const columns = useMemo(
    () => [
      {
        key: 'rank',
        header: '#',
        width: 'w-12',
        render: (row) => (
          <span className="text-slate-400" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {row.rank}
          </span>
        ),
      },
      {
        key: 'name',
        header: 'Team member',
        sortable: true,
        render: (row) => (
          <AdminTableIdentity
            leading={<UserAvatar name={row.displayName} email={row.email} size="sm" />}
            primary={row.displayName ?? row.email ?? 'Unknown'}
            secondary={row.email}
          />
        ),
      },
      {
        key: 'role',
        header: 'Role',
        render: (row) => (
          <AdminBadge className={ADMIN_ROLE_BADGE[row.role]}>{row.roleLabel ?? '—'}</AdminBadge>
        ),
      },
      {
        key: 'emails',
        header: 'Emails',
        sortable: true,
        align: 'right',
        render: (row) => metricCell(row.metrics.emailsSent),
      },
      {
        key: 'replies',
        header: 'Replies',
        sortable: true,
        align: 'right',
        render: (row) => metricCell(row.metrics.replies),
      },
      {
        key: 'leads',
        header: 'Enquiries',
        sortable: true,
        align: 'right',
        render: (row) => metricCell(row.metrics.leadsCreated),
      },
      {
        key: 'campaigns',
        header: 'Campaigns',
        align: 'right',
        render: (row) => metricCell(row.metrics.campaigns),
      },
      {
        key: 'directory',
        header: 'Directory',
        align: 'right',
        render: (row) => metricCell(row.metrics.companiesAdded + row.metrics.contactsAdded),
      },
      {
        key: 'activity',
        header: 'Last activity',
        sortable: true,
        render: (row) => (
          <span className="text-slate-600">
            {row.lastActivityAt ? formatRelative(row.lastActivityAt) : 'None recorded'}
          </span>
        ),
      },
      {
        key: 'score',
        header: 'Score',
        sortable: true,
        width: 'w-56',
        render: (row) => (
          <AdminScoreMeter
            compact
            score={row.performance.score}
            components={row.performance.components}
            recency={row.performance.recency}
          />
        ),
      },
    ],
    [],
  )

  const actions = (
    <>
      <Button
        variant="secondary"
        size="sm"
        disabled={rows.length === 0}
        onClick={() =>
          downloadCsv(
            exportFilename('team-performance', data?.range),
            toCsv(exportColumns, rows),
          )
        }
      >
        <Download className="size-3.5" aria-hidden="true" />
        Export CSV
      </Button>
      <Button variant="secondary" size="sm" onClick={printView}>
        <Printer className="size-3.5" aria-hidden="true" />
        Print / PDF
      </Button>
      <Button variant="secondary" size="sm" onClick={refresh} isLoading={isRefreshing}>
        <RefreshCw className="size-3.5" aria-hidden="true" />
        Refresh
      </Button>
    </>
  )

  if (error) {
    return (
      <AdminPageContainer
        title="Team performance"
        subtitle="Activity and contribution across the team"
        breadcrumb={breadcrumb}
        actions={actions}
      >
        <AdminErrorState error={error} onRetry={refresh} />
      </AdminPageContainer>
    )
  }

  return (
    <AdminPageContainer
      title="Team performance"
      subtitle="Activity and contribution across the team"
      breadcrumb={breadcrumb}
      notice={ADMIN_SCOPE_NOTICE}
      isRefreshing={isRefreshing}
      actions={actions}
    >
      <AdminDateRange value={range} onChange={setRange} resolved={data?.range} />

      {/* Totals for everybody matched, not just this page — the figure a reader
          expects from a header above a paginated list. */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <AdminStatCard label="People" value={formatCount(pagination.total)} isLoading={isLoading} />
        <AdminStatCard
          label="Emails sent"
          value={formatCount(totals?.emailsSent ?? 0)}
          isLoading={isLoading}
        />
        <AdminStatCard
          label="Replies received"
          value={formatCount(totals?.replies ?? 0)}
          isLoading={isLoading}
        />
        <AdminStatCard
          label="Enquiries created"
          value={formatCount(totals?.leadsCreated ?? 0)}
          isLoading={isLoading}
        />
      </div>

      {/*
        Phase 17.3. Above the board rather than below it: the badges are the
        answer to "who stood out", which is the question somebody opens this
        page with, and the table is the evidence underneath.

        `badges` comes from the same response as the rows, so a badge can never
        name somebody the board scores differently.
      */}
      <PerformanceBadges
        badges={data?.badges}
        qualifications={data?.badgeQualifications}
        isLoading={isLoading}
      />

      <AdminCard
        title="Leaderboard"
        description={
          canOpenProfiles
            ? 'Ranked by performance score for the selected period. Select a row to open that person’s dashboard.'
            : 'Ranked by performance score for the selected period.'
        }
        padded={false}
      >
        <AdminFilterBar
          activeCount={(searchInput ? 1 : 0) + (read('role') ? 1 : 0)}
          onReset={() => write({ q: '', role: '' })}
          search={
            <AdminSearch
              value={searchInput}
              onChange={(value) => write({ q: value })}
              placeholder="Search name or email"
              label="Search team members"
            />
          }
        >
          <AdminFilterSelect
            label="Role"
            value={read('role')}
            onChange={(value) => write({ role: value })}
            options={ADMIN_ROLES.map((role) => ({ value: role.key, label: role.label }))}
            allLabel="All roles"
          />
        </AdminFilterBar>

        <AdminTable
          columns={columns}
          rows={rows}
          isLoading={isLoading}
          sort={{ key: sort === 'score' ? 'score' : sort, direction: 'desc' }}
          onSortChange={onSortChange}
          onRowClick={
            canOpenProfiles
              ? (row) => navigate(ADMIN_PATHS.USER_DETAIL.replace(':id', row.id))
              : undefined
          }
          caption="Team members ranked by performance score"
          empty="No recorded activity for anybody in this period."
        />

        <AdminPagination
          page={pagination.page}
          pageSize={pagination.limit}
          totalItems={pagination.total}
          onPageChange={(next) => write({ page: String(next) })}
          disabled={isLoading}
        />
      </AdminCard>

      {/*
        `rangeQuery`, not `range`: the wire form, where an explicit pair wins and
        the preset is dropped. Sending both would let a stale preset sit beside a
        custom range.

        Gated on `users.view` for the same reason the endpoint is — a comparison
        names individuals, which a manager holding only `analytics.view` may not
        read. The server refuses it either way; this stops the console offering
        a control that would answer 403.
      */}
      {canOpenProfiles && <PerformanceComparison people={rows} range={rangeQuery} />}

      {/* The formula, from the same response that produced the scores. Written
          out rather than summarised, because a ranking of colleagues should be
          reproducible by anybody who wants to check it. */}
      {scoring && (
        <AdminCard
          title="How the score is calculated"
          description={scoring.formula}
        >
          <div className="scroll-x overflow-x-auto">
            <table className="w-full min-w-[34rem] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th scope="col" className="pb-2 text-left font-medium">Factor</th>
                  <th scope="col" className="pb-2 text-right font-medium">Weight</th>
                  <th scope="col" className="pb-2 text-right font-medium">
                    Target ({scoring.windowDays} days)
                  </th>
                </tr>
              </thead>
              <tbody style={{ fontVariantNumeric: 'tabular-nums' }}>
                {scoring.factors.map((factor) => (
                  <tr key={factor.key} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 text-left text-slate-700">{factor.label}</td>
                    <td className="py-2 text-right text-slate-700">
                      {Math.round(factor.weight * 100)}%
                    </td>
                    <td className="py-2 text-right text-slate-700">{factor.target}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-sm text-slate-600">
            Each factor is capped at its target, so no single measure can dominate. The result is
            multiplied by a recency factor — {scoring.recency.note} It falls no lower than{' '}
            {Math.round(scoring.recency.floor * 100)}%.
          </p>

          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {scoring.caveat}
          </p>
        </AdminCard>
      )}
    </AdminPageContainer>
  )
}

export default AdminTeamPage
