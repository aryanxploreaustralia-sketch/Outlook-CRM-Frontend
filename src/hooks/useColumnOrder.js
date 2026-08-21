/**
 * Reorderable table columns, remembered per table.
 *
 * ## Why the order lives over the column definitions, not inside them
 *
 * The one failure this feature can produce is a header that names one field
 * above cells holding another. The only way to make that impossible rather than
 * merely unlikely is to have a single ordered list drive both rows of the
 * table — so this hook returns *the column objects themselves*, reordered, and
 * the caller renders headers and cells from that one array. There is no second
 * list to fall out of step with the first.
 *
 * ## Reconciliation
 *
 * A saved order is a list of keys written by an older build. Keys that no longer
 * exist are dropped, and columns the save has never seen are appended. So adding
 * or removing a column never strands somebody on a broken layout — the new
 * column simply arrives last until they move it.
 *
 * ## Storage
 *
 * `localStorage`, guarded: Safari's private mode throws on write, and a browser
 * with site data disabled throws on read. A preference is a convenience, so
 * every access degrades to the default rather than taking the table down with
 * it. Keys are per-table (see `STORAGE_KEYS`), which is what stops the console's
 * layout from following somebody into the CRM.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'

/** localStorage that cannot throw — the pattern `GlobalSearch` established. */
function readOrder(key) {
  try {
    const raw = window.localStorage.getItem(key)
    const parsed = raw ? JSON.parse(raw) : null
    return Array.isArray(parsed) ? parsed.filter((entry) => typeof entry === 'string') : null
  } catch {
    return null
  }
}

function writeOrder(key, value) {
  try {
    if (value === null) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // A full or disabled store costs the preference, not the table.
  }
}

/**
 * Applies a saved key order to the live column definitions.
 *
 * @param {Array<{ key: string }>} columns  in their default order
 * @param {?Array<string>} saved
 * @returns {Array<{ key: string }>}
 */
function reconcile(columns, saved) {
  if (!saved?.length) return columns

  const byKey = new Map(columns.map((column) => [column.key, column]))
  const ordered = []

  for (const key of saved) {
    const column = byKey.get(key)
    // `delete` as we go, so a corrupt save listing a key twice cannot render
    // the same column twice.
    if (column) {
      ordered.push(column)
      byKey.delete(key)
    }
  }

  // Anything the save did not mention keeps its default relative order.
  for (const column of columns) if (byKey.has(column.key)) ordered.push(column)

  return ordered
}

/**
 * @param {string} storageKey  unique per table; see `STORAGE_KEYS`
 * @param {Array<{ key: string }>} columns  the definitions, in default order
 * @returns {{
 *   columns: Array<object>,
 *   isCustomised: boolean,
 *   reset: () => void,
 *   move: (key: string, targetKey: string) => void,
 *   moveBy: (key: string, delta: number) => void,
 *   headerProps: (key: string) => object,
 *   dragKey: ?string,
 *   overKey: ?string,
 * }}
 *   Spread `headerProps(column.key)` onto each `<th>`. It carries the drag
 *   handlers, the keyboard handlers and `data-` hooks for styling.
 */
export function useColumnOrder(storageKey, columns) {
  const [saved, setSaved] = useState(() => readOrder(storageKey))
  const [dragKey, setDragKey] = useState(null)
  const [overKey, setOverKey] = useState(null)

  // A different table (or a different signed-in scope) means a different saved
  // order, so the state follows the key rather than sticking from first mount.
  useEffect(() => {
    setSaved(readOrder(storageKey))
  }, [storageKey])

  const ordered = useMemo(() => reconcile(columns, saved), [columns, saved])

  const commit = useCallback(
    (nextColumns) => {
      const keys = nextColumns.map((column) => column.key)
      setSaved(keys)
      writeOrder(storageKey, keys)
    },
    [storageKey],
  )

  /** Moves `key` to sit where `targetKey` currently is. */
  const move = useCallback(
    (key, targetKey) => {
      if (!key || !targetKey || key === targetKey) return

      const from = ordered.findIndex((column) => column.key === key)
      const to = ordered.findIndex((column) => column.key === targetKey)
      if (from === -1 || to === -1) return

      const next = [...ordered]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      commit(next)
    },
    [ordered, commit],
  )

  /** Keyboard equivalent: one step left or right. */
  const moveBy = useCallback(
    (key, delta) => {
      const from = ordered.findIndex((column) => column.key === key)
      const to = from + delta
      if (from === -1 || to < 0 || to >= ordered.length) return
      move(key, ordered[to].key)
    },
    [ordered, move],
  )

  const reset = useCallback(() => {
    setSaved(null)
    writeOrder(storageKey, null)
  }, [storageKey])

  const headerProps = useCallback(
    (key) => ({
      draggable: true,
      onDragStart: (event) => {
        setDragKey(key)
        event.dataTransfer.effectAllowed = 'move'
        // Firefox ignores a drag that carries no payload.
        try {
          event.dataTransfer.setData('text/plain', key)
        } catch {
          // Some environments lock the transfer; the React state still drives it.
        }
      },
      onDragOver: (event) => {
        if (!dragKey || dragKey === key) return
        // Without this the drop never fires — the default is "reject".
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
        setOverKey(key)
      },
      onDragLeave: () => setOverKey((current) => (current === key ? null : current)),
      onDrop: (event) => {
        event.preventDefault()
        const source = dragKey ?? event.dataTransfer.getData('text/plain')
        move(source, key)
        setDragKey(null)
        setOverKey(null)
      },
      onDragEnd: () => {
        setDragKey(null)
        setOverKey(null)
      },
      /*
       * Keyboard parity. HTML5 drag-and-drop is pointer-only, so a header that
       * could only be dragged would put this feature out of reach of anyone
       * navigating by keyboard. Ctrl/Cmd is required so the arrow keys still
       * scroll the table normally.
       */
      onKeyDown: (event) => {
        if (!event.ctrlKey && !event.metaKey) return
        if (event.key === 'ArrowLeft') {
          event.preventDefault()
          moveBy(key, -1)
        } else if (event.key === 'ArrowRight') {
          event.preventDefault()
          moveBy(key, 1)
        }
      },
      tabIndex: 0,
      'data-column-key': key,
      'data-dragging': dragKey === key ? '' : undefined,
      'data-drop-target': overKey === key && dragKey !== key ? '' : undefined,
    }),
    [dragKey, overKey, move, moveBy],
  )

  return {
    columns: ordered,
    isCustomised: Boolean(saved?.length),
    reset,
    move,
    moveBy,
    headerProps,
    dragKey,
    overKey,
  }
}

export default useColumnOrder
