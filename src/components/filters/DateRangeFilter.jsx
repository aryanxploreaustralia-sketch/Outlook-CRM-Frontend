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

import { useEffect, useRef, useState } from 'react'
import { CalendarDays, ChevronDown } from 'lucide-react'

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
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef(null)

  // Closes on an outside click or Escape, the way every other menu here does.
  useEffect(() => {
    if (!isOpen) return undefined

    const onPointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) setIsOpen(false)
    }
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setIsOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [isOpen])

  const isCustom = value.preset === 'custom'
  const active = Boolean(value.preset)

  const summary = !active
    ? allLabel
    : isCustom
      ? value.from && value.to
        ? `${value.from.split('-').reverse().join('/')} – ${value.to.split('-').reverse().join('/')}`
        : 'Custom range'
      : (presets.find((preset) => preset.value === value.preset)?.label ?? allLabel)

  const choose = (preset) => {
    if (preset === '') {
      onChange({ preset: '', from: '', to: '' })
      setIsOpen(false)
      return
    }

    if (preset === 'custom') {
      // Opens the inputs without emitting a window: nothing is filtered until
      // a bound is typed, and emitting here would clear the current one.
      onChange({ preset: 'custom', from: value.from ?? '', to: value.to ?? '' })
      return
    }

    onChange({ preset, ...windowFor(preset) })
    setIsOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-label={`${label}: ${summary}`}
        className={`flex items-center gap-1.5 rounded-(--radius-control) border px-2.5 py-1.5 text-xs font-medium transition-colors ${
          active
            ? 'border-brand-300 bg-brand-50 text-brand-800'
            : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
        } focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40`}
      >
        <CalendarDays className="size-3.5 shrink-0 opacity-70" aria-hidden="true" />
        <span className="whitespace-nowrap">
          {label}: {summary}
        </span>
        <ChevronDown className="size-3 shrink-0 opacity-60" aria-hidden="true" />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-30 mt-1.5 w-60 rounded-(--radius-card) border border-slate-200 bg-white p-1.5 shadow-dropdown">
          <ul>
            {[{ value: '', label: allLabel }, ...presets, { value: 'custom', label: 'Custom range' }].map(
              (preset) => (
                <li key={preset.value || 'any'}>
                  <button
                    type="button"
                    onClick={() => choose(preset.value)}
                    aria-current={(value.preset ?? '') === preset.value}
                    className={`w-full rounded-md px-2.5 py-1.5 text-left text-xs transition-colors ${
                      (value.preset ?? '') === preset.value
                        ? 'bg-brand-50 font-medium text-brand-800'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {preset.label}
                  </button>
                </li>
              ),
            )}
          </ul>

          {isCustom && (
            <div className="mt-1.5 space-y-2 border-t border-slate-100 px-1.5 pb-1 pt-2">
              {[
                { key: 'from', label: 'From' },
                { key: 'to', label: 'To' },
              ].map((field) => (
                <label key={field.key} className="block">
                  <span className="block text-[11px] font-medium text-slate-600">{field.label}</span>
                  <input
                    type="date"
                    value={value[field.key] ?? ''}
                    onChange={(event) =>
                      onChange({ ...value, preset: 'custom', [field.key]: event.target.value })
                    }
                    className="mt-0.5 w-full rounded-(--radius-control) border border-slate-300 px-2 py-1 text-xs text-slate-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
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
      )}
    </div>
  )
}

export default DateRangeFilter
