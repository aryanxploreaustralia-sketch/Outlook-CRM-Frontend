/**
 * The newest enquiries on the register.
 *
 * ## Data contract
 *
 * `leads` is **always an array** of lead summaries — the shape
 * `GET /v1/leads` returns, which is `Lead.toSummaryJSON()`: `id`, `reference`,
 * `contactPerson`, `companyName`, `city`, `quoteDate`, `stage`. `useRecentLeads`
 * guarantees it, defaulting to `[]` before the first response and after a
 * failure, so nothing here re-checks the type.
 *
 * That guarantee is the fix for a production outage worth recording. This card
 * was previously fed `dashboard.sales.recentLeads`, which sounds like a list and
 * is in fact a **count** — the number of enquiries created in the last thirty
 * days. `leads.slice(0, 6)` on the number `2061` threw
 * `e.slice is not a function` and took the whole dashboard down with it.
 *
 * The lesson applied here is not "guard the call". A blanket
 * `Array.isArray(leads) ? … : []` would have turned a contract mismatch into a
 * silently empty card, which is harder to notice and no more correct. The right
 * repair was to read the list from the endpoint that serves records, and to say
 * plainly — here — what this component requires.
 *
 * ## States
 *
 * Loading, failed, empty and populated are four distinct situations and each
 * says something different. In particular, loading must not render the empty
 * state: "no enquiries yet" invites the reader to import a workbook, and
 * showing that for a moment to someone with two thousand leads is wrong.
 */

import { Link } from 'react-router-dom'
import { ArrowRight, Inbox } from 'lucide-react'

import { LeadStageBadge } from '@/components/leads/LeadStageBadge'
import { RECENT_LEADS_LIMIT } from '@/hooks/useRecentLeads'
import { ROUTE_PATHS } from '@/routes/paths'

/** Renders a date, tolerating null and unparseable values. */
function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString()
}

/** Placeholder rows sized to the real ones, so the card does not resize on load. */
function LoadingRows() {
  return (
    <ul className="mt-3 divide-y divide-slate-100" aria-busy="true">
      {Array.from({ length: 4 }, (_, index) => (
        <li key={index} className="flex items-center gap-3 py-2.5">
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="h-3.5 w-40 animate-pulse rounded bg-slate-200/80" />
            <div className="h-3 w-56 animate-pulse rounded bg-slate-200/60" />
          </div>
          <div className="h-5 w-16 animate-pulse rounded-full bg-slate-200/70" />
        </li>
      ))}
    </ul>
  )
}

/**
 * @param {{
 *   leads: Array<object>,
 *   isLoading?: boolean,
 *   isError?: boolean,
 *   onRetry?: () => void,
 * }} props
 */
export function RecentLeadsCard({ leads, isLoading = false, isError = false, onRetry }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Inbox className="size-4 text-slate-400" aria-hidden="true" />
          Recent enquiries
        </h2>
        <Link
          to={ROUTE_PATHS.LEADS}
          className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-900"
        >
          View all <ArrowRight className="size-3" />
        </Link>
      </div>

      {/* Order matters: loading is checked before empty, so a populated
          register never flashes "no enquiries yet" while it loads. */}
      {isLoading ? (
        <LoadingRows />
      ) : isError ? (
        <div className="mt-3">
          <p className="text-sm text-slate-500">
            Recent enquiries could not be loaded. The rest of the dashboard is unaffected.
          </p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-2 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Try again
            </button>
          )}
        </div>
      ) : leads.length === 0 ? (
        <div className="mt-3">
          <p className="text-sm text-slate-500">No enquiries on the register yet.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              to={ROUTE_PATHS.LEAD_IMPORT}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
            >
              Import a workbook
            </Link>
            <Link
              to={ROUTE_PATHS.LEAD_NEW}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Add one manually
            </Link>
          </div>
        </div>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100">
          {/* The request already asks for this many, so the slice is a cap the
              card enforces for itself rather than a trim it depends on. Safe
              now only because `leads` is contractually an array — see above. */}
          {leads.slice(0, RECENT_LEADS_LIMIT).map((lead) => (
            <li key={lead.id} className="flex items-center gap-3 py-2">
              <div className="min-w-0 flex-1">
                <Link
                  to={`${ROUTE_PATHS.LEADS}/${lead.id}`}
                  className="block truncate text-sm font-medium text-slate-900 hover:underline"
                >
                  {lead.contactPerson || lead.reference || 'Untitled enquiry'}
                </Link>
                <p className="truncate text-xs text-slate-500">
                  {[lead.reference, lead.companyName, lead.city].filter(Boolean).join(' · ') || '—'}
                </p>
              </div>
              <span className="hidden shrink-0 text-xs tabular-nums text-slate-400 sm:block">
                {formatDate(lead.quoteDate)}
              </span>
              <LeadStageBadge stage={lead.stage} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default RecentLeadsCard
