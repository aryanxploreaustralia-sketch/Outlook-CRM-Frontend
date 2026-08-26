/**
 * The five figures the dashboard exists to answer in two seconds.
 *
 * ## Why these left the Enquiries card
 *
 * They used to sit above the stage bars inside one panel, which made a single
 * block carry five numbers, a heading, six labelled bars and a link. The
 * numbers are what somebody opens this page for; the stage split is context
 * for them. Separating the two lets the figures be read at a glance and lets
 * the stage list settle into being supporting information.
 *
 * ## Nothing here computes anything
 *
 * Every value is a field of the `sales` payload, rendered as it arrives, and
 * every destination is the route that figure already linked to. This component
 * decides where a number sits and nothing about what it is.
 *
 * One card with internal dividers rather than five separate cards: five
 * bordered boxes in a row is four more borders than the information needs.
 */

import { Link } from 'react-router-dom'

import { ROUTE_PATHS } from '@/routes/paths'

/**
 * The figures, in reading order.
 *
 * `recentLeads` is a **count** — enquiries created in the last thirty days —
 * not a list. Reading it as one is what broke this page in production, so the
 * label says what it measures.
 */
const FIGURES = Object.freeze([
  { key: 'totalLeads', label: 'Total', to: ROUTE_PATHS.LEADS },
  /*
   * "Added", not "New".
   *
   * The count is `createdAt >= now - 30 days`, which is when the record
   * entered the CRM — not when the enquiry arrived. The whole register was
   * imported a fortnight ago, so today this equals Total for every owner and
   * will until thirty days after that import. The arithmetic is right; the old
   * label promised something it does not measure. The calculation is untouched.
   */
  { key: 'recentLeads', label: 'Added in 30 days', to: ROUTE_PATHS.LEADS },
  { key: 'companies', label: 'Companies', to: ROUTE_PATHS.COMPANIES },
  { key: 'contacts', label: 'Contacts', to: ROUTE_PATHS.CONTACTS },
  /*
   * Campaign-eligible *enquiries*, so the link goes to the enquiries.
   *
   * The figure counts leads that a campaign may target — not campaigns. It
   * used to lead to `/campaigns`, where a reader clicking "20" met a page
   * holding one campaign. It now opens the register with the filter the Leads
   * page already has, which `LeadsPage` reads from this parameter.
   */
  { key: 'campaignReady', label: 'Campaign ready', to: `${ROUTE_PATHS.LEADS}?campaignEligible=1` },
])

/**
 * @param {{ sales?: ?object }} props
 *   `sales` is null when the server's aggregation failed. Each figure then
 *   reads as an em dash rather than a zero — "we could not count" and "there
 *   are none" are different answers, and a dashboard that confuses them is
 *   worse than one that admits the gap. The Enquiries panel below carries the
 *   explanation.
 */
export function DashboardMetrics({ sales }) {
  return (
    <dl className="grid grid-cols-2 divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white sm:grid-cols-3 sm:divide-x lg:grid-cols-5">
      {FIGURES.map((figure) => {
        const value = sales?.[figure.key]

        return (
          <Link
            key={figure.key}
            to={figure.to}
            /*
             * The whole block is the target, not just the number. A figure that
             * is clickable only on its digits is a target most people miss.
             *
             * `border-b`/`sm:border-b-0` rather than `divide-y`: the grid wraps
             * to two and three columns, and `divide-y` would draw the rule in
             * the wrong places once it does.
             */
            className="min-w-0 border-b border-slate-100 px-4 py-3 transition-colors last:border-b-0 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500/40 sm:border-b-0"
          >
            <dt className="truncate text-[11px] font-medium uppercase tracking-[0.06em] text-slate-500">
              {figure.label}
            </dt>
            <dd className="metric-figure mt-0.5 text-2xl font-semibold tabular-nums text-slate-900">
              {typeof value === 'number' ? value.toLocaleString() : '—'}
            </dd>
          </Link>
        )
      })}
    </dl>
  )
}

export default DashboardMetrics
