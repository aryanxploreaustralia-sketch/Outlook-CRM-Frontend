/**
 * The pagination footer, for every paginated table in the product.
 *
 * ## One implementation
 *
 * This used to live under `admin/` and three admin screens used it, while
 * seven other tables each hand-rolled a Previous/Next pair with slightly
 * different wording, spacing and disabled rules. Same job, ten designs. It
 * lives here now so a CRM page and an admin page render the identical control,
 * and `AdminPagination` re-exports it so nothing that imported it changed.
 *
 * ## The frame belongs to the component
 *
 * The rule above the footer is drawn here rather than passed in. Two callers
 * used to supply `className="border-t pt-4"` and five did not, so the same
 * control sat in a bordered footer on some screens and floated loose on
 * others. A component that looks different depending on who rendered it is not
 * a shared component.
 *
 * ## It paginates nothing itself
 *
 * Deliberately. It reports which page is wanted and how large a page should
 * be; fetching that page is the caller's job, and every caller here asks the
 * server for it. A component that sliced a local array would quietly invite
 * pages to load ten thousand rows in order to show twenty-five.
 */

import { ChevronLeft, ChevronRight } from 'lucide-react'

/** The choices offered, and the one a table starts on. */
export const PAGE_SIZE_OPTIONS = Object.freeze([10, 25, 50, 100])
export const DEFAULT_PAGE_SIZE = 25

/**
 * The page numbers to draw, with `null` marking an elision.
 *
 * Always the first page, the last page, and a run of three centred on the
 * current one — clamped so an edge extends inward rather than running off:
 *
 *     page 1    →  1 2 3 … 309
 *     page 150  →  1 … 149 150 151 … 309
 *     page 309  →  1 … 307 308 309
 *
 * The run is a fixed width at every position, so the control does not change
 * size as somebody pages through and the buttons stay where the cursor left
 * them.
 *
 * @param {number} current
 * @param {number} total
 * @returns {Array<number|null>}
 */
function buildWindow(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1)

  // A three-wide run around the current page, pushed inside the bounds.
  const start = Math.min(Math.max(current - 1, 1), total - 2)
  const run = [start, start + 1, start + 2]

  const pages = [...new Set([1, ...run, total])].sort((a, b) => a - b)

  const withGaps = []
  let previous = 0

  for (const page of pages) {
    // Only a skip of more than one page earns an ellipsis. Hiding a single
    // number behind "…" costs the same space and loses the number.
    if (page - previous > 1) withGaps.push(null)
    withGaps.push(page)
    previous = page
  }

  return withGaps
}

/**
 * A page button.
 *
 * `min-w-8` rather than a fixed `size-8`: page 309 needs more room than page 3,
 * and a fixed square either crops the digits or forces every button to be as
 * wide as the widest page number in the set.
 */
const PAGE_BUTTON =
  'inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-xs font-medium ' +
  'transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 ' +
  'disabled:cursor-not-allowed disabled:opacity-40'

const IDLE_BUTTON = 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'

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
 *   an empty mailbox reads "No messages to display".
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
    <div
      className={`flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-slate-200 pt-3.5 ${className}`}
    >
      {/* --- What is on screen ------------------------------------------- */}
      <p className="text-xs text-slate-500" aria-live="polite">
        {totalItems === 0 ? (
          // A range describes nothing when there is nothing. Say so plainly.
          `No ${noun} to display`
        ) : (
          <>
            Showing <span className="font-medium text-slate-700">{count(from)}</span>–
            <span className="font-medium text-slate-700">{count(to)}</span> of{' '}
            <span className="font-medium text-slate-700">{count(totalItems)}</span>
          </>
        )}
      </p>

      {/*
        The two controls travel together and stay at the right edge, so they
        line up with the table above them however the row wraps.
      */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        {onPageSizeChange && (
          <label className="flex items-center gap-2 text-xs text-slate-500">
            {/* Hidden on the narrowest screens, where the number alone is
                unambiguous and the words cost a wrap. */}
            <span className="hidden sm:inline">Rows per page</span>
            <span className="sr-only sm:hidden">Rows per page</span>
            <select
              value={pageSize}
              disabled={disabled}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
              className="h-8 rounded-md border border-slate-300 bg-white pl-2.5 pr-7 text-xs font-medium text-slate-700 transition-colors hover:border-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        )}

        {/*
          Hidden when there is only one page — a lone "1" between two dead
          arrows is chrome that tells the reader nothing. The count on the left
          stays, because how many records matched is still worth knowing.
        */}
        {totalPages > 1 && (
          <nav aria-label="Pagination" className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => onPageChange(page - 1)}
              disabled={!canPrevious}
              aria-label="Previous page"
              className={`${PAGE_BUTTON} ${IDLE_BUTTON} disabled:hover:bg-transparent`}
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
                  /* `aria-current` is what tells a screen reader which page is
                     open. The colour is the sighted half of the same fact. */
                  aria-current={entry === page ? 'page' : undefined}
                  aria-label={`Page ${entry}`}
                  className={`${PAGE_BUTTON} ${
                    entry === page ? 'bg-brand-600 text-white hover:bg-brand-700' : IDLE_BUTTON
                  }`}
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
              className={`${PAGE_BUTTON} ${IDLE_BUTTON} disabled:hover:bg-transparent`}
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </button>
          </nav>
        )}
      </div>
    </div>
  )
}

export default Pagination
