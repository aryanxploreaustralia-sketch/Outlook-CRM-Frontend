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
  AdminCard,
  AdminDateRange,
  AdminErrorState,
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
import { fetchAdminDashboard } from '@/admin/services/admin.service'
import { EMPTY, formatCount, formatRelative } from '@/admin/utils/format'
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
      {/*
        The register, previewed.

        Placed straight after the headline counts because those counts are what
        prompt the question this answers — which enquiries, and travelling when.
        The Lead monitor is the next click for anything beyond a glance.
      */}
      <AdminLeadsOverview />

      {/* --- Shortcuts ------------------------------------------------------ */}
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

      {!isLoading && data?.meta && (
        <p className="text-xs text-slate-400">
          Aggregated live from the CRM collections · generated {formatRelative(data.meta.generatedAt)}
        </p>
      )}
    </AdminPageContainer>
  )
}

export default AdminDashboardPage
