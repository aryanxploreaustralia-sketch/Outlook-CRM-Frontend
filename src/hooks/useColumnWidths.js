/**
 * Excel-style column resizing for a `table-fixed` table.
 *
 * The sibling of `useColumnOrder`: that one owns which columns appear and in
 * what order, this one owns how wide each is. They are deliberately separate —
 * a table can want either without the other — and both persist to
 * `localStorage` under a key the caller supplies.
 *
 * ## Widths are percentages, and that is the whole design
 *
 * A pixel width would be the obvious choice and is the wrong one here. Pixels
 * do not know how wide the table is, so dragging a column wider makes the row
 * wider than its container — which is a horizontal scrollbar, the one thing
 * this table must never grow. Pixels also do not survive a window resize or a
 * different monitor: a layout dragged on a 27" screen arrives on a laptop
 * wider than the viewport.
 *
 * Percentages are immune to both. The columns always sum to the same share of
 * the table, so the table is always exactly its parent's width, at any viewport
 * and after any drag. The fixed pixel columns either side — the selection
 * checkbox and the delete action — are untouched by all of this, which is what
 * guarantees the delete control can never be pushed out of view.
 *
 * ## Widening one column narrows another
 *
 * Every drag moves width between exactly two columns: the one being dragged and
 * a donor. The donor is the flexible column (Remarks, for the register) unless
 * that is the one being dragged, in which case it is the next column along.
 * Both are clamped to their minimum, so a drag stops when the donor has nothing
 * left to give rather than by stealing from the whole row or overflowing it.
 *
 * ## Alignment is free
 *
 * Widths are applied to the `<th>` only. Under `table-fixed` the body cells
 * take their column's width from the header row, so a resized column moves its
 * data with it and the sticky header can never drift out of line with the rows
 * beneath it.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

/** Reads a saved `{ key: percentage }` map, or null. */
function readWidths(storageKey) {
  try {
    const raw = window.localStorage.getItem(storageKey)
    const parsed = raw ? JSON.parse(raw) : null
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null

    // Only finite positive numbers survive; a corrupt entry falls back to the
    // default rather than rendering a column of `NaN%`.
    const clean = {}
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === 'number' && Number.isFinite(value) && value > 0) clean[key] = value
    }
    return Object.keys(clean).length > 0 ? clean : null
  } catch {
    return null
  }
}

function writeWidths(storageKey, value) {
  try {
    if (value === null) window.localStorage.removeItem(storageKey)
    else window.localStorage.setItem(storageKey, JSON.stringify(value))
  } catch {
    // A full or disabled store costs the preference, not the table.
  }
}

const clamp = (value, low, high) => Math.min(Math.max(value, low), high)

/**
 * @param {object}   input
 * @param {string}   input.storageKey   Include the user id: widths are personal.
 * @param {Array<{ key: string, defaultPercent: number, minPixels: number }>} input.columns
 * @param {string[]} input.orderedKeys  The columns as currently displayed.
 * @param {string}   input.flexibleKey  The column that gives and takes width.
 * @param {number}   [input.reservedPixels]
 *   The width of the fixed pixel columns this table also has — a selection
 *   checkbox, an actions cell. The shares divide what is left after them.
 *
 * ## Why the shares are rendered as pixels, not percentages
 *
 * A percentage of the *table* leaves the fixed columns unaccounted for, so the
 * declared widths add up to less than the table and `table-fixed` hands the
 * surplus back to every column in proportion — dragging a column 120px made it
 * 155px wider, and the edge no longer followed the cursor.
 *
 * `calc((100% - 88px) * 0.21)` states it exactly and is the obvious fix.
 * Chrome ignores it: a calc width on a table column under `table-layout:
 * fixed` is treated as auto, and the columns come out evenly split. Measured,
 * not assumed — three calc columns of 21/55/24 all rendered at 293px.
 *
 * So the shares are kept as fractions and rendered as pixels against the
 * table's measured width, which a `ResizeObserver` keeps current. Attach
 * `tableRef` to the `<table>`. The last flexible column absorbs the rounding,
 * so the columns sum to exactly the table's width and nothing is redistributed.
 * @returns {{
 *   tableRef: import('react').RefObject<HTMLTableElement>,
 *   percentOf: (key: string) => number,
 *   widthOf: (key: string) => string,
 *   handleProps: (key: string) => object,
 *   isResizing: boolean,
 *   isCustomised: boolean,
 *   reset: () => void,
 * }}
 */
export function useColumnWidths({ storageKey, columns, orderedKeys, flexibleKey, reservedPixels = 0 }) {
  const [saved, setSaved] = useState(() => readWidths(storageKey))
  const [dragging, setDragging] = useState(null)

  /**
   * The table's own width, watched rather than assumed.
   *
   * The shares are stored as fractions but rendered as pixels, so a window
   * resize — or the filter rail opening, or a zoom — has to re-render them
   * against the new width. Without this the columns would keep a width the
   * table no longer has.
   */
  const tableRef = useRef(null)
  const [tableWidth, setTableWidth] = useState(0)

  useEffect(() => {
    const table = tableRef.current
    if (!table || typeof ResizeObserver === 'undefined') return undefined

    const observer = new ResizeObserver(([entry]) => {
      setTableWidth(Math.round(entry.contentRect.width))
    })
    observer.observe(table)

    return () => observer.disconnect()
  }, [])

  // A different signed-in user means different widths, so the state follows the
  // key rather than sticking from first mount.
  useEffect(() => {
    setSaved(readWidths(storageKey))
  }, [storageKey])

  const defaults = useMemo(
    () => Object.fromEntries(columns.map((column) => [column.key, column.defaultPercent])),
    [columns],
  )

  const minimums = useMemo(
    () => Object.fromEntries(columns.map((column) => [column.key, column.minPixels])),
    [columns],
  )

  /** Saved widths over defaults, ignoring keys this table does not have. */
  const settled = useMemo(() => {
    const merged = { ...defaults }
    for (const [key, value] of Object.entries(saved ?? {})) {
      if (key in merged) merged[key] = value
    }
    return merged
  }, [defaults, saved])

  // What is on screen: the settled widths, or the live pair mid-drag.
  const widths = dragging ? { ...settled, ...dragging.preview } : settled

  const widthsRef = useRef(widths)
  widthsRef.current = widths

  /*
   * Deliberately not memoised. Both read `widths`, which is a fresh object on
   * every render — and has to be, because a drag repaints the two columns it
   * touches. A `useCallback` here would be rebuilt every render anyway, for the
   * cost of pretending otherwise.
   */
  const percentOf = (key) => widths[key] ?? defaults[key] ?? 0

  const available = Math.max(0, tableWidth - reservedPixels)

  /**
   * The rendered width: pixels once the table has been measured, percentages
   * for the very first paint before that has happened.
   */
  const widthOf = (key) => {
    if (available <= 0) return `${percentOf(key)}%`

    // The flexible column takes what the others leave, so rounding cannot make
    // the row a pixel wider or narrower than the table.
    if (key === flexibleKey) {
      const others = columns
        .filter((column) => column.key !== flexibleKey)
        .reduce((total, column) => total + Math.round((percentOf(column.key) / 100) * available), 0)

      return `${Math.max(0, available - others)}px`
    }

    return `${Math.round((percentOf(key) / 100) * available)}px`
  }

  /** The column that gives up what this one gains, and vice versa. */
  const donorFor = useCallback(
    (key) => {
      if (key !== flexibleKey && orderedKeys.includes(flexibleKey)) return flexibleKey

      const index = orderedKeys.indexOf(key)
      return orderedKeys[index + 1] ?? orderedKeys[index - 1] ?? null
    },
    [flexibleKey, orderedKeys],
  )

  const handleProps = useCallback(
    (key) => ({
      onPointerDown: (event) => {
        // Left button only, and never the reorder drag this handle sits inside.
        if (event.button !== 0) return
        event.preventDefault()
        event.stopPropagation()

        const donorKey = donorFor(key)
        if (!donorKey) return

        // The span the shares actually divide up: the table, less the fixed
        // columns. Measured at the moment of the drag rather than read from
        // state, so a resize mid-gesture cannot skew it.
        const table = event.currentTarget.closest('table')
        const measured = table?.getBoundingClientRect().width ?? 0
        const available = measured - reservedPixels
        if (available <= 0) return

        const startX = event.clientX
        const start = widthsRef.current[key]
        const donorStart = widthsRef.current[donorKey]

        // Minimums are stated in pixels — a name needs a number of characters,
        // not a share of a monitor — so they are converted at the width the
        // table actually has right now.
        const minSelf = (minimums[key] / available) * 100
        const minDonor = (minimums[donorKey] / available) * 100

        // Growing past this would push the donor below its minimum.
        const maxSelf = start + Math.max(0, donorStart - minDonor)

        setDragging({ key, donorKey, preview: { [key]: start, [donorKey]: donorStart } })

        const previousUserSelect = document.body.style.userSelect
        const previousCursor = document.body.style.cursor
        document.body.style.userSelect = 'none'
        document.body.style.cursor = 'col-resize'

        const onMove = (moveEvent) => {
          const deltaPercent = ((moveEvent.clientX - startX) / available) * 100
          const next = clamp(start + deltaPercent, minSelf, maxSelf)

          setDragging({
            key,
            donorKey,
            preview: { [key]: next, [donorKey]: donorStart - (next - start) },
          })
        }

        const onFinish = () => {
          window.removeEventListener('pointermove', onMove)
          window.removeEventListener('pointerup', onFinish)
          window.removeEventListener('pointercancel', onFinish)
          document.body.style.userSelect = previousUserSelect
          document.body.style.cursor = previousCursor

          // Commit whatever is on screen. Reading the ref rather than the
          // closure means the last frame of the drag is what gets saved.
          const committed = { ...widthsRef.current }
          setDragging(null)
          setSaved(committed)
          writeWidths(storageKey, committed)
        }

        // On `window`, so releasing the mouse outside the table — or outside
        // the browser — still ends the drag.
        window.addEventListener('pointermove', onMove)
        window.addEventListener('pointerup', onFinish)
        window.addEventListener('pointercancel', onFinish)
      },
    }),
    [donorFor, minimums, reservedPixels, storageKey],
  )

  const reset = useCallback(() => {
    setSaved(null)
    setDragging(null)
    writeWidths(storageKey, null)
  }, [storageKey])

  return {
    tableRef,
    percentOf,
    widthOf,
    handleProps,
    isResizing: dragging !== null,
    isCustomised: saved !== null,
    reset,
  }
}

export default useColumnWidths
