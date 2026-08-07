/**
 * Global application footer.
 *
 * Displays the build mode so it is immediately obvious whether a deployed
 * bundle is a development or production build.
 */

import { env } from '@/config/env'

export function AppFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-2 px-6 py-4 text-xs text-slate-500 sm:flex-row">
        <p>&copy; {new Date().getFullYear()} {env.appName}</p>
        <p className="font-mono">
          build: {env.mode} &middot; api: {env.apiBaseUrl}
        </p>
      </div>
    </footer>
  )
}

export default AppFooter
