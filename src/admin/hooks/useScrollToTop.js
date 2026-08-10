/**
 * Starts a page at the top of the admin scroll container.
 *
 * ## Why a page needs to ask for this
 *
 * The admin shell locks the frame to `h-dvh overflow-hidden` and gives `<main
 * id="admin-main">` the only scroll container. That element belongs to
 * `AdminLayout`, which is the parent route of every admin page — so navigating
 * from `/admin/users` to `/admin/users/:id` swaps the `<Outlet />` content
 * while the scroll container itself stays mounted, keeping whatever
 * `scrollTop` the previous page left behind.
 *
 * The effect is that opening a user from row forty of the directory renders the
 * detail page already scrolled past its first several sections. Nothing resets
 * it: React Router's `<ScrollRestoration>` acts on the window, which never
 * scrolls here, and the sibling `useScrollMemory` deliberately *restores* an
 * offset rather than clearing one.
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

    const element = document.getElementById(elementId)
    // Guarded rather than assumed: the hook is harmless on any screen rendered
    // outside the admin shell, where this container does not exist.
    if (element) element.scrollTop = 0
  }, [key, elementId, enabled])
}

export default useScrollToTop
