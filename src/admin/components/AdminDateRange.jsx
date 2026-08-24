/**
 * The global reporting period.
 *
 * One control, above everything it scopes. Per-widget date pickers let two
 * charts on one screen describe two different periods with nothing in the
 * interface saying so — and the reader compares them anyway.
 *
 * ## The presets are resolved on the server
 *
 * The client sends `preset=last7`, not a pair of dates it computed. That keeps
 * every widget agreeing on what "last 7 days" means, and stops the boundary
 * shifting because one reader's browser is in a different timezone from the
 * data. The resolved window comes back in each response and is displayed here,
 * so the reader can see exactly what they are looking at.
 */

import { useState } from 'react'
import { CalendarRange, Check } from 'lucide-react'
import { formatDate } from '@/utils/datetime'

const PRESETS = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last7', label: 'Last 7 days' },
  { value: 'last30', label: 'Last 30 days' },
  { value: 'last90', label: 'Last 90 days' },
  { value: 'thisMonth', label: 'This month' },
  { value: 'lastMonth', label: 'Last month' },
  { value: 'thisYear', label: 'This year' },
  { value: 'all', label: 'All time' },
]

const formatBound = (value) =>
  // The house format, so the chip and the rows it filters read alike.
  value ? formatDate(value, { empty: null }) : null

/**
 * @param {{
 *   value: { preset?: string, from?: string, to?: string },
 *   onChange: (next: { preset?: string, from?: string, to?: string }) => void,
 *   resolved?: { preset?: string, from?: ?string, to?: ?string },
 *   trailing?: import('react').ReactNode,
 * }} props
 */
export function AdminDateRange({ value, onChange, resolved, trailing }) {
  const [showCustom, setShowCustom] = useState(Boolean(value.from || value.to))

  const activePreset = value.from || value.to ? 'custom' : (value.preset ?? 'last30')

  const choose = (preset) => {
    setShowCustom(false)
    // Explicit bounds are cleared, or they would override the preset the reader
    // just chose — the server prefers a pair over a name.
    onChange({ preset, from: '', to: '' })
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-card">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
          <CalendarRange className="size-3.5" aria-hidden="true" />
          Period
        </span>

        <div role="group" aria-label="Reporting period" className="flex flex-wrap gap-1">
          {PRESETS.map((preset) => {
            const isActive = activePreset === preset.value

            return (
              <button
                key={preset.value}
                type="button"
                onClick={() => choose(preset.value)}
                aria-pressed={isActive}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-brand-600 text-white shadow-card'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {preset.label}
              </button>
            )
          })}

          <button
            type="button"
            onClick={() => setShowCustom((previous) => !previous)}
            aria-pressed={activePreset === 'custom'}
            aria-expanded={showCustom}
            className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
              activePreset === 'custom'
                ? 'bg-brand-600 text-white shadow-card'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            Custom
          </button>
        </div>

        {trailing && <div className="ml-auto flex items-center gap-2">{trailing}</div>}
      </div>

      {showCustom && (
        <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-slate-100 pt-3">
          {[
            { key: 'from', label: 'From' },
            { key: 'to', label: 'To' },
          ].map((field) => (
            <label key={field.key} className="block">
              <span className="block text-xs font-medium text-slate-600">{field.label}</span>
              <input
                type="date"
                value={value[field.key] ?? ''}
                onChange={(event) =>
                  onChange({ ...value, preset: '', [field.key]: event.target.value })
                }
                className="mt-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
            </label>
          ))}

          {value.from && value.to && new Date(value.from) > new Date(value.to) && (
            <p role="alert" className="pb-2 text-xs text-red-600">
              The start date must not be after the end date.
            </p>
          )}
        </div>
      )}

      {/* What the server actually resolved. Shown because a preset is a name and
          the reader is entitled to know which days it covered. */}
      {resolved && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-400">
          <Check className="size-3" aria-hidden="true" />
          {resolved.from
            ? `${formatBound(resolved.from)} – ${formatBound(resolved.to)}`
            : 'All recorded data'}
        </p>
      )}
    </div>
  )
}

export default AdminDateRange
