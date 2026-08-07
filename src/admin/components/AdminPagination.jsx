/**
 * Table pagination.
 *
 * Renders a numbered window rather than bare Previous/Next, because an operator
 * scanning an audit log needs to know *where* they are, not only that they can
 * move. The window is elided with ellipses so a 400-page log does not produce
 * 400 buttons.
 *
 * Announces the range in words ("1–10 of 84") as well as offering the controls.
 * "Page 3 of 9" tells a user nothing about how much data they are looking at.
 */

import { ChevronLeft, ChevronRight } from 'lucide-react'

import { ADMIN_PAGE_SIZE_OPTIONS } from '@/admin/constants/admin.constants'

/**
 * Builds the page window: first, last, the current page and one either side,
 * with `null` marking an elision.
 *
 * @param {number} current
 * @param {number} total
 * @returns {Array<number|null>}
 */
function buildWindow(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1)

  const pages = new Set([1, total, current, current - 1, current + 1])
  const sorted = [...pages].filter((page) => page >= 1 && page <= total).sort((a, b) => a - b)

  const withGaps = []
  let previous = 0

  for (const page of sorted) {
    // Only a skip of more than one page earns an ellipsis. Hiding a single
    // number behind "…" costs the same space and loses the number.
    if (page - previous > 1) withGaps.push(null)
    withGaps.push(page)
    previous = page
  }

  return withGaps
}

const PAGE_BUTTON =
  'inline-flex size-8 items-center justify-center rounded-md text-xs font-medium transition-colors'

/**
 * @param {{
 *   page: number,
 *   pageSize: number,
 *   totalItems: number,
 *   onPageChange: (next: number) => void,
 *   onPageSizeChange?: (next: number) => void,
 *   disabled?: boolean,
 *   className?: string,
 * }} props
 */
export function AdminPagination({
  page,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  disabled = false,
  className = '',
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const from = totalItems === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, totalItems)

  const canPrevious = page > 1 && !disabled
  const canNext = page < totalPages && !disabled

  return (
    <div
      className={`flex flex-col items-center justify-between gap-3 sm:flex-row ${className}`}
    >
      <div className="flex items-center gap-3">
        <p className="text-xs text-slate-500" aria-live="polite">
          Showing <span className="font-medium text-slate-700">{from}</span>–
          <span className="font-medium text-slate-700">{to}</span> of{' '}
          <span className="font-medium text-slate-700">{totalItems}</span>
        </p>

        {onPageSizeChange && (
          <label className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className="hidden sm:inline">Rows</span>
            <select
              value={pageSize}
              disabled={disabled}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
              className="rounded-md border border-slate-300 bg-white py-1 pl-2 pr-6 text-xs text-slate-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:bg-slate-50"
            >
              {ADMIN_PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <nav aria-label="Pagination" className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={!canPrevious}
          aria-label="Previous page"
          className={`${PAGE_BUTTON} text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent`}
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </button>

        {buildWindow(page, totalPages).map((entry, index) =>
          entry === null ? (
            <span
              key={`gap-${index}`}
              className="px-1 text-xs text-slate-400"
              aria-hidden="true"
            >
              …
            </span>
          ) : (
            <button
              key={entry}
              type="button"
              onClick={() => onPageChange(entry)}
              disabled={disabled}
              aria-current={entry === page ? 'page' : undefined}
              aria-label={`Page ${entry}`}
              className={`${PAGE_BUTTON} ${
                entry === page
                  ? 'bg-brand-600 text-white shadow-card'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              } disabled:cursor-not-allowed disabled:opacity-40`}
            >
              {entry}
            </button>
          ),
        )}

        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={!canNext}
          aria-label="Next page"
          className={`${PAGE_BUTTON} text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent`}
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </button>
      </nav>
    </div>
  )
}

export default AdminPagination
