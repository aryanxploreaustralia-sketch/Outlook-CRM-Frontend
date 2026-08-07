/**
 * Reads the layout/chrome UI context.
 *
 * @returns {{
 *   isMobile: boolean,
 *   isTablet: boolean,
 *   isCollapsed: boolean,
 *   isCollapsedByUser: boolean,
 *   canToggleCollapse: boolean,
 *   toggleCollapsed: () => void,
 *   isDrawerOpen: boolean,
 *   openDrawer: () => void,
 *   closeDrawer: () => void,
 *   toggleDrawer: () => void,
 * }}
 */

import { useContext } from 'react'

import { UiContext } from '@/context/uiContext'

export function useUi() {
  const context = useContext(UiContext)

  if (context === null) {
    throw new Error('useUi must be used inside a <UiProvider>.')
  }

  return context
}

export default useUi
