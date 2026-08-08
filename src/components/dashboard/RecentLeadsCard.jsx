/**
 * The newest enquiries on the register.
 *
 * Rows come from `sales.recentLeads` on the `/v1/dashboard` payload — the same
 * request the rest of this page already makes, so the card costs no extra round
 * trip. Each entry is a lead's `toSummaryJSON()`, which is the shape the leads
 * table itself renders, so the two can never disagree about a stage or a name.
 *
 * Three states, and the middle one matters: an empty register is a normal
 * situation for a new deployment and says so with a way forward, whereas a
 * failed request says *that* instead of quietly showing "no enquiries".
 */

import { Link } from 'react-router-dom'
import { ArrowRight, Inbox } from 'lucide-react'

import { LeadStageBadge } from '@/components/leads/LeadStageBadge'
import { ROUTE_PATHS } from '@/routes/paths'

/** Renders a date, tolerating null and unparseable values. */
function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString()
}

/** @param {{ leads: ?Array<object>, unavailable?: boolean }} props */
export function RecentLeadsCard({ leads, unavailable = false }) {
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

      {unavailable ? (
        <p className="mt-3 text-sm text-slate-500">
          Recent enquiries could not be loaded.
        </p>
      ) : (leads ?? []).length === 0 ? (
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
          {leads.slice(0, 6).map((lead) => (
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
