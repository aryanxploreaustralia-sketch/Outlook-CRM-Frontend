/**
 * Scroll-spy for an in-page section navigation, doing two jobs with one observer.
 *
 *  1. **Which section is on screen**, so the left navigation can highlight it.
 *  2. **Which sections have ever been on screen**, so a page can defer a section's
 *     request until somebody actually scrolls to it.
 *
 * The second is why this exists rather than a plain scroll listener. A user
 * dashboard with nine sections would otherwise fire every request on mount —
 * analytics, campaigns, leads — for a visitor who only wanted the header. One
 * `IntersectionObserver` answers both questions and costs nothing per frame.
 *
 * ## Why the scroll root has to be passed in
 *
 * The admin shell locks the app frame and gives `<main>` the only scroll
 * container. An observer left on the default root watches the *viewport*, which
 * never scrolls here, so every section would report as permanently visible and
 * the highlight would never move.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

/**
 * @param {string[]} sectionIds Ordered, matching the DOM ids of each section.
 * @param {{ rootId?: string }} [options] The scrolling ancestor's element id.
 * @returns {{
 *   activeId: string,
 *   seen: Set<string>,
 *   hasSeen: (id: string) => boolean,
 *   register: (id: string) => (node: ?HTMLElement) => void,
 *   scrollTo: (id: string) => void,
 * }}
 */
export function useSectionObserver(sectionIds, { rootId = null } = {}) {
  const [activeId, setActiveId] = useState(sectionIds[0] ?? '')
  const [seen, setSeen] = useState(() => new Set(sectionIds.slice(0, 1)))

  const nodesRef = useRef(new Map())

  /**
   * Bumped whenever the set of registered nodes changes.
   *
   * The observer effect below reads `nodesRef` and bails when it is empty. Its
   * only dependencies were `idsKey` and `rootId`, both of which are constants —
   * so on a page that renders a loading state before its sections, the effect
   * ran once against an empty map, returned early, and **never ran again**. No
   * observer was ever created, nothing was ever marked seen, and every section
   * deferred behind `hasSeen(...)` stayed disabled for the life of the page.
   *
   * A ref cannot trigger that re-run, which is the whole reason the miss was
   * silent. This counter is the state the effect needs to notice that the
   * sections have arrived.
   */
  const [nodeVersion, setNodeVersion] = useState(0)

  /**
   * One ref callback per id, memoised so its **identity never changes**.
   *
   * This is load bearing, and getting it wrong caused an infinite render loop.
   *
   * Call sites write `ref={registerRef('role')}`, which runs on every render.
   * If that returns a fresh closure each time, React sees a new ref callback and
   * honours its contract: detach the old one with `null`, attach the new one
   * with the node — **every render**. While this function only mutated a ref
   * that churn was invisible. The moment it also called `setNodeVersion`, each
   * render queued two state updates, which caused a render, which produced new
   * closures, which detached and reattached again:
   *
   *     render → new callback → detach(null) + attach(node)
   *            → 2 × setState → render → …
   *
   * Caching by id fixes it at the source. React now sees the same function
   * across renders, so it calls it only on genuine mount and unmount — which is
   * exactly when the node set actually changes and the observer really does
   * need rebuilding.
   *
   * The map is held in a ref rather than state: it is a cache of callbacks, and
   * storing it in state would put us back in the loop it exists to prevent.
   */
  const callbacksRef = useRef(new Map())

  const register = useCallback((id) => {
    const cached = callbacksRef.current.get(id)
    if (cached) return cached

    const callback = (node) => {
      if (node) nodesRef.current.set(id, node)
      else nodesRef.current.delete(id)

      // Safe to bump unconditionally now: with a stable identity this runs once
      // per section on mount and once on unmount, not once per render.
      setNodeVersion((previous) => previous + 1)
    }

    callbacksRef.current.set(id, callback)
    return callback
  }, [])

  const idsKey = sectionIds.join('|')

  useEffect(() => {
    const root = document.getElementById(rootId)
    const nodes = [...nodesRef.current.entries()]

    if (nodes.length === 0) return undefined

    if (typeof IntersectionObserver === 'undefined') {
      // No observer: reveal everything rather than leave sections permanently
      // unloaded. Degrading to "load it all" is the safe direction.
      setSeen(new Set(sectionIds))
      return undefined
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const newlySeen = []

        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const id = entry.target.id
          if (id) newlySeen.push(id)
        }

        if (newlySeen.length > 0) {
          setSeen((previous) => {
            const next = new Set(previous)
            let changed = false
            for (const id of newlySeen) {
              if (!next.has(id)) {
                next.add(id)
                changed = true
              }
            }
            // Returning the same Set when nothing changed avoids a render on
            // every scroll tick that re-crosses an already-seen boundary.
            return changed ? next : previous
          })
        }

        /**
         * The active section is the topmost one currently intersecting.
         *
         * Not "the most visible": a short section sandwiched between two long
         * ones never wins that contest, so the highlight skips it entirely on
         * the way past.
         */
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)

        if (visible.length > 0) {
          // Functional and equality-guarded. React would bail out on an
          // identical primitive anyway, but returning `previous` avoids even
          // scheduling the re-render on every scroll tick where the topmost
          // section has not changed — which is most of them.
          const topmost = visible[0].target.id
          setActiveId((previous) => (previous === topmost ? previous : topmost))
        }
      },
      {
        root: root ?? null,
        // Biased to the upper part of the scroll container, so a section counts
        // as "current" once its heading reaches reading position rather than
        // when its last pixel leaves the bottom.
        rootMargin: '-80px 0px -55% 0px',
        threshold: 0,
      },
    )

    for (const [, node] of nodes) observer.observe(node)

    return () => observer.disconnect()
    // `sectionIds` is compared by content, not identity: callers build the array
    // inline and a fresh reference each render would tear the observer down and
    // rebuild it on every scroll-driven state update.
    //
    // `nodeVersion` is what makes the effect re-run once the sections mount —
    // see the note on it above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, rootId, nodeVersion])

  const hasSeen = useCallback((id) => seen.has(id), [seen])

  /**
   * Scrolls a section into view and marks it active immediately.
   *
   * The observer would set it a moment later anyway, but a navigation whose
   * highlight lags behind the click by the length of a smooth scroll reads as
   * unresponsive.
   */
  const scrollTo = useCallback((id) => {
    const node = nodesRef.current.get(id)
    if (!node) return

    setActiveId(id)
    setSeen((previous) => (previous.has(id) ? previous : new Set(previous).add(id)))
    node.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  return useMemo(
    () => ({ activeId, seen, hasSeen, register, scrollTo }),
    [activeId, seen, hasSeen, register, scrollTo],
  )
}

export default useSectionObserver
