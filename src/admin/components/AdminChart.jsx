/**
 * Charts.
 *
 * Hand-drawn SVG rather than a charting library. Three reasons, in order of
 * weight: the phase brief forbids new behaviour and a chart dependency is
 * ~120 KB of it; the visual specification below is fixed and narrow, so a
 * library's configuration surface would be mostly switched off; and a
 * dependency-free chart cannot be broken by a major version of something else.
 *
 * ## The specification these follow
 *
 *  - **Columns** cap at 24px and never fill their band — the leftover is air.
 *    The data-end is rounded 4px and the baseline end stays square, so a column
 *    reads as growing *from* the axis rather than floating on it.
 *  - **Lines** are 2px with round joins and caps; the area beneath is the same
 *    hue at 10% — a wash, not a block.
 *  - **Markers** are ≥8px across and carry a 2px ring in the surface colour, so
 *    they stay legible where they cross the line.
 *  - **Gridlines** are solid 1px, one step off the surface. Never dashed: a
 *    dashed rule reads as a threshold or a projection, and this is neither.
 *  - **Labels are selective.** The endpoint and the extreme get a value; the
 *    rest is carried by the axis and the tooltip. A number on every point is
 *    chaos and goes unread.
 *  - **Text never wears the series colour.** Identity comes from the coloured
 *    mark; labels stay in slate ink, where they are actually legible.
 *  - **Adjacent marks are separated by a 2px surface gap**, never by a stroke
 *    drawn around them.
 *
 * ## Colour
 *
 * Lives in `@/admin/constants/adminChart.constants`, with the validator results
 * that justify each value. Kept out of this file so it exports components only,
 * which is what Fast Refresh needs to hot-swap a chart instead of remounting the
 * page around it.
 *
 * ## Interaction
 *
 * Every plot ships a hover layer, because an SVG chart in a browser *is*
 * interactive and a static one reads as an image of a chart. The tooltip
 * enhances and never gates: every value is also reachable from the axis, the
 * selective labels, and the table view its page renders beside it.
 */

import { useMemo, useState } from 'react'

import {
  ADMIN_CHART_AXIS_TEXT as AXIS_TEXT,
  ADMIN_CHART_COLORS,
  ADMIN_CHART_GRID as GRID,
  ADMIN_CHART_LABEL_TEXT as LABEL_TEXT,
  ADMIN_CHART_SURFACE as SURFACE,
} from '@/admin/constants/adminChart.constants'
import { useElementWidth } from '@/admin/hooks/useElementWidth'

/**
 * Guards the plotters against an empty series.
 *
 * `Math.max(...[])` is `-Infinity` and `points.at(-1)` is `undefined`, so an
 * empty array does not render an empty chart — it throws. Fixtures are never
 * empty, which is exactly why this is worth handling now: Phase 14.2 feeds these
 * real responses, and a range with no data is an ordinary answer.
 */
function EmptySeries({ height, label }) {
  return (
    <div
      className="flex items-center justify-center rounded-lg bg-slate-50 text-xs text-slate-400"
      style={{ height }}
      role="img"
      aria-label={`${label} — no data in this period`}
    >
      No data for this period
    </div>
  )
}

/** Rounds an axis ceiling up to a clean number, so ticks are readable. */
function niceCeiling(max) {
  if (max <= 0) return 1
  const magnitude = 10 ** Math.floor(Math.log10(max))
  const normalised = max / magnitude

  const step = normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 5 ? 5 : 10

  return step * magnitude
}

const formatTick = (value) => value.toLocaleString()

/**
 * A rounded-top column path: 4px radius at the data end, square at the baseline.
 *
 * Built as a path rather than a `<rect rx>` because `rx` rounds all four
 * corners, which detaches the column from the axis it grows out of.
 */
function columnPath(x, y, width, height, radius = 4) {
  const r = Math.min(radius, width / 2, Math.max(height, 0))

  if (height <= 0) return ''

  return [
    `M ${x} ${y + height}`,
    `L ${x} ${y + r}`,
    `Q ${x} ${y} ${x + r} ${y}`,
    `L ${x + width - r} ${y}`,
    `Q ${x + width} ${y} ${x + width} ${y + r}`,
    `L ${x + width} ${y + height}`,
    'Z',
  ].join(' ')
}

/**
 * Column chart for a single measure over ordered buckets.
 *
 * One series, one colour. A value-ramp across the bars would double-encode
 * height as hue and burn the only free channel on information the bars already
 * carry.
 *
 * @param {{
 *   data: Array<{ label: string, value: number }>,
 *   color?: string,
 *   height?: number,
 *   valueSuffix?: string,
 *   ariaLabel: string,
 * }} props
 */
export function AdminBarChart({
  data,
  color = ADMIN_CHART_COLORS[0],
  height = 220,
  valueSuffix = '',
  ariaLabel,
}) {
  const [containerRef, width] = useElementWidth()
  const [hovered, setHovered] = useState(null)

  // The axis band is inside `height`, not added to it. A container sized to the
  // plot alone leaves the x labels to overflow and gives the card a tiny nested
  // scrollbar.
  const padding = { top: 16, right: 12, bottom: 28, left: 44 }

  if (!data?.length) return <EmptySeries height={height} label={ariaLabel} />
  const plotWidth = Math.max(width - padding.left - padding.right, 10)
  const plotHeight = Math.max(height - padding.top - padding.bottom, 10)

  const ceiling = niceCeiling(Math.max(...data.map((point) => point.value), 1))
  const ticks = [0, ceiling / 2, ceiling]

  const band = plotWidth / data.length
  // 2px of the band is surrendered to the surface gap between neighbours; the
  // rest is capped so a six-bucket chart does not produce slabs.
  const barWidth = Math.min(24, Math.max(band - 10, 4))

  return (
    <div ref={containerRef} className="relative w-full">
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={ariaLabel}
        className="overflow-visible"
      >
        {ticks.map((tick) => {
          const y = padding.top + plotHeight - (tick / ceiling) * plotHeight

          return (
            <g key={tick}>
              <line
                x1={padding.left}
                x2={padding.left + plotWidth}
                y1={y}
                y2={y}
                stroke={GRID}
                strokeWidth="1"
              />
              <text
                x={padding.left - 8}
                y={y + 3}
                textAnchor="end"
                fontSize="10"
                fill={AXIS_TEXT}
                // Ticks are a vertical column of numbers, which is exactly where
                // equal-width digits belong.
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {formatTick(tick)}
              </text>
            </g>
          )
        })}

        {data.map((point, index) => {
          const barHeight = (point.value / ceiling) * plotHeight
          const x = padding.left + index * band + (band - barWidth) / 2
          const y = padding.top + plotHeight - barHeight
          const isHovered = hovered === index

          return (
            <g key={point.label}>
              <path
                d={columnPath(x, y, barWidth, barHeight)}
                fill={color}
                opacity={hovered === null || isHovered ? 1 : 0.45}
              />

              {/* The hit target spans the whole band and the full plot height.
                  Requiring the pointer to land on a 14px column is the "pinpoint
                  hover target" failure; this is always at least 24px wide. */}
              <rect
                x={padding.left + index * band}
                y={padding.top}
                width={band}
                height={plotHeight}
                fill="transparent"
                onMouseEnter={() => setHovered(index)}
                onMouseLeave={() => setHovered(null)}
              />

              {index % Math.ceil(data.length / 6) === 0 && (
                <text
                  x={x + barWidth / 2}
                  y={height - 8}
                  textAnchor="middle"
                  fontSize="10"
                  fill={AXIS_TEXT}
                >
                  {point.label}
                </text>
              )}
            </g>
          )
        })}
      </svg>

      {hovered !== null && (
        <ChartTooltip
          label={data[hovered].label}
          value={`${data[hovered].value.toLocaleString()}${valueSuffix}`}
          color={color}
          left={padding.left + hovered * band + band / 2}
          containerWidth={width}
        />
      )}
    </div>
  )
}

/**
 * Line + area for a single measure over time.
 *
 * A single series carries no legend: there is one colour, and the card's title
 * already says what is plotted. A legend box with one swatch restates the title
 * and costs space.
 *
 * @param {{
 *   data: Array<{ label: string, value: number }>,
 *   color?: string,
 *   height?: number,
 *   valueSuffix?: string,
 *   ariaLabel: string,
 * }} props
 */
export function AdminAreaChart({
  data,
  color = ADMIN_CHART_COLORS[0],
  height = 220,
  valueSuffix = '',
  ariaLabel,
}) {
  const [containerRef, width] = useElementWidth()
  const [hovered, setHovered] = useState(null)

  const padding = { top: 18, right: 44, bottom: 28, left: 44 }
  const plotWidth = Math.max(width - padding.left - padding.right, 10)
  const plotHeight = Math.max(height - padding.top - padding.bottom, 10)

  const ceiling = niceCeiling(Math.max(...data.map((point) => point.value), 1))
  const ticks = [0, ceiling / 2, ceiling]

  const points = useMemo(
    () =>
      data.map((point, index) => ({
        ...point,
        x: padding.left + (index / Math.max(data.length - 1, 1)) * plotWidth,
        y: padding.top + plotHeight - (point.value / ceiling) * plotHeight,
      })),
    [data, plotWidth, plotHeight, ceiling, padding.left, padding.top],
  )

  // After every hook, never before — an early return above `useMemo` would
  // change the hook count between renders the moment a series became empty.
  if (!data?.length) return <EmptySeries height={height} label={ariaLabel} />

  const linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
  const areaPath = `${linePath} L ${points.at(-1).x} ${padding.top + plotHeight} L ${points[0].x} ${
    padding.top + plotHeight
  } Z`

  const last = points.at(-1)
  // The extreme and the endpoint are the two points worth labelling. Everything
  // else is the axis's job and the tooltip's.
  const peakIndex = points.reduce((best, point, index) => (point.value > points[best].value ? index : best), 0)

  return (
    <div ref={containerRef} className="relative w-full">
      <svg width={width} height={height} role="img" aria-label={ariaLabel} className="overflow-visible">
        {ticks.map((tick) => {
          const y = padding.top + plotHeight - (tick / ceiling) * plotHeight

          return (
            <g key={tick}>
              <line
                x1={padding.left}
                x2={padding.left + plotWidth}
                y1={y}
                y2={y}
                stroke={GRID}
                strokeWidth="1"
              />
              <text
                x={padding.left - 8}
                y={y + 3}
                textAnchor="end"
                fontSize="10"
                fill={AXIS_TEXT}
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {formatTick(tick)}
              </text>
            </g>
          )
        })}

        {/* A wash at 10%, never a saturated block. */}
        <path d={areaPath} fill={color} opacity="0.1" />
        <path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {hovered !== null && (
          <line
            x1={points[hovered].x}
            x2={points[hovered].x}
            y1={padding.top}
            y2={padding.top + plotHeight}
            stroke={GRID}
            strokeWidth="1"
          />
        )}

        {/* End marker: 9px across, with a 2px surface ring so it stays readable
            where it sits on top of the line. */}
        <circle cx={last.x} cy={last.y} r="4.5" fill={color} stroke={SURFACE} strokeWidth="2" />
        {hovered !== null && hovered !== points.length - 1 && (
          <circle
            cx={points[hovered].x}
            cy={points[hovered].y}
            r="4.5"
            fill={color}
            stroke={SURFACE}
            strokeWidth="2"
          />
        )}

        <text x={last.x + 8} y={last.y + 3} fontSize="11" fontWeight="600" fill={LABEL_TEXT}>
          {last.value.toLocaleString()}
          {valueSuffix}
        </text>

        {peakIndex !== points.length - 1 && (
          <text
            x={points[peakIndex].x}
            y={points[peakIndex].y - 10}
            textAnchor="middle"
            fontSize="10"
            fill={AXIS_TEXT}
          >
            {points[peakIndex].value.toLocaleString()}
          </text>
        )}

        {points.map((point, index) => (
          <g key={point.label}>
            {/* A full-height slice per point, so the hit area is never the 9px
                marker. */}
            <rect
              x={point.x - plotWidth / Math.max(data.length - 1, 1) / 2}
              y={padding.top}
              width={plotWidth / Math.max(data.length - 1, 1)}
              height={plotHeight}
              fill="transparent"
              onMouseEnter={() => setHovered(index)}
              onMouseLeave={() => setHovered(null)}
            />
            {index % Math.ceil(data.length / 6) === 0 && (
              <text x={point.x} y={height - 8} textAnchor="middle" fontSize="10" fill={AXIS_TEXT}>
                {point.label}
              </text>
            )}
          </g>
        ))}
      </svg>

      {hovered !== null && (
        <ChartTooltip
          label={data[hovered].label}
          value={`${data[hovered].value.toLocaleString()}${valueSuffix}`}
          color={color}
          left={points[hovered].x}
          containerWidth={width}
        />
      )}
    </div>
  )
}

/**
 * Horizontal bars for ordered categories — a pipeline, a funnel, a ranking.
 *
 * Horizontal because the category labels are words. Rotating a word 90° to fit
 * under a column is a legibility cost paid on every read.
 *
 * @param {{
 *   data: Array<{ label: string, value: number }>,
 *   color?: string,
 *   ariaLabel: string,
 * }} props
 */
export function AdminRankChart({ data, color = ADMIN_CHART_COLORS[0], ariaLabel }) {
  const max = Math.max(...data.map((point) => point.value), 1)

  return (
    <ul className="space-y-3" aria-label={ariaLabel}>
      {data.map((point) => (
        <li key={point.label}>
          <div className="flex items-baseline justify-between gap-3 text-xs">
            <span className="min-w-0 truncate font-medium text-slate-700">{point.label}</span>
            <span
              className="shrink-0 text-slate-500"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {point.value.toLocaleString()}
            </span>
          </div>
          {/* The track is a lighter step of the surface, not of the series hue,
              so an empty bar never reads as a filled one at a glance. */}
          <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.max((point.value / max) * 100, 1.5)}%`, backgroundColor: color }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}

/**
 * The shared hover readout.
 *
 * Clamped inside the container so a tooltip on the last point does not escape
 * the card and get clipped by its overflow.
 */
function ChartTooltip({ label, value, color, left, containerWidth }) {
  const clamped = Math.min(Math.max(left, 60), Math.max(containerWidth - 60, 60))

  return (
    <div
      className="pointer-events-none absolute -top-1 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 shadow-dropdown"
      style={{ left: clamped }}
      role="status"
    >
      <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
        {/* Identity comes from the coloured mark beside the text, never from
            colouring the text itself. */}
        <span
          className="size-2 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
          aria-hidden="true"
        />
        {label}
      </p>
      <p className="text-xs font-semibold text-slate-900">{value}</p>
    </div>
  )
}

export default AdminBarChart
