/**
 * The register at a glance: headline counts and the stage split.
 *
 * Every figure comes from the `sales` block of `GET /v1/dashboard`, which is
 * the server's `leadStatistics` aggregation. Nothing here is computed from a
 * sample, estimated, or held as a default — a number on this card is a number
 * the database returned.
 *
 * ## Why `sales === null` is its own state
 *
 * The server builds `sales` in a try/catch and hands back `null` when the
 * aggregation fails, precisely so one broken widget cannot blank the dashboard.
 * Rendering `0` in that case would be a lie in the most damaging direction:
 * "you have no leads" and "we could not count your leads" look identical to the
 * reader but mean opposite things. So a failure says so and offers the register
 * itself as the way to check.
 */

import { Link } from 'react-router-dom'
import { ArrowRight, Users } from 'lucide-react'

import { LEAD_STAGES } from '@/constants/lead.constants'
import { ROUTE_PATHS } from '@/routes/paths'

/** Bar colours per stage, matching the badge palette so the two read as one system. */
const STAGE_BAR = Object.freeze({
  active: 'bg-blue-500',
  inactive: 'bg-amber-500',
  confirmed: 'bg-emerald-500',
  closed: 'bg-slate-400',
})

/** A headline count. `null` renders an em dash rather than a zero. */
function Figure({ label, value, to }) {
  const body = (
    <>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">
        {typeof value === 'number' ? value.toLocaleString() : '—'}
      </dd>
    </>
  )

  return to ? (
    <Link
      to={to}
      className="rounded-lg px-3 py-2 transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
    >
      {body}
    </Link>
  ) : (
    <div className="px-3 py-2">{body}</div>
  )
}

/** @param {{ sales: ?object }} props */
export function CrmOverviewCard({ sales }) {
  if (!sales) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">Enquiries</h2>
        <p className="mt-2 text-sm text-slate-500">
          These figures could not be loaded. The rest of the dashboard is unaffected.
        </p>
        <Link
          to={ROUTE_PATHS.LEADS}
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 hover:text-slate-900"
        >
          Open the register <ArrowRight className="size-3.5" />
        </Link>
      </section>
    )
  }

  const byStage = sales.byStage ?? {}
  const total = LEAD_STAGES.reduce((sum, stage) => sum + (byStage[stage.value] ?? 0), 0)

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Users className="size-4 text-slate-400" aria-hidden="true" />
          Enquiries
        </h2>
        <Link
          to={ROUTE_PATHS.LEADS}
          className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-900"
        >
          View all <ArrowRight className="size-3" />
        </Link>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-5">
        <Figure label="Total" value={sales.totalLeads} to={ROUTE_PATHS.LEADS} />
        {/*
          `sales.recentLeads` is a COUNT — enquiries created in the last thirty
          days — not a list. Reading it as one is what broke this page in
          production, so it is labelled here for what it actually measures.
          The list of recent enquiries comes from `GET /v1/leads` instead; see
          `useRecentLeads`.
        */}
        <Figure label="New in 30 days" value={sales.recentLeads} to={ROUTE_PATHS.LEADS} />
        <Figure label="Companies" value={sales.companies} to={ROUTE_PATHS.COMPANIES} />
        <Figure label="Contacts" value={sales.contacts} to={ROUTE_PATHS.CONTACTS} />
        <Figure label="Campaign ready" value={sales.campaignReady} to={ROUTE_PATHS.CAMPAIGNS} />
      </dl>

      {/* --- Stage split ---------------------------------------------------
          The four stages the register carries, in board order. Read from
          LEAD_STAGES so this cannot drift from the filter dropdown. */}
      <div className="mt-5">
        <div className="flex items-baseline justify-between">
          <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500">By stage</h3>
          {total === 0 && <span className="text-xs text-slate-400">No enquiries yet</span>}
        </div>

        <ul className="mt-2 space-y-2">
          {LEAD_STAGES.map((stage) => {
            const count = byStage[stage.value] ?? 0
            // Guarded against a zero total so an empty register renders flat
            // bars rather than NaN widths.
            const share = total === 0 ? 0 : (count / total) * 100

            return (
              <li key={stage.value} className="flex items-center gap-3">
                <span className="w-20 shrink-0 text-sm text-slate-600">{stage.label}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full ${STAGE_BAR[stage.value] ?? 'bg-slate-400'}`}
                    style={{ width: `${share}%` }}
                  />
                </div>
                <span className="w-12 shrink-0 text-right text-sm tabular-nums text-slate-700">
                  {count.toLocaleString()}
                </span>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}

export default CrmOverviewCard
