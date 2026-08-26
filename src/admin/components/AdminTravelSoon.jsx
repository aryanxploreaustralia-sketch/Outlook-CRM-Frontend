/**
 * Who is travelling soon.
 *
 * The dashboard's answer to the one question the register gets asked every
 * morning — "whose trip is next?" — so it does not need the Lead monitor, a
 * date field chosen, a range typed and a sort applied to answer it.
 *
 * ## One request answers the whole card
 *
 * `GET /admin/leads` already returns `pagination.total` for the filter it was
 * given, alongside the page of rows. So a single call bounded to the chosen
 * window returns both halves of this card at once: the count is the total, and
 * the five rows are the page. There is no second request for the figure, and no
 * arithmetic here that the server did not do.
 *
 * ## Why the sort had to be the server's
 *
 * "The five nearest departures" cannot be had by sorting a page in the browser.
 * The endpoint pages by `createdAt` first, so the soonest traveller can easily
 * sit on a page nobody fetched — a list that looked right and was wrong. This
 * card asks for `sort=travel`, which is the one thing the API gained for it.
 *
 * ## The window bounds
 *
 * `today <= travelDate <= today + n`, sent as dates and resolved by the server
 * like every other range in the console. Enquiries that travelled last week are
 * outside the lower bound, and enquiries with no travel date at all are
 * excluded by the bound itself — MongoDB's `$gte: <Date>` never matches a null.
 * Neither exclusion is implemented here; both fall out of asking correctly.
 */

import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CalendarClock } from 'lucide-react'

import { AdminCard } from '@/admin/components/AdminCard'
import { AdminEmptyState } from '@/admin/components/AdminEmptyState'
import { useAdminResource } from '@/admin/hooks'
import { ADMIN_PATHS } from '@/admin/routes/adminPaths'
import { fetchAdminLeads } from '@/admin/services/admin.service'
import { EMPTY, formatCount } from '@/admin/utils/format'
import { Button } from '@/components/ui/Button'
import { formatDate, toDateInput } from '@/utils/datetime'

/** The windows offered, in the order they are shown. */
const WINDOWS = [7, 14, 30]

/** Thirty days by default: the widest of the three, so nothing is hidden on arrival. */
const DEFAULT_DAYS = 30

/** How many departures the card lists. */
const ROW_LIMIT = 5

/**
 * The window as the API and the Lead monitor both spell it.
 *
 * One function, so the rows this card shows and the register the "View all"
 * button opens are filtered by the same two dates. Two copies of this
 * arithmetic is how a widget and the page behind it start disagreeing.
 */
function windowFor(days) {
  const today = new Date()
  const horizon = new Date(today)
  horizon.setDate(horizon.getDate() + days)

  return { dateField: 'travelDate', from: toDateInput(today), to: toDateInput(horizon) }
}

export function AdminTravelSoon() {
  const [days, setDays] = useState(DEFAULT_DAYS)

  const loader = useCallback(
    (options) =>
      fetchAdminLeads({
        ...windowFor(days),
        // Nearest departure first — the whole point of the card.
        sort: 'travel',
        limit: ROW_LIMIT,
        ...options,
      }),
    [days],
  )

  const { data, isLoading } = useAdminResource(loader, { deps: [days] })

  const rows = data?.items ?? []
  const total = data?.pagination?.total

  // The same window, as a link into the register the console already has.
  const monitorLink = `${ADMIN_PATHS.LEAD_MONITOR}?${new URLSearchParams(windowFor(days)).toString()}`

  return (
    <AdminCard
      title={
        <span className="flex items-center gap-2">
          <CalendarClock className="size-4 text-slate-400" aria-hidden="true" />
          Travel soon
        </span>
      }
      description="Upcoming enquiries, by travel date."
      action={
        <Button as={Link} to={monitorLink} variant="secondary" size="sm">
          View all
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Button>
      }
      padded={false}
    >
      {/* --- The window, and what it holds --------------------------------- */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-100 px-5 py-3">
        {/* The console's segmented control, unchanged — the same one Analytics
            groups by and the Audit log switches views with. */}
        <div role="group" aria-label="Travel window" className="inline-flex rounded-lg bg-slate-100 p-0.5">
          {WINDOWS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setDays(option)}
              aria-pressed={days === option}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                days === option
                  ? 'bg-white text-slate-900 shadow-card'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {option} days
            </button>
          ))}
        </div>

        <p className="ml-auto flex items-baseline gap-2">
          {isLoading ? (
            <span className="skeleton block h-6 w-10" />
          ) : (
            <span className="metric-figure text-xl font-semibold text-slate-900">
              {formatCount(total)}
            </span>
          )}
          <span className="text-xs text-slate-500">Next {days} days</span>
        </p>
      </div>

      {/* --- The nearest departures ---------------------------------------- */}
      {isLoading ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: ROW_LIMIT }, (_, index) => (
            <span key={index} className="skeleton block h-7 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <AdminEmptyState
          title="No upcoming travel in this period"
          description="Try a longer window, or check the register for undated enquiries."
          compact
        />
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows.map((lead) => (
            <li key={lead.id}>
              {/*
                The whole row is the link, to the console's existing enquiry
                page. Nothing new is routed and nothing new is rendered there.
              */}
              <Link
                to={ADMIN_PATHS.LEAD_DETAIL.replace(':id', lead.id)}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-5 py-2 transition-colors hover:bg-slate-50"
              >
                <span className="w-[5.5rem] shrink-0 text-sm tabular-nums text-slate-700">
                  {formatDate(lead.travelDate)}
                </span>
                <span className="w-24 shrink-0 truncate font-mono text-xs font-medium text-brand-700">
                  {lead.reference}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-slate-700">
                  {lead.customer ?? EMPTY}
                </span>
                <span className="min-w-0 max-w-40 shrink-0 truncate text-xs text-slate-500">
                  {lead.assignedTo ?? 'Unassigned'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AdminCard>
  )
}

export default AdminTravelSoon
