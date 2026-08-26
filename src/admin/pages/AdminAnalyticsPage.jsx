/**
 * Analytics.
 *
 * Backed by `GET /api/v1/admin/analytics`, aggregated live with `$dateTrunc`
 * over the existing collections. No snapshot table, no cache, no duplicated
 * metric — every number here is derived from the same documents the CRM screens
 * read, which is what makes the two surfaces incapable of disagreeing.
 *
 * ## Three rules the layout follows
 *
 * **One filter row, above everything it scopes.** The date range and the
 * granularity control sit at the top of the page, not inside a card, and every
 * section below re-requests against them together. Per-chart filters let two
 * charts on one screen describe two different periods, and nothing in the
 * interface says so — the reader compares them anyway.
 *
 * **No chart plots two measures of different scale.** Four single-measure
 * series, four separate plots. A dual axis aligns two scales arbitrarily and
 * invents a correlation the data does not contain.
 *
 * **Every chart has a table twin.** The consultant table at the foot carries
 * numbers in text, so no value on this page is reachable only by hovering.
 *
 * ## Where a number does not exist, it says so
 *
 * The mailbox table's reply column is empty on every row, because `Conversation`
 * records the thread's owner and not the mailbox it arrived through — the figure
 * is genuinely underivable from what is stored. It is left blank with the reason
 * printed beneath, rather than filled with the owner's total, which would be a
 * different number wearing this one's label.
 */

import { useCallback, useMemo, useState } from 'react'
import { Download, Inbox, Mail, Megaphone, MessageSquare, RefreshCw, Target } from 'lucide-react'

import {
  ADMIN_CHART_COLORS,
  AdminAreaChart,
  AdminBadge,
  AdminBarChart,
  AdminCard,
  AdminChartLoading,
  AdminDateRange,
  AdminEmptyState,
  AdminErrorState,
  AdminListLoading,
  AdminPageContainer,
  AdminRankChart,
  AdminSection,
  AdminStatCard,
  AdminStatsLoading,
  AdminTable,
} from '@/admin/components'
import { ADMIN_TONE } from '@/admin/constants/admin.constants'
import {
  MAILBOX_HEALTH_LABELS,
  MAILBOX_HEALTH_TONE,
} from '@/admin/constants/mailbox.constants'
import { ADMIN_ROLE_BADGE } from '@/admin/constants/adminRoles.constants'
import { useAdminBreadcrumbs, useAdminResource } from '@/admin/hooks'
import { useDateRange } from '@/admin/hooks/useDateRange'
import {
  fetchAdminActivity,
  fetchAdminAnalytics,
  fetchAdminMailboxAnalytics,
} from '@/admin/services/admin.service'
import { downloadCsv, exportFilename, toCsv } from '@/admin/utils/exportData'
import {
  EMPTY,
  formatCount,
  formatMinutes,
  formatPercent,
  formatRelative,
} from '@/admin/utils/format'
import { Button } from '@/components/ui/Button'

const GRANULARITIES = [
  { value: 'day', label: 'Daily' },
  { value: 'week', label: 'Weekly' },
  { value: 'month', label: 'Monthly' },
]

const PERFORMANCE_COLUMNS = [
  {
    key: 'name',
    header: 'Consultant',
    render: (row) => (
      <div className="min-w-0">
        <p className="truncate font-medium text-slate-900">{row.name}</p>
        {row.email && <p className="truncate text-xs text-slate-500">{row.email}</p>}
      </div>
    ),
  },
  {
    key: 'role',
    header: 'Role',
    render: (row) =>
      row.role ? (
        <AdminBadge className={ADMIN_ROLE_BADGE[row.role]}>{row.roleLabel ?? row.role}</AdminBadge>
      ) : (
        EMPTY
      ),
  },
  {
    key: 'leads',
    header: 'Enquiries',
    align: 'right',
    // `tabular-nums` here and not on the stat tiles: this is a column of numbers
    // that must align vertically, which is what equal-width digits are for.
    cellClassName: 'tabular-nums',
    render: (row) => formatCount(row.leads),
  },
  {
    key: 'emailed',
    header: 'Introduced',
    align: 'right',
    cellClassName: 'tabular-nums',
    render: (row) => formatCount(row.emailed),
  },
  {
    key: 'won',
    header: 'Won',
    align: 'right',
    cellClassName: 'tabular-nums',
    render: (row) => formatCount(row.won),
  },
  {
    key: 'lost',
    header: 'Lost',
    align: 'right',
    cellClassName: 'tabular-nums text-slate-500',
    render: (row) => formatCount(row.lost),
  },
]

/** The mailbox table. Declared once and reused by the CSV export. */
const MAILBOX_COLUMNS = [
  {
    key: 'emailAddress',
    header: 'Mailbox',
    render: (row) => (
      <div className="min-w-0">
        <p className="truncate font-medium text-slate-900">{row.emailAddress ?? EMPTY}</p>
        {row.displayName && <p className="truncate text-xs text-slate-500">{row.displayName}</p>}
      </div>
    ),
  },
  {
    key: 'health',
    header: 'Health',
    // `health` is `{ state, detail }`, not a string — the shape
    // `adminMailbox.dto.js` produces. The state selects the label and tone; the
    // detail is the sentence that explains it.
    render: (row) =>
      row.health ? (
        <AdminBadge tone={MAILBOX_HEALTH_TONE[row.health.state] ?? 'neutral'} dot>
          {MAILBOX_HEALTH_LABELS[row.health.state] ?? row.health.state}
        </AdminBadge>
      ) : (
        EMPTY
      ),
  },
  {
    key: 'emailsSent',
    header: 'Emails sent',
    align: 'right',
    cellClassName: 'tabular-nums',
    render: (row) => formatCount(row.emailsSent),
  },
  {
    key: 'campaigns',
    header: 'Campaigns',
    align: 'right',
    cellClassName: 'tabular-nums',
    render: (row) => formatCount(row.campaigns),
  },
  {
    key: 'replies',
    header: 'Replies',
    align: 'right',
    // Always null. See the note printed under the table.
    render: () => <span className="text-slate-400">Not attributable</span>,
  },
  {
    key: 'assignedUserCount',
    header: 'Users',
    align: 'right',
    cellClassName: 'tabular-nums',
    render: (row) => formatCount(row.assignedUserCount),
  },
  {
    key: 'topUser',
    header: 'Most active user',
    render: (row) =>
      row.topUser ? (
        <span className="text-slate-600">
          {row.topUser.name}{' '}
          <span className="text-slate-400">({formatCount(row.topUser.emailsSent)})</span>
        </span>
      ) : (
        <span className="text-slate-400">No sends in this period</span>
      ),
  },
  {
    key: 'lastSentAt',
    header: 'Last send',
    render: (row) => (
      <span className="text-slate-600">
        {row.lastSentAt ? formatRelative(row.lastSentAt) : 'Never'}
      </span>
    ),
  },
]

export function AdminAnalyticsPage() {
  const breadcrumb = useAdminBreadcrumbs()
  const [granularity, setGranularity] = useState('day')

  const { query: rangeQuery, range, setRange } = useDateRange()

  const query = useMemo(() => ({ ...rangeQuery, granularity }), [rangeQuery, granularity])

  const loader = useCallback((options) => fetchAdminAnalytics({ ...query, ...options }), [query])

  const { data, error, isLoading, isRefreshing, refresh } = useAdminResource(loader, {
    deps: [query],
  })

  /**
   * The three Phase 14.6 sections, each its own request.
   *
   * Not folded into `/analytics`: they are independently permissioned on the
   * server (`mailboxes.view`, `leads.view`), so a reader who may see delivery
   * figures but not the mailbox registry gets this page with one section
   * missing rather than a 403 for the whole screen.
   */
  const mailboxLoader = useCallback(
    (options) => fetchAdminMailboxAnalytics({ ...rangeQuery, ...options }),
    [rangeQuery],
  )
  const mailboxes = useAdminResource(mailboxLoader, { deps: [rangeQuery] })

  const activityLoader = useCallback(
    (options) => fetchAdminActivity({ ...rangeQuery, limit: 40, ...options }),
    [rangeQuery],
  )
  const activity = useAdminResource(activityLoader, { deps: [rangeQuery] })

  const summary = data?.summary
  const growth = data?.growth

  const actions = (
    <>
      <Button variant="secondary" size="sm" onClick={refresh} isLoading={isRefreshing}>
        <RefreshCw className="size-3.5" aria-hidden="true" />
        Refresh
      </Button>

      {/* The reporting period closes the action row, so every screen puts it in
          the same place: page title left, page actions then period top-right.
          Same component, same `range` state, same `setRange` — the request is
          byte-for-byte what it was when this sat in a bar below the title. */}
      <AdminDateRange value={range} onChange={setRange} />
    </>
  )

  if (error) {
    return (
      <AdminPageContainer
        title="Analytics"
        subtitle="Enquiries, delivery and reply performance"
        breadcrumb={breadcrumb}
        actions={actions}
      >
        <AdminErrorState error={error} onRetry={refresh} />
      </AdminPageContainer>
    )
  }

  return (
    <AdminPageContainer
      title="Analytics"
      subtitle="Enquiries, delivery and reply performance"
      breadcrumb={breadcrumb}
      isRefreshing={isRefreshing}
      actions={actions}
    >
      {/* The one filter row. Everything below re-requests against the same slice. */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-card">
        <span className="text-xs font-medium text-slate-500">Group by</span>
        <div role="group" aria-label="Reporting granularity" className="inline-flex rounded-lg bg-slate-100 p-0.5">
          {GRANULARITIES.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setGranularity(option.value)}
              aria-pressed={granularity === option.value}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                granularity === option.value
                  ? 'bg-white text-slate-900 shadow-card'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        {data?.period && (
          <span className="ml-auto text-xs text-slate-400">
            {data.period.buckets} buckets · aggregated live at request time
          </span>
        )}
      </div>

      {isLoading ? (
        <AdminStatsLoading />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <AdminStatCard
            label="Enquiries"
            value={formatCount(summary?.leads.total)}
            icon={Target}
            tone={ADMIN_TONE.BRAND}
            trend={summary?.leads.trend}
            trendLabel="vs the first half of this window"
          />
          <AdminStatCard
            label="Emails sent"
            value={formatCount(summary?.mail.total)}
            icon={Mail}
            tone={ADMIN_TONE.SUCCESS}
            trend={summary?.mail.trend}
            trendLabel="vs the first half of this window"
            hint={
              summary?.mailSuccessRate === null
                ? 'No delivery attempts yet'
                : `${summary?.mailSuccessRate}% delivered`
            }
          />
          <AdminStatCard
            label="Replies"
            value={formatCount(summary?.replies.total)}
            icon={MessageSquare}
            tone={ADMIN_TONE.NEUTRAL}
            trend={summary?.replies.trend}
            trendLabel="vs the first half of this window"
            hint={
              summary?.replyRate === null
                ? 'Reply rate needs sent mail to compute'
                : `${formatPercent(summary?.replyRate)} of sent mail`
            }
          />
          <AdminStatCard
            label="Campaigns created"
            value={formatCount(summary?.campaigns.total)}
            icon={Megaphone}
            tone={ADMIN_TONE.WARNING}
            trend={summary?.campaigns.trend}
            trendLabel="vs the first half of this window"
            hint={
              summary?.averageFirstResponseMs
                ? `Median first response ${formatMinutes(Math.round(summary.averageFirstResponseMs / 60_000))}`
                : undefined
            }
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <AdminCard title="Enquiries created" description="New enquiries, per bucket">
          {isLoading ? (
            <AdminChartLoading />
          ) : (
            <AdminAreaChart
              data={growth?.leads ?? []}
              color={ADMIN_CHART_COLORS[0]}
              ariaLabel="New enquiries created per period"
            />
          )}
        </AdminCard>

        <AdminCard title="Emails sent" description="Outbound messages this CRM despatched">
          {isLoading ? (
            <AdminChartLoading />
          ) : (
            <AdminBarChart
              data={growth?.mail ?? []}
              color={ADMIN_CHART_COLORS[1]}
              ariaLabel="Emails sent per period"
            />
          )}
        </AdminCard>

        <AdminCard title="Replies received" description="When customers last answered">
          {isLoading ? (
            <AdminChartLoading />
          ) : (
            <AdminAreaChart
              data={growth?.replies ?? []}
              color={ADMIN_CHART_COLORS[2]}
              ariaLabel="Customer replies received per period"
            />
          )}
        </AdminCard>

        <AdminCard title="Pipeline by stage" description="Every open and closed enquiry, in stage order">
          {isLoading ? (
            <AdminChartLoading height="h-52" />
          ) : (data?.pipeline ?? []).every((row) => row.value === 0) ? (
            <AdminEmptyState
              title="No enquiries yet"
              description="The pipeline fills as enquiries are imported or created."
              compact
            />
          ) : (
            <AdminRankChart
              data={(data?.pipeline ?? []).map((row) => ({ label: row.label, value: row.value }))}
              color={ADMIN_CHART_COLORS[0]}
              ariaLabel="Enquiries by pipeline stage"
            />
          )}
        </AdminCard>
      </div>

      <AdminSection
        title="By consultant"
        description="The same figures in text, so no value on this page is reachable only by hovering a chart"
      >
        <AdminCard padded={false}>
          <AdminTable
            columns={PERFORMANCE_COLUMNS}
            rows={data?.userPerformance ?? []}
            isLoading={isLoading}
            caption="Enquiries and outcomes by owner"
            empty={
              <AdminEmptyState
                title="No enquiries to attribute yet"
                description="Once enquiries exist, they are grouped here by the consultant who owns them."
                compact
              />
            }
          />
        </AdminCard>
      </AdminSection>

      {/* --- Mailboxes ----------------------------------------------------- */}
      <AdminSection
        title="Mailbox activity"
        description="Send volume and health per connected mailbox"
        action={
          <Button
            variant="secondary"
            size="sm"
            disabled={!mailboxes.data?.items?.length}
            onClick={() =>
              downloadCsv(
                exportFilename('mailbox-analytics', data?.period),
                toCsv(
                  [
                    { key: 'emailAddress', header: 'Mailbox' },
                    { key: 'displayName', header: 'Display name' },
                    { key: 'status', header: 'Status' },
                    {
                      key: 'health',
                      header: 'Health',
                      // Same object as the column above. Without a reader the
                      // cell would export as "[object Object]".
                      value: (row) =>
                        MAILBOX_HEALTH_LABELS[row.health?.state] ?? row.health?.state ?? '',
                    },
                    {
                      key: 'healthDetail',
                      header: 'Health detail',
                      value: (row) => row.health?.detail ?? '',
                    },
                    { key: 'emailsSent', header: 'Emails sent' },
                    { key: 'campaigns', header: 'Campaigns' },
                    { key: 'assignedUserCount', header: 'Assigned users' },
                    {
                      key: 'topUser',
                      header: 'Most active user',
                      value: (row) => row.topUser?.name ?? '',
                    },
                    { key: 'lastSentAt', header: 'Last send' },
                  ],
                  mailboxes.data.items,
                ),
              )
            }
          >
            <Download className="size-3.5" aria-hidden="true" />
            Export CSV
          </Button>
        }
      >
        {mailboxes.error ? (
          <AdminErrorState error={mailboxes.error} onRetry={mailboxes.refresh} compact />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <AdminStatCard
                label="Connected mailboxes"
                value={formatCount(mailboxes.data?.summary?.total ?? 0)}
                icon={Inbox}
                isLoading={mailboxes.isLoading}
              />
              <AdminStatCard
                label="Emails sent"
                value={formatCount(mailboxes.data?.summary?.emailsSent ?? 0)}
                icon={Mail}
                tone={ADMIN_TONE.SUCCESS}
                isLoading={mailboxes.isLoading}
              />
              <AdminStatCard
                label="Unused this period"
                value={formatCount(mailboxes.data?.summary?.unused ?? 0)}
                icon={Inbox}
                tone={
                  (mailboxes.data?.summary?.unused ?? 0) > 0
                    ? ADMIN_TONE.WARNING
                    : ADMIN_TONE.NEUTRAL
                }
                isLoading={mailboxes.isLoading}
              />
            </div>

            <AdminCard padded={false}>
              <AdminTable
                columns={MAILBOX_COLUMNS}
                rows={mailboxes.data?.items ?? []}
                isLoading={mailboxes.isLoading}
                caption="Connected mailboxes by send volume"
                empty={
                  <AdminEmptyState
                    title="No mailboxes connected"
                    description="Connect a mailbox from the provider screen to see delivery figures here."
                    compact
                  />
                }
              />
              {mailboxes.data?.notes?.replies && (
                <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
                  {mailboxes.data.notes.replies}
                </p>
              )}
            </AdminCard>
          </>
        )}
      </AdminSection>

      {/* --- Timeline ------------------------------------------------------ */}
      <AdminSection
        title="Recent activity"
        description="Business events across the deployment, newest first"
      >
        <AdminCard>
          {activity.isLoading ? (
            <AdminListLoading rows={6} />
          ) : activity.error ? (
            <AdminErrorState error={activity.error} onRetry={activity.refresh} compact />
          ) : (activity.data?.items ?? []).length === 0 ? (
            <AdminEmptyState
              title="Nothing recorded in this period"
              description="Enquiries, sends, campaigns, imports and replies appear here as they happen."
              compact
            />
          ) : (
            <>
              <ol className="space-y-3">
                {activity.data.items.map((event) => (
                  <li key={event.id} className="flex gap-3">
                    {/* A dot and a rule, not an icon per type: eleven event
                        icons is a legend the reader has to learn to read a
                        list they could have read as text. */}
                    <span
                      className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-500"
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-slate-800">
                        <span className="font-medium">{event.label}</span>
                        {event.summary && <span className="text-slate-600"> — {event.summary}</span>}
                      </p>
                      <p className="text-xs text-slate-500">
                        {event.actor} · {formatRelative(event.at)}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>

              {activity.data?.meta?.note && (
                <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
                  {activity.data.meta.note} For a record of administrative changes, see the audit
                  log.
                </p>
              )}
            </>
          )}
        </AdminCard>
      </AdminSection>
    </AdminPageContainer>
  )
}

export default AdminAnalyticsPage
