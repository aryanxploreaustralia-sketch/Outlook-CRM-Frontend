/**
 * Administration home.
 *
 * Answers one question — *is the business running today?* — laid out in the
 * order an operator asks it: the headline counts, then what changed, then what
 * is broken.
 *
 * Every figure comes from `GET /api/v1/admin/dashboard`, aggregated live from
 * the collections the CRM modules already own. Nothing here is stored twice.
 *
 * ## Two kinds of number, kept apart
 *
 * "5 mailboxes connected" is true whatever period is selected. "80 emails sent"
 * is only true *of a period*. Putting both in one grid, as most admin
 * dashboards do, produces a screen where the date filter changes some cards and
 * not others with nothing saying which — so the two live under separate
 * headings, and the period-scoped section states its dates.
 *
 * ## Blocks degrade independently
 *
 * The server resolves each block separately and sends `null` for any it could
 * not read — `null` rather than zeroes, so "there are no campaigns" and "the
 * campaign counts could not be read" stay distinguishable. `count()` below
 * renders the second as a dash rather than as `0`, because a zero that means
 * "unknown" is worse than no number at all.
 */

import { useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity,
  ArrowRight,
  CalendarClock,
  FileSpreadsheet,
  Inbox,
  Mail,
  Megaphone,
  MessageSquare,
  RefreshCw,
  Target,
  Trophy,
  UserCheck,
  Users,
} from 'lucide-react'

import {
  AdminBadge,
  AdminCard,
  AdminDateRange,
  AdminErrorState,
  AdminListLoading,
  AdminPageContainer,
  AdminSection,
  AdminStatCard,
  AdminStatsLoading,
} from '@/admin/components'
import { ADMIN_SCOPE_NOTICE, ADMIN_TONE } from '@/admin/constants/admin.constants'
import { AdminGreeting } from '@/admin/components/AdminGreeting'
import { AdminLeadsOverview } from '@/admin/components/AdminLeadsOverview'
import { useAuth } from '@/hooks/useAuth'
import { useAdminBreadcrumbs, useAdminResource } from '@/admin/hooks'
import { useDateRange } from '@/admin/hooks/useDateRange'
import { ADMIN_PATHS } from '@/admin/routes/adminPaths'
import { PerformanceWidgets } from '@/admin/components/performance/PerformanceDashboard'
import { fetchAdminDashboard, fetchPerformanceHighlights } from '@/admin/services/admin.service'
import { EMPTY, formatCount, formatMinutes, formatRelative } from '@/admin/utils/format'
import { Button } from '@/components/ui/Button'

/** A block the server could not read renders as a dash, never as zero. */
const count = (value) => (value === null || value === undefined ? EMPTY : formatCount(value))

/** The four things an admin most often arrives here to do. */
const QUICK_LINKS = [
  { label: 'Users', description: 'Who has access', icon: Users, to: ADMIN_PATHS.USERS },
  { label: 'Mailboxes', description: 'Connection and sync health', icon: Inbox, to: ADMIN_PATHS.MAILBOXES },
  { label: 'Analytics', description: 'Leads, mail and replies', icon: Target, to: ADMIN_PATHS.ANALYTICS },
  { label: 'Team', description: 'Contribution by person', icon: Trophy, to: ADMIN_PATHS.TEAM },
  { label: 'System health', description: 'Every dependency', icon: Activity, to: ADMIN_PATHS.HEALTH },
]

export function AdminDashboardPage() {
  const breadcrumb = useAdminBreadcrumbs()

  const auth = useAuth()
  const { query: rangeQuery, range, setRange } = useDateRange()

  const query = useMemo(() => ({ ...rangeQuery }), [rangeQuery])

  const loader = useCallback((options) => fetchAdminDashboard({ ...query, ...options }), [query])

  const { data, error, isLoading, isRefreshing, refresh } = useAdminResource(loader, {
    deps: [query],
  })

  const highlightsLoader = useCallback(
    (options) => fetchPerformanceHighlights({ range: query, ...options }),
    [query],
  )

  const {
    data: highlights,
    error: highlightsError,
    isLoading: highlightsLoading,
    refresh: refreshHighlights,
  } = useAdminResource(highlightsLoader, { deps: [query] })


  const actions = (
    <Button variant="secondary" size="sm" onClick={refresh} isLoading={isRefreshing}>
      <RefreshCw className="size-3.5" aria-hidden="true" />
      Refresh
    </Button>
  )

  if (error) {
    return (
      <AdminPageContainer
        title="Dashboard"
        subtitle="Workspace activity, delivery and platform health"
        breadcrumb={breadcrumb}
        actions={actions}
      >
        <AdminErrorState error={error} onRetry={refresh} />
      </AdminPageContainer>
    )
  }

  const workersBusy = data?.workers
    ? Object.entries(data.workers).filter(([, worker]) => worker.busy).map(([name]) => name)
    : []

  return (
    <AdminPageContainer
      /*
       * No `title`: the greeting above is this page's heading. Two headings —
       * "Dashboard" and "Good afternoon, Aryan" — would be the exact
       * same-weight competition this phase exists to remove.
       */
      subtitle="Workspace activity, delivery and platform health"
      breadcrumb={breadcrumb}
      notice={ADMIN_SCOPE_NOTICE}
      isRefreshing={isRefreshing}
      actions={actions}
    >
      {/*
        Phase 16.1A: the dashboard opens with a greeting and a health verdict.

        Every other admin page states its subject; this one is the landing page,
        and its job is to tell an operator whether they need to do anything at
        all before they start reading figures.
      */}
      <AdminGreeting user={auth.user} data={data} isLoading={isLoading} />

      <AdminDateRange
        value={range}
        onChange={setRange}
        resolved={data?.period}
      />

      {/* --- Period-scoped ------------------------------------------------
          These four move with the date filter. Everything below "Right now"
          does not, which is why they are not in the same grid. */}
      <AdminSection
        title="Selected period"
        description="Activity recorded inside the dates chosen above."
      >
        {isLoading ? (
          <AdminStatsLoading count={4} />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <AdminStatCard
              label="Emails sent"
              value={count(data.period?.emails)}
              icon={Mail}
              tone={ADMIN_TONE.SUCCESS}
            />
            <AdminStatCard
              label="Replies received"
              value={count(data.period?.replies)}
              icon={MessageSquare}
              tone={ADMIN_TONE.BRAND}
            />
            <AdminStatCard
              label="Enquiries created"
              value={count(data.period?.leads)}
              icon={Target}
              tone={ADMIN_TONE.NEUTRAL}
            />
            <AdminStatCard
              label="Workbook imports"
              value={count(data.period?.imports)}
              icon={FileSpreadsheet}
              tone={ADMIN_TONE.NEUTRAL}
            />
          </div>
        )}
      </AdminSection>

      {/*
        Phase 17.3 — who stood out in the selected period, and who needs a look.

        A second request rather than a field on the dashboard payload: it runs
        nine aggregations, and the dashboard's own response is the one an
        operator waits on. Loading it separately means the page paints without
        it and fills in.
      */}
      <AdminSection
        title="People"
        description="Performance across the team for the selected period. Every figure is derived live; nobody is scored on anything the CRM does not record."
      >
        {highlightsError ? (
          <AdminErrorState error={highlightsError} onRetry={refreshHighlights} compact />
        ) : (
          <PerformanceWidgets widgets={highlights?.widgets} isLoading={highlightsLoading} />
        )}
      </AdminSection>


      {/* --- Headline counts --------------------------------------------- */}
      <AdminSection
        title="Right now"
        description="Standing totals. These do not change with the selected period."
      >
        {isLoading ? (
          <AdminStatsLoading count={8} />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <AdminStatCard
              label="Total users"
              value={count(data.users?.total)}
              icon={Users}
              tone={ADMIN_TONE.BRAND}
              hint={
                data.users
                  ? `${data.users.active} active in ${data.users.activeWindowDays} days`
                  : undefined
              }
            />
            <AdminStatCard
              label="Connected mailboxes"
              value={
                data.mailboxes ? `${data.mailboxes.connected} / ${data.mailboxes.total}` : EMPTY
              }
              icon={Inbox}
              tone={
                data.mailboxes?.connected === 0 ? ADMIN_TONE.DANGER : ADMIN_TONE.SUCCESS
              }
              hint={
                data.mailboxes
                  ? `${data.mailboxes.disconnected} disconnected · ${data.mailboxes.error} errored`
                  : undefined
              }
            />
            <AdminStatCard
              label="Total leads"
              value={count(data.leads?.total)}
              icon={Target}
              tone={ADMIN_TONE.NEUTRAL}
              hint={data.leads ? `${data.leads.stale} untouched for 30+ days` : undefined}
            />
            <AdminStatCard
              label="Leads today"
              value={count(data.leads?.today)}
              icon={Target}
              tone={ADMIN_TONE.BRAND}
              hint={
                data.companies !== null && data.contacts !== null
                  ? `${formatCount(data.companies)} companies · ${formatCount(data.contacts)} contacts`
                  : undefined
              }
            />
            <AdminStatCard
              label="Emails sent"
              value={count(data.mail?.sent)}
              icon={Mail}
              tone={ADMIN_TONE.SUCCESS}
              hint={
                data.mail
                  ? `${data.mail.sentToday} today · ${data.mail.pending} pending · ${data.mail.failed} failed`
                  : undefined
              }
            />
            <AdminStatCard
              label="Replies received"
              value={count(data.conversations?.replies)}
              icon={MessageSquare}
              tone={ADMIN_TONE.NEUTRAL}
              hint={
                data.conversations
                  ? `${data.conversations.unread} unread · ${data.conversations.openThreads} open threads`
                  : undefined
              }
            />
            <AdminStatCard
              label="Campaigns running"
              value={count(data.campaigns?.running)}
              icon={Megaphone}
              tone={data.campaigns?.running > 0 ? ADMIN_TONE.WARNING : ADMIN_TONE.NEUTRAL}
              hint={
                data.campaigns
                  ? `${data.campaigns.draft} draft · ${data.campaigns.completed} completed`
                  : undefined
              }
            />
            <AdminStatCard
              label="Workbook imports"
              value={count(data.imports?.total)}
              icon={FileSpreadsheet}
              tone={data.imports?.failed > 0 ? ADMIN_TONE.DANGER : ADMIN_TONE.NEUTRAL}
              hint={
                data.imports
                  ? `${data.imports.failed} failed · ${data.imports.queued} queued`
                  : undefined
              }
            />
            {/* Observed, not estimated: a session's `lastUsedAt` is written on
                every authenticated request, so this counts people who actually
                made one — not people who left a tab open. */}
            <AdminStatCard
              label="Online now"
              value={count(data.online?.count)}
              icon={UserCheck}
              tone={ADMIN_TONE.BRAND}
              hint={
                data.online
                  ? `Active in the last ${data.online.withinMinutes} minutes`
                  : undefined
              }
            />
          </div>
        )}
      </AdminSection>

      {/*
        The register, previewed.

        Placed straight after the headline counts because those counts are what
        prompt the question this answers — which enquiries, and travelling when.
        The Lead monitor is the next click for anything beyond a glance.
      */}
      <AdminLeadsOverview />

      {/* --- Automation + shortcuts --------------------------------------- */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <AdminCard
          className="lg:col-span-2"
          title="Automation"
          description="The morning run, the reply sync and the workbook queue"
        >
          {isLoading ? (
            <AdminListLoading rows={4} />
          ) : !data.scheduler?.configured ? (
            <p className="text-sm text-slate-500">
              {data.scheduler?.message ?? 'No scheduling workspace has been elected yet.'}
            </p>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <AdminBadge tone={data.scheduler.enabled ? 'success' : 'warning'} dot>
                  {data.scheduler.enabled ? 'Scheduler enabled' : 'Scheduler off'}
                </AdminBadge>
                {data.scheduler.lastStatusLabel && (
                  <AdminBadge tone={data.scheduler.lastStatus === 'failed' ? 'danger' : 'neutral'}>
                    Last run: {data.scheduler.lastStatusLabel}
                  </AdminBadge>
                )}
                {workersBusy.length > 0 && (
                  <AdminBadge tone="info" dot>
                    {workersBusy.join(', ')} running
                  </AdminBadge>
                )}
              </div>

              <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                {[
                  {
                    label: 'Scheduled run',
                    value: `${data.scheduler.runTime} · ${data.scheduler.timezone}`,
                    icon: CalendarClock,
                  },
                  { label: 'Next run', value: formatRelative(data.scheduler.nextRunAt) },
                  { label: 'Last run', value: formatRelative(data.scheduler.lastRunAt) },
                  {
                    label: 'Reply sync',
                    value: data.scheduler.replySync?.enabled
                      ? `Every ${data.scheduler.replySync.intervalMinutes} min · last ${formatRelative(data.scheduler.replySync.lastRunAt)}`
                      : 'Disabled',
                  },
                  {
                    label: 'Workbook queue',
                    value: data.imports
                      ? `${data.imports.queued} queued · ${data.imports.running ?? 0} running`
                      : EMPTY,
                  },
                  {
                    label: 'Unread notifications',
                    value: count(data.notifications?.unread),
                  },
                ].map((row) => (
                  <div key={row.label} className="flex items-baseline justify-between gap-3">
                    <dt className="flex items-center gap-1.5 text-xs text-slate-500">
                      {row.icon && <row.icon className="size-3.5" aria-hidden="true" />}
                      {row.label}
                    </dt>
                    <dd className="text-sm font-medium text-slate-800">{row.value}</dd>
                  </div>
                ))}
              </dl>

              {data.lastImport && (
                <div className="rounded-lg bg-slate-50 px-4 py-3">
                  <p className="text-xs text-slate-500">Most recent workbook</p>
                  <p className="mt-0.5 truncate text-sm font-medium text-slate-800">
                    {data.lastImport.filename}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {data.lastImport.status} · {formatRelative(data.lastImport.at)}
                  </p>
                </div>
              )}
            </div>
          )}
        </AdminCard>

        <div className="space-y-6">
          <AdminCard
            title="Delivery"
            description="How outbound mail is performing"
          >
            {isLoading ? (
              <AdminListLoading rows={3} />
            ) : (
              <dl className="space-y-3">
                {[
                  { label: 'Success rate', value: data.mail?.successRate === null || data.mail?.successRate === undefined ? EMPTY : `${data.mail.successRate}%` },
                  { label: 'Drafts', value: count(data.mail?.drafts) },
                  { label: 'Replied to', value: count(data.mail?.replied) },
                  {
                    label: 'Median first response',
                    value: data.conversations?.averageFirstResponseMs
                      ? formatMinutes(Math.round(data.conversations.averageFirstResponseMs / 60_000))
                      : EMPTY,
                  },
                ].map((row) => (
                  <div key={row.label} className="flex items-baseline justify-between gap-3">
                    <dt className="text-xs text-slate-500">{row.label}</dt>
                    <dd className="text-sm font-medium text-slate-800">{row.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </AdminCard>

          <AdminCard title="Go to">
            <ul className="space-y-1.5">
              {QUICK_LINKS.map((link) => (
                <li key={link.label}>
                  <Link
                    to={link.to}
                    className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-slate-50"
                  >
                    <span
                      className="grid size-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600"
                      aria-hidden="true"
                    >
                      <link.icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-800">
                        {link.label}
                      </span>
                      <span className="block truncate text-xs text-slate-500">
                        {link.description}
                      </span>
                    </span>
                    <ArrowRight className="size-4 shrink-0 text-slate-300" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </AdminCard>
        </div>
      </div>

      {!isLoading && data?.meta && (
        <p className="text-xs text-slate-400">
          Aggregated live from the CRM collections · generated {formatRelative(data.meta.generatedAt)}
        </p>
      )}
    </AdminPageContainer>
  )
}

export default AdminDashboardPage
