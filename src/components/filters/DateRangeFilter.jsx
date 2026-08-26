/**
 * A date window, chosen from presets or typed as a custom pair.
 *
 * ## One component, two filters
 *
 * The Leads register filters on two dates that face opposite directions:
 * travel is ahead of you (today, tomorrow, the next sixty days) and a quote is
 * behind you (today, yesterday, the last thirty). The shape of the control is
 * identical, so the presets are passed in and the component holds none of its
 * own — building two of these would mean two places for the same off-by-one
 * bug to appear.
 *
 * ## Why a select rather than a popover
 *
 * This lives in the filter rail, whose group list scrolls (`overflow-y-auto`).
 * An absolutely positioned panel inside a scrolling ancestor is clipped by it,
 * so a popover would have been cut off the moment the rail had more groups
 * than fit. A native select has no such problem, needs no outside-click
 * handling, and is the same control every other filter in the rail already
 * uses. The custom inputs simply appear beneath it when they are relevant.
 *
 * ## Calendar dates, never instants
 *
 * Every value this emits is a plain `YYYY-MM-DD`. The register stores travel
 * and quote dates at exactly midnight UTC — they are days, not moments — and
 * the server turns each string into a UTC bound. Sending a full timestamp
 * would carry this browser's offset into a comparison that has no business
 * knowing about it, and for a reader east of Greenwich "today" would quietly
 * start yesterday.
 *
 * The presets are computed from the reader's **local** calendar, which is what
 * "today" means to the person reading it, and `toDateInput` formats them from
 * local calendar fields for the same reason.
 */

import { useId } from 'react'

import { toDateInput } from '@/utils/datetime'

/** Midnight today, in the reader's own calendar. */
const today = () => {
  const value = new Date()
  value.setHours(0, 0, 0, 0)
  return value
}

/** `n` days from today, in the reader's own calendar. */
const shift = (days) => {
  const value = today()
  value.setDate(value.getDate() + days)
  return value
}

/**
 * The windows a preset can describe, as `{ from, to }` calendar dates.
 *
 * Exported so the pages that use this control can name presets without
 * repeating the arithmetic, and so the ranges can be driven directly in a test.
 */
export const DATE_WINDOWS = Object.freeze({
  // --- Forward-looking, for travel ----------------------------------------
  today: () => ({ from: today(), to: today() }),
  tomorrow: () => ({ from: shift(1), to: shift(1) }),
  next7: () => ({ from: today(), to: shift(7) }),
  next14: () => ({ from: today(), to: shift(14) }),
  next30: () => ({ from: today(), to: shift(30) }),
  next60: () => ({ from: today(), to: shift(60) }),

  // --- Backward-looking, for quotes ---------------------------------------
  yesterday: () => ({ from: shift(-1), to: shift(-1) }),
  last7: () => ({ from: shift(-7), to: today() }),
  last30: () => ({ from: shift(-30), to: today() }),
  thisMonth: () => {
    const now = today()
    return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now }
  },
  lastMonth: () => {
    const now = today()
    return {
      from: new Date(now.getFullYear(), now.getMonth() - 1, 1),
      // Day 0 of this month is the last day of the previous one.
      to: new Date(now.getFullYear(), now.getMonth(), 0),
    }
  },
})

/** Resolves a preset key to the `YYYY-MM-DD` pair the API expects. */
export function windowFor(preset) {
  const build = DATE_WINDOWS[preset]
  if (!build) return { from: '', to: '' }

  const { from, to } = build()
  return { from: toDateInput(from), to: toDateInput(to) }
}

/** The rail's control metrics, so every filter in it renders one box. */
const FIELD =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 ' +
  'transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20'

/**
 * @param {{
 *   label: string,
 *   presets: Array<{ value: string, label: string }>,
 *   value: { preset?: string, from?: string, to?: string },
 *   onChange: (next: { preset: string, from: string, to: string }) => void,
 *   allLabel?: string,
 * }} props
 */
export function DateRangeFilter({ label, presets, value, onChange, allLabel = 'Any date' }) {
  const selectId = useId()
  const isCustom = value.preset === 'custom'

  const choose = (preset) => {
    if (preset === '') {
      onChange({ preset: '', from: '', to: '' })
      return
    }

    if (preset === 'custom') {
      // Reveals the inputs without emitting a window: nothing is filtered
      // until a bound is typed, and emitting here would clear the current one.
      onChange({ preset: 'custom', from: value.from ?? '', to: value.to ?? '' })
      return
    }

    onChange({ preset, ...windowFor(preset) })
  }

  return (
    <div>
      <label htmlFor={selectId} className="block text-xs font-medium text-slate-600">
        {label}
      </label>

      <select
        id={selectId}
        value={value.preset ?? ''}
        onChange={(event) => choose(event.target.value)}
        className={`mt-1 ${FIELD}`}
      >
        <option value="">{allLabel}</option>
        {presets.map((preset) => (
          <option key={preset.value} value={preset.value}>
            {preset.label}
          </option>
        ))}
        <option value="custom">Custom range</option>
      </select>

      {isCustom && (
        <div className="mt-2 space-y-2">
          {[
            { key: 'from', label: 'From' },
            { key: 'to', label: 'To' },
          ].map((field) => (
            <label key={field.key} className="block">
              <span className="block text-[11px] font-medium text-slate-500">{field.label}</span>
              <input
                type="date"
                value={value[field.key] ?? ''}
                onChange={(event) =>
                  onChange({ ...value, preset: 'custom', [field.key]: event.target.value })
                }
                className={`mt-0.5 ${FIELD}`}
              />
            </label>
          ))}

          {value.from && value.to && value.from > value.to && (
            <p role="alert" className="text-[11px] text-red-600">
              The start date must not be after the end date.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export default DateRangeFilter
