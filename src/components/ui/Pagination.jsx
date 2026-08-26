/**
 * The pagination control, for every paginated table in the product.
 *
 * ## One implementation
 *
 * This used to live under `admin/` and three admin screens used it, while nine
 * other tables each hand-rolled a Previous/Next pair with slightly different
 * wording, spacing and disabled rules. Same job, ten designs. It lives here now
 * so a CRM page and an admin page can render the identical control, and
 * `AdminPagination` re-exports it so nothing that already imported it changed.
 *
 * ## It paginates nothing itself
 *
 * Deliberately. It reports which page is wanted and how large a page should be;
 * fetching that page is the caller's job, and every caller here asks the server
 * for it. A component that sliced a local array would quietly invite pages to
 * load ten thousand rows in order to show twenty-five.
 */

import { ChevronLeft, ChevronRight } from 'lucide-react'

/** The choices offered, and the one a table starts on. */
export const PAGE_SIZE_OPTIONS = Object.freeze([10, 25, 50, 100])
export const DEFAULT_PAGE_SIZE = 25

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
 *   pageSizeOptions?: number[],
 *   noun?: string,
 *   disabled?: boolean,
 *   className?: string,
 * }} props
 *   `onPageSizeChange` is optional: a table whose page size is fixed simply
 *   omits it and no selector is drawn. `noun` names what is being counted, so
 *   a register says "records" and a mailbox says "messages".
 */
export function Pagination({
  page,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = PAGE_SIZE_OPTIONS,
  noun = 'records',
  disabled = false,
  className = '',
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const from = totalItems === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, totalItems)

  const canPrevious = page > 1 && !disabled
  const canNext = page < totalPages && !disabled

  /** Thousands separated: "7,708" is read at a glance, "7708" is counted. */
  const count = (value) => value.toLocaleString()

  return (
    <div className={`flex flex-col items-center justify-between gap-3 sm:flex-row ${className}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <p className="text-xs text-slate-500" aria-live="polite">
          {/* An empty table reads "Showing 0 of 0 records" rather than the
              "0–0" a range would produce, which describes nothing. */}
          {totalItems === 0 ? (
            <>
              Showing <span className="font-medium text-slate-700">0</span> of{' '}
              <span className="font-medium text-slate-700">0</span> {noun}
            </>
          ) : (
            <>
              Showing <span className="font-medium text-slate-700">{count(from)}</span>–
              <span className="font-medium text-slate-700">{count(to)}</span> of{' '}
              <span className="font-medium text-slate-700">{count(totalItems)}</span> {noun}
            </>
          )}
        </p>

        {onPageSizeChange && (
          <label className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className="sr-only">Rows per page</span>
            <select
              value={pageSize}
              disabled={disabled}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
              className="rounded-md border border-slate-300 bg-white py-1 pl-2 pr-6 text-xs text-slate-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:bg-slate-50"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size} per page
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {/*
        The page buttons are hidden when there is only one page — a lone "1"
        next to two disabled arrows is chrome that tells the reader nothing.
        The count above stays, because how many records matched is still worth
        knowing.
      */}
      {totalPages > 1 && (
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
              <span key={`gap-${index}`} className="px-1 text-xs text-slate-400" aria-hidden="true">
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
      )}
    </div>
  )
}

export default Pagination
