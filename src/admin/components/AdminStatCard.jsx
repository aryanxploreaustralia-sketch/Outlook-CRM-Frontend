/**
 * A single headline figure.
 *
 * The most-repeated element in the whole admin surface, so it is worth being
 * strict about: one number, one label, one optional trend, one optional icon.
 *
 * ## Two rules enforced here rather than at call sites
 *
 *  1. **Trend direction is never conveyed by colour alone.** Every trend carries
 *     an arrow glyph and a sign, so it survives greyscale and colour blindness.
 *  2. **A trend states its comparison period.** "+12%" is not information until
 *     the reader knows against what; `trendLabel` is required whenever `trend`
 *     is supplied, and the component renders nothing if it is missing.
 *  3. **The value uses proportional figures, not `tabular-nums`.** Equal-width
 *     digits exist so columns of numbers align vertically; on a standalone
 *     display-size figure they make a value like `121` read loose and gappy.
 *     `tabular-nums` belongs in the tables and on the axis ticks, and that is
 *     where this module uses it.
 */

import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react'

import { useCountUp } from '@/hooks/useCountUp'
import { ADMIN_TONE } from '@/admin/constants/admin.constants'

/** Icon chip treatment per tone. Kept muted — a wall of saturated tiles reads as an alarm. */
const TONES = {
  [ADMIN_TONE.NEUTRAL]: 'bg-slate-100 text-slate-600',
  [ADMIN_TONE.BRAND]: 'bg-brand-50 text-brand-600',
  [ADMIN_TONE.SUCCESS]: 'bg-emerald-50 text-emerald-600',
  [ADMIN_TONE.WARNING]: 'bg-amber-50 text-amber-600',
  [ADMIN_TONE.DANGER]: 'bg-red-50 text-red-600',
}

/**
 * `direction` is derived from the sign of `trend` unless given explicitly,
 * because a caller holding "+3.2" should not also have to say "up".
 */
function resolveTrend(trend, direction) {
  if (trend === null || trend === undefined) return null

  const resolved = direction ?? (trend > 0 ? 'up' : trend < 0 ? 'down' : 'flat')

  const presets = {
    up: { Icon: ArrowUpRight, className: 'text-emerald-600', sign: '+' },
    down: { Icon: ArrowDownRight, className: 'text-red-600', sign: '' },
    flat: { Icon: ArrowRight, className: 'text-slate-500', sign: '' },
  }

  return presets[resolved] ?? presets.flat
}

/**
 * @param {{
 *   label: string,
 *   value?: import('react').ReactNode,
 *   unit?: string,
 *   hint?: string,
 *   icon?: import('react').ElementType,
 *   tone?: keyof typeof TONES,
 *   trend?: ?number,
 *   trendLabel?: string,
 *   trendDirection?: 'up' | 'down' | 'flat',
 *   isLoading?: boolean,
 *   className?: string,
 * }} props
 */
export function AdminStatCard({
  label,
  value,
  unit,
  hint,
  icon: Icon,
  tone = ADMIN_TONE.NEUTRAL,
  trend,
  trendLabel,
  trendDirection,
  isLoading = false,
  className = '',
}) {
  const resolved = resolveTrend(trend, trendDirection)

  /**
   * Counted up only when the value is a bare number (Phase 16.1).
   *
   * Most callers pass a preformatted string — `formatCount(1284)` is
   * `"1,284"` — and those are shown as they are. Passing the raw number opts
   * into the animation, which is why the dashboard's headline figures move and
   * a composite like `"3 / 5"` does not.
   */
  const isAnimatable = typeof value === 'number' && Number.isFinite(value)
  const counted = useCountUp(isAnimatable ? value : null, { enabled: !isLoading })
  const shown = isAnimatable ? counted?.toLocaleString() : value

  return (
    <div
      className={`surface-card surface-interactive p-5 ${className}`}
      role={isLoading ? 'status' : undefined}
      aria-label={isLoading ? `Loading ${label}` : undefined}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 text-xs font-medium uppercase tracking-[0.04em] text-slate-500">
          {label}
        </p>
        {Icon && (
          <span
            className={`grid size-8 shrink-0 place-items-center rounded-lg ${TONES[tone] ?? TONES.neutral}`}
            aria-hidden="true"
          >
            <Icon className="size-4" />
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="skeleton mt-3 h-8 w-24" />
      ) : (
        <p className="metric-figure mt-2.5 flex items-baseline gap-1 text-[1.75rem] font-semibold leading-none text-slate-900">
          {/*
            An `aria-live` region would announce every frame of the count-up.
            The figure is read on demand instead, which is what a screen-reader
            user actually wants from a dashboard tile.
          */}
          {shown ?? '—'}
          {unit && <span className="text-sm font-medium text-slate-400">{unit}</span>}
        </p>
      )}

      {isLoading ? (
        <div className="skeleton mt-2.5 h-3 w-32" />
      ) : (
        <div className="mt-2 flex min-h-4 items-center gap-1.5 text-xs">
          {resolved && trendLabel && (
            <span className={`inline-flex items-center gap-0.5 font-medium ${resolved.className}`}>
              <resolved.Icon className="size-3.5" aria-hidden="true" />
              {resolved.sign}
              {trend}%
            </span>
          )}
          {(trendLabel || hint) && (
            <span className="truncate text-slate-500">{trendLabel ?? hint}</span>
          )}
        </div>
      )}
    </div>
  )
}

export default AdminStatCard
