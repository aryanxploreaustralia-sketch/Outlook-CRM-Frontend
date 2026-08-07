/**
 * Layout/chrome state provider.
 *
 * Owns three related pieces of responsive behaviour:
 *
 *  1. **Auto-collapse.** Tablet widths collapse the sidebar to icons so content
 *     keeps a usable measure; desktop restores it. A manual choice on desktop is
 *     remembered, so the layout never fights the user.
 *  2. **Drawer.** Below `md` the sidebar becomes an overlay drawer, closed by
 *     default and closed again on navigation.
 *  3. **Persistence.** The desktop collapse preference survives a reload, which
 *     users expect from an app they work in all day.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'

import { STORAGE_KEYS } from '@/constants/app.constants'
import { UiContext } from '@/context/uiContext'
import { BREAKPOINTS, useMediaQuery } from '@/hooks/useMediaQuery'

/** Reads the stored collapse preference, tolerating unavailable storage. */
function readStoredCollapsed() {
  try {
    return window.localStorage.getItem(STORAGE_KEYS.SIDEBAR_COLLAPSED) === 'true'
  } catch {
    // Private browsing or a blocked-storage policy must not break the layout.
    return false
  }
}

export function UiProvider({ children }) {
  const isMobile = useMediaQuery(BREAKPOINTS.MOBILE)
  const isTablet = useMediaQuery(BREAKPOINTS.TABLET)

  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [userCollapsed, setUserCollapsed] = useState(readStoredCollapsed)

  /**
   * Effective collapsed state.
   *
   * Tablet forces collapse regardless of preference — at that width an expanded
   * sidebar leaves too little room for content. The user's own choice applies at
   * desktop widths. On mobile the sidebar is a drawer, so "collapsed" is
   * meaningless and always false.
   */
  const isCollapsed = isMobile ? false : isTablet || userCollapsed

  const toggleCollapsed = useCallback(() => {
    setUserCollapsed((previous) => {
      const next = !previous
      try {
        window.localStorage.setItem(STORAGE_KEYS.SIDEBAR_COLLAPSED, String(next))
      } catch {
        // Preference is best-effort; failing to persist is not worth an error.
      }
      return next
    })
  }, [])

  const openDrawer = useCallback(() => setIsDrawerOpen(true), [])
  const closeDrawer = useCallback(() => setIsDrawerOpen(false), [])
  const toggleDrawer = useCallback(() => setIsDrawerOpen((previous) => !previous), [])

  // Leaving mobile while the drawer is open would otherwise leave a stray
  // overlay pinned over the desktop layout.
  useEffect(() => {
    if (!isMobile && isDrawerOpen) setIsDrawerOpen(false)
  }, [isMobile, isDrawerOpen])

  // Escape closes the drawer, which keyboard and screen-reader users expect from
  // any overlay.
  useEffect(() => {
    if (!isDrawerOpen) return undefined

    const onKeyDown = (event) => {
      if (event.key === 'Escape') setIsDrawerOpen(false)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isDrawerOpen])

  // Prevent the page behind the drawer from scrolling while it is open.
  useEffect(() => {
    if (!isDrawerOpen) return undefined

    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = overflow
    }
  }, [isDrawerOpen])

  const value = useMemo(
    () => ({
      isMobile,
      isTablet,
      isCollapsed,
      /** True when the user chose collapse, as opposed to it being forced. */
      isCollapsedByUser: userCollapsed,
      /** Collapse toggling is meaningless on mobile, where a drawer is used. */
      canToggleCollapse: !isMobile && !isTablet,
      toggleCollapsed,
      isDrawerOpen,
      openDrawer,
      closeDrawer,
      toggleDrawer,
    }),
    [
      isMobile,
      isTablet,
      isCollapsed,
      userCollapsed,
      toggleCollapsed,
      isDrawerOpen,
      openDrawer,
      closeDrawer,
      toggleDrawer,
    ],
  )

  return <UiContext.Provider value={value}>{children}</UiContext.Provider>
}

export default UiProvider
