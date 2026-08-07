/**
 * Root layout shell.
 *
 * Renders the persistent chrome (header, footer) around whichever route is
 * active. `<Outlet />` is the slot React Router fills with the matched page.
 */

import { Outlet } from 'react-router-dom'

import { AppFooter } from '@/components/layout/AppFooter'
import { AppHeader } from '@/components/layout/AppHeader'

export function RootLayout() {
  return (
    // `dvh` for the same reason the app shells use it — see DashboardLayout.
    <div className="flex min-h-dvh flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
        <Outlet />
      </main>
      <AppFooter />
    </div>
  )
}

export default RootLayout
