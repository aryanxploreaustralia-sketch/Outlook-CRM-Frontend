/**
 * Measures a container's rendered width.
 *
 * Charts here are drawn in real pixels rather than in a scaled `viewBox`. A
 * `viewBox` that stretches to fit is the easier option and the wrong one: it
 * scales the *text* with the plot, so an axis label is 11px on a laptop and 15px
 * on a wide monitor, and a 2px line becomes 2.8px. Measuring instead means every
 * stroke and every label is exactly the size it was specified at, on every
 * viewport.
 *
 * `ResizeObserver` rather than a window `resize` listener, because the sidebar
 * collapsing changes a chart's width without the window changing size at all.
 */

import { useEffect, useRef, useState } from 'react'

/**
 * @param {number} [initial] Width assumed before the first measurement. Chosen
 *   to be close to a typical rendered width so the first paint is not visibly
 *   wrong on its way to being corrected.
 * @returns {[import('react').RefObject<HTMLElement>, number]}
 */
export function useElementWidth(initial = 640) {
  const ref = useRef(null)
  const [width, setWidth] = useState(initial)

  useEffect(() => {
    const element = ref.current
    if (!element) return undefined

    // Older browsers and jsdom have no ResizeObserver. Falling back to a single
    // measurement is better than throwing: the chart renders, it simply will not
    // re-measure on resize.
    if (typeof ResizeObserver === 'undefined') {
      setWidth(element.getBoundingClientRect().width || initial)
      return undefined
    }

    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect?.width
      if (!next) return

      // Compared inside the updater rather than against the `width` variable.
      // Reading `width` here would read the value captured when the observer was
      // created, so after the first resize every comparison would be against a
      // stale number — and the guard would start rejecting real changes.
      setWidth((previous) => (Math.abs(next - previous) > 1 ? next : previous))
    })

    observer.observe(element)
    return () => observer.disconnect()
  }, [initial])

  return [ref, width]
}

export default useElementWidth
