/**
 * A glance at the register, so the console can answer "what came in and what is
 * coming up" without opening the monitor.
 *
 * ## It is a preview, not a second monitor
 *
 * Five rows, four columns, two figures and a way through to the real thing. No
 * filters, no pagination, no sorting — every one of those exists on the Lead
 * monitor, and a second half-implementation of them here is how two screens
 * start disagreeing about what the register contains.
 *
 * ## Where the numbers come from
 *
 * The same endpoint the monitor uses, with the parameters it already accepts.
 * Nothing is computed in the browser and nothing new was added to the server:
 *
 *   - recent rows  — `GET /admin/leads?limit=5`, which sorts `createdAt: -1`
 *   - upcoming     — the same call bounded to `travelDate` over the next 30
 *                    days, read from `pagination.total` rather than by counting
 *                    rows, so the figure describes the register and not a page
 *
 * `limit: 1` on the second one because only the total is wanted; asking for
 * rows nobody renders would be a page of documents fetched to be discarded.
 */

import { useCallback } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CalendarClock, Plane, Sunrise } from 'lucide-react'

import { AdminCard } from '@/admin/components/AdminCard'
import { AdminEmptyState } from '@/admin/components/AdminEmptyState'
import { useAdminResource } from '@/admin/hooks'
import { ADMIN_PATHS } from '@/admin/routes/adminPaths'
import { fetchAdminLeads } from '@/admin/services/admin.service'
import { EMPTY, formatCount } from '@/admin/utils/format'
import { Button } from '@/components/ui/Button'
import { formatDate, toDateInput } from '@/utils/datetime'

/** How far ahead "upcoming travel" looks. */
const UPCOMING_DAYS = 30

/** How many rows the preview shows. */
const RECENT_LIMIT = 5

export function AdminLeadsOverview() {
  const recentLoader = useCallback((options) => fetchAdminLeads({ limit: RECENT_LIMIT, ...options }), [])
  const { data: recent, isLoading } = useAdminResource(recentLoader, { deps: [] })

  const upcomingLoader = useCallback(
    (options) => {
      const today = new Date()
      const horizon = new Date(today)
      horizon.setDate(horizon.getDate() + UPCOMING_DAYS)

      return fetchAdminLeads({
        dateField: 'travelDate',
        from: toDateInput(today),
        to: toDateInput(horizon),
        // Only the total is read; a page of rows nobody renders is waste.
        limit: 1,
        ...options,
      })
    },
    [],
  )
  const { data: upcoming, isLoading: isUpcomingLoading } = useAdminResource(upcomingLoader, { deps: [] })

  /*
   * Today's intake.
   *
   * It used to sit in the dashboard's "Right now" strip. That strip is gone, and
   * "how many came in today" is the first thing anybody asks of a register — so
   * it moved here rather than being lost with the section that happened to hold
   * it. Same endpoint, the `createdAt` field over the `today` preset, and only
   * the total is read.
   */
  const todayLoader = useCallback(
    (options) => fetchAdminLeads({ dateField: 'createdAt', preset: 'today', limit: 1, ...options }),
    [],
  )
  const { data: today, isLoading: isTodayLoading } = useAdminResource(todayLoader, { deps: [] })

  const rows = recent?.items ?? []

  return (
    <AdminCard
      title="Leads overview"
      description="The newest enquiries, and what is travelling soon."
      action={
        <Button as={Link} to={ADMIN_PATHS.LEAD_MONITOR} variant="secondary" size="sm">
          Open Lead monitor
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Button>
      }
      padded={false}
    >
      {/* --- The figures ----------------------------------------------------- */}
      <dl className="grid grid-cols-1 divide-y divide-slate-100 border-b border-slate-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {[
          {
            label: 'Total leads',
            icon: CalendarClock,
            value: recent?.summary?.total,
            busy: isLoading,
          },
          {
            label: 'Came in today',
            icon: Sunrise,
            value: today?.pagination?.total,
            busy: isTodayLoading,
          },
          {
            label: `Travelling in ${UPCOMING_DAYS} days`,
            icon: Plane,
            value: upcoming?.pagination?.total,
            busy: isUpcomingLoading,
          },
        ].map((figure) => (
          <div key={figure.label} className="px-5 py-3">
            <dt className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.06em] text-slate-500">
              <figure.icon className="size-3.5 shrink-0 text-slate-400" aria-hidden="true" />
              <span className="truncate">{figure.label}</span>
            </dt>
            <dd className="metric-figure mt-0.5 text-xl font-semibold text-slate-900">
              {figure.busy ? <span className="skeleton block h-6 w-14" /> : formatCount(figure.value)}
            </dd>
          </div>
        ))}
      </dl>

      {/* --- The newest enquiries ------------------------------------------- */}
      {isLoading ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: RECENT_LIMIT }, (_, index) => (
            <span key={index} className="skeleton block h-8 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <AdminEmptyState title="No enquiries yet" description="Imported and manual leads appear here." compact />
      ) : (
        <div className="scroll-x w-full overflow-x-auto">
          <table className="w-full min-w-[34rem] table-auto border-collapse text-sm">
            <caption className="sr-only">The five newest enquiries</caption>
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60 text-left">
                {['Reference', 'Customer', 'Owner', 'Travel date'].map((heading) => (
                  <th
                    key={heading}
                    scope="col"
                    className="whitespace-nowrap px-5 py-2 text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-500"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((lead) => (
                <tr key={lead.id} className="transition-colors hover:bg-slate-50/70">
                  <td className="whitespace-nowrap px-5 py-2">
                    <Link
                      to={ADMIN_PATHS.LEAD_DETAIL.replace(':id', lead.id)}
                      className="font-mono text-xs font-medium text-brand-700 hover:underline"
                    >
                      {lead.reference}
                    </Link>
                  </td>
                  <td className="max-w-44 truncate px-5 py-2 text-slate-700">{lead.customer ?? EMPTY}</td>
                  <td className="max-w-40 truncate px-5 py-2 text-slate-600">{lead.assignedTo ?? 'Unassigned'}</td>
                  <td className="whitespace-nowrap px-5 py-2 text-slate-600">
                    {/* Prose travel dates are shown as written, as everywhere else. */}
                    {lead.travelDate ? formatDate(lead.travelDate) : (lead.travelDateText ?? EMPTY)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminCard>
  )
}

export default AdminLeadsOverview
