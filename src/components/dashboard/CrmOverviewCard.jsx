/**
 * Where the register stands, by stage.
 *
 * ## What this card no longer does
 *
 * It used to open with five headline figures and then show the stage split
 * beneath them. The figures moved to `DashboardMetrics`, directly under the
 * page heading, because they are what the page is opened for. What is left is
 * the context for those numbers, and it is presented as context: compact rows
 * with a thin share indicator, not six bars competing with everything else on
 * the screen.
 *
 * ## The data is untouched
 *
 * The same `sales.byStage` map, the same `LEAD_STAGES` order, the same total
 * (the sum of the stage counts), the same share arithmetic and the same link.
 * Read from `LEAD_STAGES` so this list cannot drift from the filter dropdown.
 */

import { Link } from 'react-router-dom'
import { ArrowRight, Users } from 'lucide-react'

import { LEAD_STAGES } from '@/constants/lead.constants'
import { ROUTE_PATHS } from '@/routes/paths'

const STAGE_BAR = Object.freeze({
  active: 'bg-blue-500',
  inactive: 'bg-amber-500',
  confirmed: 'bg-emerald-500',
  closed: 'bg-slate-400',
  not_operating: 'bg-rose-400',
  query: 'bg-sky-500',
})

/** The card's frame, so the failure state and the populated state agree. */
function Panel({ children }) {
  return (
    <section className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Users className="size-4 text-slate-400" aria-hidden="true" />
          Enquiries by stage
        </h2>
        <Link
          to={ROUTE_PATHS.LEADS}
          className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 transition-colors hover:text-slate-900"
        >
          View all <ArrowRight className="size-3" aria-hidden="true" />
        </Link>
      </div>

      {children}
    </section>
  )
}

export function CrmOverviewCard({ sales }) {
  if (!sales) {
    return (
      <Panel>
        <p className="mt-3 text-sm text-slate-500">
          These figures could not be loaded. The rest of the dashboard is unaffected.
        </p>
      </Panel>
    )
  }

  const byStage = sales.byStage ?? {}
  const total = LEAD_STAGES.reduce((sum, stage) => sum + (byStage[stage.value] ?? 0), 0)

  return (
    <Panel>
      {total === 0 && (
        <p className="mt-3 text-sm text-slate-500">No enquiries yet.</p>
      )}

      <ul className="mt-3 space-y-0.5">
        {LEAD_STAGES.map((stage) => {
          const count = byStage[stage.value] ?? 0
          // Guarded against a zero total so an empty register renders flat
          // indicators rather than NaN widths.
          const share = total === 0 ? 0 : (count / total) * 100

          return (
            <li
              key={stage.value}
              /*
               * A row, not a bar chart. The indicator is capped to a narrow
               * column so a dominant stage cannot stretch a rule across the
               * card — the count is the fact, the bar is the hint.
               */
              className="flex items-center gap-3 rounded-md px-1 py-1.5"
            >
              <span className="w-24 shrink-0 truncate text-sm text-slate-600">{stage.label}</span>

              <span className="h-1.5 w-full max-w-32 shrink-0 overflow-hidden rounded-full bg-slate-100">
                <span
                  className={`block h-full rounded-full ${STAGE_BAR[stage.value] ?? 'bg-slate-400'}`}
                  style={{ width: `${share}%` }}
                />
              </span>

              <span className="ml-auto shrink-0 text-sm font-medium tabular-nums text-slate-800">
                {count.toLocaleString()}
              </span>

              {/* The share in words, for anybody who cannot see the bar. */}
              <span className="w-10 shrink-0 text-right text-xs tabular-nums text-slate-400">
                {total === 0 ? '' : `${Math.round(share)}%`}
              </span>
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}

export default CrmOverviewCard
