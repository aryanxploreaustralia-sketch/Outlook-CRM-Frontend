/**
 * Subscribes to a CSS media query.
 *
 * `useSyncExternalStore` is used rather than `useState` + `useEffect` because
 * `matchMedia` is external state. It gives the correct value on the very first
 * render instead of one frame later, which prevents the sidebar flashing open
 * before collapsing on a tablet-width viewport.
 */

import { useCallback, useSyncExternalStore } from 'react'

/**
 * @param {string} query A media query string, e.g. `(max-width: 767px)`.
 * @returns {boolean}
 */
export function useMediaQuery(query) {
  const subscribe = useCallback(
    (onStoreChange) => {
      // Guard for non-browser environments (SSR, tests without jsdom).
      if (typeof window === 'undefined' || !window.matchMedia) return () => {}

      const list = window.matchMedia(query)
      list.addEventListener('change', onStoreChange)
      return () => list.removeEventListener('change', onStoreChange)
    },
    [query],
  )

  const getSnapshot = useCallback(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false
    return window.matchMedia(query).matches
  }, [query])

  // Server snapshot: assume the desktop layout, which is the progressive-
  // enhancement default if JavaScript or matchMedia is unavailable.
  const getServerSnapshot = useCallback(() => false, [])

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

/**
 * Breakpoints matching the Tailwind defaults used across the layout.
 * Centralised so JavaScript and CSS cannot disagree about where a breakpoint is.
 */
export const BREAKPOINTS = Object.freeze({
  /** Below Tailwind `md` — drawer navigation. */
  MOBILE: '(max-width: 767px)',
  /** Tailwind `md` to just below `lg` — sidebar auto-collapses to icons. */
  TABLET: '(min-width: 768px) and (max-width: 1023px)',
  /** Tailwind `lg` and up — sidebar expanded by default. */
  DESKTOP: '(min-width: 1024px)',
})

export default useMediaQuery
