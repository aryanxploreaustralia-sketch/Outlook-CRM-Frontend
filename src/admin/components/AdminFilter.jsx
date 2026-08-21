/**
 * Filter controls.
 *
 * Two exports, because a filter bar has two jobs and merging them produced a
 * component with a `mode` prop that did neither well:
 *
 *  - `AdminFilterSelect` is one labelled dropdown;
 *  - `AdminFilterBar` is the row that holds the search box, the dropdowns, the
 *    active-filter count and the reset control.
 *
 * The bar renders the reset button **only when something is actually filtered**.
 * A permanently visible "Clear filters" on an unfiltered table is a control that
 * does nothing, and users learn to ignore the region it sits in.
 */

import { useId } from 'react'
import { X } from 'lucide-react'

/**
 * A single dropdown.
 *
 * The empty-string value is reserved for "no filter", so a page can reset by
 * assigning `''` without a sentinel of its own.
 *
 * @param {{
 *   label: string,
 *   value: string,
 *   onChange: (next: string) => void,
 *   options: Array<{ value: string, label: string }>,
 *   allLabel?: string,
 *   includeAll?: boolean,
 *   disabled?: boolean,
 *   className?: string,
 * }} props
 */
export function AdminFilterSelect({
  label,
  value,
  onChange,
  options,
  allLabel,
  /*
   * Whether the empty "no filter" row is offered.
   *
   * Defaults to true, which is every filter on the console: absent means "all".
   * A select whose value is always one of `options` — a *mode* rather than a
   * filter — passes false, because an empty row there is either dead (the value
   * can never be '') or a duplicate of whichever option shares its label.
   */
  includeAll = true,
  disabled = false,
  className = '',
}) {
  const selectId = useId()

  return (
    <div className={className}>
      <label htmlFor={selectId} className="sr-only">
        {label}
      </label>
      <select
        id={selectId}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
      >
        {includeAll && <option value="">{allLabel ?? `All ${label.toLowerCase()}`}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}

/**
 * The filter row.
 *
 * @param {{
 *   children?: import('react').ReactNode,
 *   search?: import('react').ReactNode,
 *   activeCount?: number,
 *   onReset?: () => void,
 *   trailing?: import('react').ReactNode,
 *   className?: string,
 * }} props
 */
export function AdminFilterBar({
  children,
  search,
  activeCount = 0,
  onReset,
  trailing,
  className = '',
}) {
  return (
    /*
     * Phase 16.1B: a grid, not a wrapping flex row.
     *
     * `flex-wrap` let each control take its natural width, so the row broke
     * wherever it happened to run out of space — a five-filter page wrapped
     * after the third control on one viewport and after the fourth on another,
     * and neither looked deliberate. That is the "filters feel random" problem.
     *
     * A twelve-column grid gives every dropdown an identical track, so they
     * align down the page and wrap in whole columns. Search spans four of the
     * twelve on desktop, which makes it visually dominant without a font or
     * colour trick.
     *
     * The audit page's eight filters land as 4 + 4 across two rows, which is
     * the layout the brief describes — reached by the grid rather than by that
     * page hand-placing anything.
     */
    <div className={`border-b border-slate-100 px-6 py-4 ${className}`}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12">
        {search && (
          <div className="min-w-0 sm:col-span-2 lg:col-span-4">{search}</div>
        )}

        {/*
          `[&>*]:min-w-0` lets a long option label truncate inside its track
          rather than forcing the track wider and knocking the grid out of
          alignment — the single most common way a filter row loses its rhythm.
        */}
        {children && (
          <div className="contents [&>*]:min-w-0 [&>*]:sm:col-span-1 [&>*]:lg:col-span-2">
            {children}
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3 empty:hidden">
        {activeCount > 0 && (
          <>
            <span className="text-xs text-slate-500">
              {activeCount} filter{activeCount === 1 ? '' : 's'} applied
            </span>
            {onReset && (
              <button
                type="button"
                onClick={onReset}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
              >
                <X className="size-3.5" aria-hidden="true" />
                Clear
              </button>
            )}
          </>
        )}
        {trailing}
      </div>
    </div>
  )
}

export default AdminFilterBar
