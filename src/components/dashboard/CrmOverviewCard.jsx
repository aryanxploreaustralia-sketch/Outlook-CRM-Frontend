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
 * ## Why it ends with a summary
 *
 * The card sits in a two-column row opposite Recent enquiries and stretches to
 * match it. Six short rows do not fill that height, which left an obvious gap
 * below them. The summary is pushed to the bottom with `mt-auto`, so the space
 * the layout was always going to allocate is occupied by something useful
 * instead of by nothing.
 *
 * ## The data is untouched
 *
 * The same `sales.byStage` map, the same `LEAD_STAGES` order, the same total
 * (the sum of the stage counts) and the same share arithmetic. The ring, the
 * legend and the three figures are all read from those — there is no second
 * request and no value here that the rows above do not already describe.
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

/** The same palette as the bars, as SVG strokes, so the ring cannot drift. */
const STAGE_STROKE = Object.freeze({
  active: 'stroke-blue-500',
  inactive: 'stroke-amber-500',
  confirmed: 'stroke-emerald-500',
  closed: 'stroke-slate-400',
  not_operating: 'stroke-rose-400',
  query: 'stroke-sky-500',
})

const RING_SIZE = 76
const RING_STROKE = 9
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2
const RING_LENGTH = 2 * Math.PI * RING_RADIUS

/**
 * The stage split as a ring.
 *
 * Drawn with `stroke-dasharray` on one circle per stage rather than with arc
 * paths: a dash length is a plain fraction of the circumference, which cannot
 * produce the malformed wedge that arc maths does at 0% and at 100%.
 *
 * An empty register draws the track alone. A register where one stage holds
 * everything draws one unbroken ring. Both are correct and neither is a
 * special case in the code.
 */
function StageRing({ byStage, total }) {
  let consumed = 0

  return (
    <svg
      viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
      className="size-[76px] shrink-0 -rotate-90"
      role="img"
      aria-label={
        total === 0
          ? 'No enquiries to distribute'
          : LEAD_STAGES.filter((stage) => (byStage[stage.value] ?? 0) > 0)
              .map((stage) => `${stage.label} ${Math.round(((byStage[stage.value] ?? 0) / total) * 100)}%`)
              .join(', ')
      }
    >
      {/* The track. Always drawn, so a zero total still reads as a ring. */}
      <circle
        cx={RING_SIZE / 2}
        cy={RING_SIZE / 2}
        r={RING_RADIUS}
        fill="none"
        strokeWidth={RING_STROKE}
        className="stroke-slate-100"
      />

      {total > 0 &&
        LEAD_STAGES.map((stage) => {
          const count = byStage[stage.value] ?? 0
          if (count === 0) return null

          const length = (count / total) * RING_LENGTH
          const offset = -consumed
          consumed += length

          return (
            <circle
              key={stage.value}
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_RADIUS}
              fill="none"
              strokeWidth={RING_STROKE}
              strokeDasharray={`${length} ${RING_LENGTH - length}`}
              strokeDashoffset={offset}
              className={STAGE_STROKE[stage.value] ?? 'stroke-slate-400'}
            />
          )
        })}
    </svg>
  )
}

/** One figure in the summary row. */
function Summary({ label, value }) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-[11px] font-medium uppercase tracking-[0.06em] text-slate-500">
        {label}
      </dt>
      <dd className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900">{value}</dd>
    </div>
  )
}

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

  /*
   * The server's count, not a second one computed here.
   *
   * This card used to sum the six stage counts to get its own total. The audit
   * confirmed the two agree for every owner — the stages are mutually
   * exclusive and account for every lead — but two independent answers to one
   * question is one too many, and a stage added server-side without updating
   * `LEAD_STAGES` would have made them diverge silently.
   *
   * The stage sum survives only as a fallback for a partial payload, so a
   * missing `totalLeads` renders a share rather than a NaN.
   */
  const total =
    sales.totalLeads ?? LEAD_STAGES.reduce((sum, stage) => sum + (byStage[stage.value] ?? 0), 0)

  const activeCount = byStage.active ?? 0
  const activeShare = total === 0 ? null : Math.round((activeCount / total) * 100)

  return (
    <Panel>
      {total === 0 && <p className="mt-3 text-sm text-slate-500">No enquiries yet.</p>}

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

      {/* --- Summary --------------------------------------------------------
          `mt-auto` puts this against the bottom of whatever height the row
          gives the card, which is what closes the gap. Everything below is
          derived from `byStage` and `total` above. */}
      <div className="mt-auto space-y-4 border-t border-slate-100 pt-4">
        <dl className="grid grid-cols-3 gap-3">
          <Summary label="Total" value={total.toLocaleString()} />
          <Summary label="Active" value={activeCount.toLocaleString()} />
          {/* An em dash, not 0%, when there is nothing to take a share of. */}
          <Summary label="Active share" value={activeShare === null ? '—' : `${activeShare}%`} />
        </dl>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <StageRing byStage={byStage} total={total} />

          {/*
            A colour key, not a second table. The counts are in the rows above;
            repeating them here would be the clutter this card is losing.
          */}
          <ul className="grid min-w-0 flex-1 grid-cols-2 gap-x-4 gap-y-1.5">
            {LEAD_STAGES.map((stage) => (
              <li key={stage.value} className="flex min-w-0 items-center gap-2">
                <span
                  className={`size-2 shrink-0 rounded-full ${STAGE_BAR[stage.value] ?? 'bg-slate-400'}`}
                  aria-hidden="true"
                />
                <span className="truncate text-xs text-slate-600">{stage.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Panel>
  )
}

export default CrmOverviewCard
