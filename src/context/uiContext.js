/**
 * Layout/chrome UI context.
 *
 * Holds the sidebar's collapsed state and the mobile drawer's open state. These
 * live in context because the Topbar's menu button and the Sidebar itself are in
 * different branches of the tree — passing the state down would mean threading it
 * through `DashboardLayout` and every page, which is exactly the prop drilling
 * this avoids.
 *
 * Separate module from the provider so Fast Refresh keeps working: a file that
 * exports both a component and a non-component loses state preservation.
 */

import { createContext } from 'react'

export const UiContext = createContext(null)

export default UiContext
