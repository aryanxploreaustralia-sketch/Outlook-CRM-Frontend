/**
 * Starts a page at the top of the admin scroll container.
 *
 * ## Why a page needs to ask for this
 *
 * A route change inside the admin shell does not reset the scroll position by
 * itself. `AdminLayout` is the parent route of every admin page, so navigating
 * from `/admin/users` to `/admin/users/:id` swaps the `<Outlet />` content
 * while everything around it stays mounted — and the page keeps whatever offset
 * the previous one left behind.
 *
 * The effect is that opening a user from row forty of the directory renders the
 * detail page already scrolled past its first several sections. This app
 * mounts no `<ScrollRestoration>`, and the sibling `useScrollMemory`
 * deliberately *restores* an offset rather than clearing one.
 *
 * This is the counterpart to that hook. `useScrollMemory` is for a list you
 * want to come back to; this is for a page that has no business remembering
 * where the last one was.
 *
 * ## Why `useLayoutEffect`
 *
 * It runs before the browser paints, so the page appears at the top rather
 * than appearing mid-way and jumping. A `useEffect` would be one painted frame
 * too late, and on a long page that frame is visible.
 *
 * Setting `scrollTop = 0` needs no deferral, unlike restoring a positive
 * offset: zero is valid at any content height, so it cannot be clamped by a
 * page that has not finished laying out.
 *
 * @param {unknown} key
 *   Changing this scrolls back to the top again. Pass the value that identifies
 *   *which* record is being shown — a route parameter, typically — so moving
 *   from one user straight to another starts at the top for the second as well.
 * @param {{ elementId?: string, enabled?: boolean }} [options]
 *   `enabled` is for a caller that must not reset yet; it defaults to on.
 */

import { useLayoutEffect } from 'react'

export function useScrollToTop(key, { elementId = 'admin-main', enabled = true } = {}) {
  useLayoutEffect(() => {
    if (!enabled) return

    // The document owns the scroll now, so this is the reset that matters.
    // `instant`, not smooth: this is a new page appearing, not a movement
    // within one, and animating it would show the reader the bottom of a page
    // they never asked to see.
    globalThis.scrollTo({ top: 0, behavior: 'instant' })

    // The container is reset too, and still guarded. It no longer scrolls in
    // the admin shell, but the hook is used by pages that could be mounted
    // elsewhere, and a stale offset on an element that *does* scroll would
    // survive this otherwise.
    const element = document.getElementById(elementId)
    if (element && element.scrollTop !== 0) element.scrollTop = 0
  }, [key, elementId, enabled])
}

export default useScrollToTop
