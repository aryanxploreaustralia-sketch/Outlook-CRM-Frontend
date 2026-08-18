/**
 * The admin data table.
 *
 * Configuration-driven: a page declares its columns and hands over rows. That is
 * what makes six screens share one table instead of six near-identical `<table>`
 * blocks that each solve responsiveness, empty states and sorting differently.
 *
 * ## What it owns
 *
 *  - **Its own horizontal scroll.** The container is `overflow-x-auto`, so a
 *    ten-column table scrolls *inside the card* and the page body never scrolls
 *    sideways. This is the single most common responsive failure in admin UIs.
 *  - **A header that stays put within its own scrollport.** `sticky top-0` on
 *    the `<th>`s, which holds the header while the *table* scrolls sideways.
 *    It deliberately does not follow the page down: the `overflow-x-auto`
 *    wrapper is the header's scrollport, not the viewport, so no `top` offset
 *    can make it track the document — attempting one displaces the header
 *    inside the table instead. See the note on the `<th>` itself.
 *  - **Loading, empty and ready as one decision.** A table that renders its
 *    empty state while still loading tells the user their data is gone.
 *  - **Accessible sorting.** Sortable headers are real `<button>`s inside the
 *    `<th>` and the `<th>` carries `aria-sort`, so the state is announced rather
 *    than only drawn as a chevron.
 *
 * ## Column contract
 *
 * ```
 * {
 *   key:       string                  unique; also the sort key
 *   header:    ReactNode
 *   render?:   (row, index) => ReactNode   defaults to row[key]
 *   sortable?: boolean
 *   align?:    'left' | 'right' | 'center'
 *   width?:    string                  a Tailwind width class
 *   headerClassName?: string
 *   cellClassName?:   string
 *   srOnlyHeader?: boolean             for an actions column with no visible label
 * }
 * ```
 */

import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { Link } from 'react-router-dom'

import { AdminEmptyState } from '@/admin/components/AdminEmptyState'
import { AdminTableLoading } from '@/admin/components/AdminLoadingState'

const ALIGN = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
}

/**
 * @param {{
 *   columns: Array<object>,
 *   rows: Array<object>,
 *   rowKey?: (row: object, index: number) => string,
 *   isLoading?: boolean,
 *   sort?: { key: string, direction: 'asc' | 'desc' } | null,
 *   onSortChange?: (key: string) => void,
 *   onRowClick?: (row: object) => void,
 *   empty?: import('react').ReactNode,
 *   caption?: string,
 *   className?: string,
 * }} props
 */
export function AdminTable({
  columns,
  rows,
  rowKey = (row, index) => row.id ?? String(index),
  isLoading = false,
  sort = null,
  onSortChange,
  onRowClick,
  empty,
  caption,
  className = '',
}) {
  // Loading wins over empty. An empty state shown mid-request reads as "your
  // data is gone" rather than "your data is coming".
  if (isLoading) {
    return <AdminTableLoading rows={6} columns={Math.min(columns.length, 6)} className={className} />
  }

  if (!rows?.length) {
    return (
      empty ?? (
        <AdminEmptyState
          title="Nothing to show"
          description="There are no records matching this view."
        />
      )
    )
  }

  return (
    // The scroll container. Everything wide lives inside it, never outside.
    <div className={`scroll-x w-full overflow-x-auto ${className}`}>
      {/*
        Phase 16.1B: `table-auto`, explicitly.
        Columns size to their content rather than being divided evenly, so a
        14-character status column stops claiming the same width as a subject
        line. `min-w-[46rem]` keeps the horizontal scroll honest on a narrow
        viewport instead of crushing every column to unreadable.
      */}
      <table className="w-full min-w-[46rem] table-auto border-collapse text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}

        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/80">
            {columns.map((column) => {
              const isSorted = sort?.key === column.key
              const ariaSort = isSorted ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'

              return (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={column.sortable ? ariaSort : undefined}
                  /*
                   * `top-0`, and it must stay `top-0`.
                   *
                   * A previous change set this to `top-(--spacing-topbar)` to
                   * keep the header clear of the sticky admin topbar. That
                   * reasoning assumed this cell sticks to the viewport. It does
                   * not: the wrapper above carries `overflow-x-auto`, and CSS
                   * computes an `overflow` of `visible` to `auto` when the
                   * other axis is not `visible` — so that wrapper is a scroll
                   * container on both axes and is this cell's scrollport.
                   *
                   * Its top edge is the table's own top edge, and it never
                   * scrolls vertically. A non-zero `top` therefore does not
                   * hold the header below the topbar; it pushes the header row
                   * *down* inside the table by that amount, while the first
                   * data row stays put. The result is the first row's avatar
                   * and badges showing through the gap above the header — the
                   * "content bleeding into the header" this once caused.
                   */
                  className={`sticky top-0 z-10 whitespace-nowrap bg-slate-50/95 px-6 py-3 align-middle text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-500 backdrop-blur ${
                    ALIGN[column.align] ?? ALIGN.left
                  } ${column.width ?? ''} ${column.headerClassName ?? ''}`}
                >
                  {column.srOnlyHeader ? (
                    <span className="sr-only">{column.header}</span>
                  ) : column.sortable && onSortChange ? (
                    <button
                      type="button"
                      onClick={() => onSortChange(column.key)}
                      className="inline-flex items-center gap-1 rounded transition-colors hover:text-slate-800"
                    >
                      {column.header}
                      {isSorted ? (
                        sort.direction === 'asc' ? (
                          <ArrowUp className="size-3" aria-hidden="true" />
                        ) : (
                          <ArrowDown className="size-3" aria-hidden="true" />
                        )
                      ) : (
                        <ArrowUpDown className="size-3 text-slate-300" aria-hidden="true" />
                      )}
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              )
            })}
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-100">
          {rows.map((row, index) => (
            <tr
              key={rowKey(row, index)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              /*
               * 150ms: fast enough that the highlight tracks the pointer rather
               * than trailing it down a long list. A clickable row tints toward
               * the accent, an inert one only greys — so the hover itself says
               * whether the row does anything.
               */
              className={`transition-colors duration-[--duration-fast] ${
                onRowClick ? 'cursor-pointer hover:bg-brand-50/40' : 'hover:bg-slate-50/70'
              }`}
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={`px-6 py-3.5 align-middle text-slate-700 ${ALIGN[column.align] ?? ALIGN.left} ${
                    column.cellClassName ?? ''
                  }`}
                >
                  {column.render ? column.render(row, index) : (row[column.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * The two-line cell used wherever a table shows a person or a named entity.
 *
 * Extracted because it appears in the users, mailboxes, campaigns, leads and
 * audit tables, and five hand-rolled copies is how the avatar size ends up
 * different on two of them.
 *
 * ## `to` makes only the first line a link
 *
 * The identifier is the thing that opens a record — a reference, a name — and
 * the second line is context for reading, not a destination. Wrapping the whole
 * cell would make the company name under a reference look like a link to the
 * company, which is a different page this console does not open from here.
 *
 * A real `<Link>`, never a click handler on a `<div>`: it produces an `href`, so
 * middle-click and "open in new tab" work, and it is reachable and activatable
 * from the keyboard without anything being added for it.
 *
 * @param {{
 *   primary: import('react').ReactNode,
 *   secondary?: import('react').ReactNode,
 *   leading?: import('react').ReactNode,
 *   to?: string,
 * }} props
 */
export function AdminTableIdentity({ primary, secondary, leading, to }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      {leading}
      <div className="min-w-0">
        {to ? (
          /*
           * `no-underline` until hover: in a dense table a permanent underline
           * on every row is noise, and the pointer plus the hover state carry
           * the affordance. The focus ring is the global `:focus-visible` one,
           * so the keyboard path looks like it does everywhere else.
           */
          <Link
            to={to}
            className="block truncate rounded font-medium text-slate-900 no-underline transition-colors hover:text-brand-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
          >
            {primary}
          </Link>
        ) : (
          <p className="truncate font-medium text-slate-900">{primary}</p>
        )}
        {secondary && <p className="truncate text-xs text-slate-500">{secondary}</p>}
      </div>
    </div>
  )
}

export default AdminTable
