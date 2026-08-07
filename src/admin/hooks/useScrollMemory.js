/**
 * Remembers where a list was scrolled to, and restores it on the way back.
 *
 * ## Why the router cannot do this here
 *
 * React Router's `<ScrollRestoration>` restores the **window**. The admin shell
 * locks the app frame to the viewport and gives `<main>` the only scroll
 * container, so the window scroll offset is always zero and restoring it does
 * nothing. The position that matters belongs to an element.
 *
 * ## Why the key is the full URL
 *
 * The directory keeps its filters in the query string, so `?status=invited&page=3`
 * is a different list from `?page=1` and deserves its own remembered position.
 * Keying on pathname alone would drop somebody back at row 40 of a list they had
 * since filtered down to four rows.
 *
 * `sessionStorage` rather than a module-level Map: it survives a reload, which is
 * what a user who refreshes a detail page and then goes back expects, and it is
 * discarded with the tab so it cannot grow forever.
 */

import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const PREFIX = 'admin:scroll:'

/**
 * Saves the container's scroll offset while mounted, and restores it on mount.
 *
 * @param {{ elementId?: string, enabled?: boolean }} [options]
 *   `enabled` defers restoration until the list has actually rendered — restoring
 *   against a skeleton scrolls to an offset the real content has not reached yet,
 *   and the browser silently clamps it to the bottom of a shorter page.
 */
export function useScrollMemory({ elementId = 'admin-main', enabled = true } = {}) {
  const location = useLocation()
  const key = `${PREFIX}${location.pathname}${location.search}`

  // --- Save, continuously while mounted ------------------------------------
  useEffect(() => {
    const element = document.getElementById(elementId)
    if (!element) return undefined

    let frame = null

    const onScroll = () => {
      // Coalesced to one write per frame. A scroll handler writing to
      // sessionStorage on every event is a synchronous disk-backed write per
      // pixel, which is felt on a long list.
      if (frame !== null) return

      frame = requestAnimationFrame(() => {
        frame = null
        try {
          sessionStorage.setItem(key, String(element.scrollTop))
        } catch {
          // Private browsing or a blocked-storage policy. Losing a scroll
          // position is not worth an error.
        }
      })
    }

    element.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      element.removeEventListener('scroll', onScroll)
      if (frame !== null) cancelAnimationFrame(frame)
    }
  }, [key, elementId])

  // --- Restore, once the content exists ------------------------------------
  useEffect(() => {
    if (!enabled) return undefined

    let stored = null
    try {
      stored = sessionStorage.getItem(key)
    } catch {
      return undefined
    }

    if (stored === null) return undefined

    const offset = Number(stored)
    if (!Number.isFinite(offset) || offset <= 0) return undefined

    // Deferred a frame so the restored rows have been laid out. Setting
    // `scrollTop` before the list has height is clamped to zero.
    const frame = requestAnimationFrame(() => {
      const element = document.getElementById(elementId)
      if (element) element.scrollTop = offset
    })

    return () => cancelAnimationFrame(frame)
  }, [key, elementId, enabled])
}

export default useScrollMemory
