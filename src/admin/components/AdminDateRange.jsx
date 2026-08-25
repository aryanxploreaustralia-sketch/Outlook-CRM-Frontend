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

import { useId, useState } from 'react'
import { Check } from 'lucide-react'
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

/** The date inputs, shared by both layouts so the rule lives in one place. */
function CustomBounds({ value, onChange, className = '' }) {
  return (
    <div className={`flex flex-wrap items-end gap-3 ${className}`}>
      {[
        { key: 'from', label: 'From' },
        { key: 'to', label: 'To' },
      ].map((field) => (
        <label key={field.key} className="block">
          <span className="block text-xs font-medium text-slate-600">{field.label}</span>
          <input
            type="date"
            value={value[field.key] ?? ''}
            onChange={(event) => onChange({ ...value, preset: '', [field.key]: event.target.value })}
            className="mt-1 rounded-(--radius-control) border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
        </label>
      ))}

      {value.from && value.to && new Date(value.from) > new Date(value.to) && (
        <p role="alert" className="pb-2 text-xs text-red-600">
          The start date must not be after the end date.
        </p>
      )}
    </div>
  )
}

/**
 * @param {{
 *   value: { preset?: string, from?: string, to?: string },
 *   onChange: (next: { preset?: string, from?: string, to?: string }) => void,
 *   resolved?: { preset?: string, from?: ?string, to?: ?string },
 *   trailing?: import('react').ReactNode,
 *   label?: ?string,
 * }} props
 *   One layout, everywhere. This replaced a full-width row of ten buttons that
 *   claimed a band of every reporting screen for a choice made once a session.
 *
 *   `label` is for a control standing on its own in the page body, where it
 *   needs to say what it selects. A caller placing it in a section's action
 *   slot passes none — the heading beside it is already the label, and a second
 *   one would only repeat it.
 */
export function AdminDateRange({ value, onChange, resolved, trailing, label = null }) {
  const [showCustom, setShowCustom] = useState(Boolean(value.from || value.to))

  /*
   * Generated, not hardcoded.
   *
   * Two of these can share a screen — a page-level period and one inside a
   * user's performance section — and a fixed id would give both the same one,
   * which points every label at whichever select the browser found first.
   */
  const selectId = useId()

  const activePreset = value.from || value.to ? 'custom' : (value.preset ?? 'last30')

  const choose = (preset) => {
    setShowCustom(false)
    // Explicit bounds are cleared, or they would override the preset the reader
    // just chose — the server prefers a pair over a name.
    onChange({ preset, from: '', to: '' })
  }

  return (
    <div className={`flex flex-col gap-2 ${label ? 'items-start' : 'items-end'}`}>
      <div className="flex flex-wrap items-center gap-2">
        <label
          htmlFor={selectId}
          className={label ? 'text-sm font-medium text-slate-700' : 'sr-only'}
        >
          {label ?? 'Reporting period'}
        </label>
        <select
          id={selectId}
          value={activePreset}
          onChange={(event) => {
            const next = event.target.value
            /*
             * "Custom" only reveals the inputs. It deliberately does not emit
             * a change: the range is not custom until a bound is typed, and
             * emitting here would clear the current period and reload the page
             * against nothing.
             */
            if (next === 'custom') setShowCustom(true)
            else choose(next)
          }}
          className="rounded-(--radius-control) border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-700 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
        >
          {PRESETS.map((preset) => (
            <option key={preset.value} value={preset.value}>
              {preset.label}
            </option>
          ))}
          <option value="custom">Custom</option>
        </select>

        {trailing}
      </div>

      {showCustom && <CustomBounds value={value} onChange={onChange} />}

      {resolved && (
        <p className="flex items-center gap-1.5 text-xs text-slate-400">
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
