/**
 * Global application header.
 *
 * Navigation is driven by the shared route registry so links and the router can
 * never disagree about what a path is.
 */

import { NavLink } from 'react-router-dom'

import { env } from '@/config/env'
import { NAV_ITEMS } from '@/routes/paths'

function linkClasses({ isActive }) {
  const base = 'rounded-md px-3 py-1.5 text-sm font-medium transition-colors'
  return isActive
    ? `${base} bg-brand-50 text-brand-700`
    : `${base} text-slate-600 hover:bg-slate-100 hover:text-slate-900`
}

export function AppHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-6 px-6 py-3">
        <div className="flex items-center gap-2.5">
          <img
            src="/xplore-logo-mark.png"
            alt=""
            aria-hidden="true"
            className="size-8 rounded-lg bg-white object-contain p-0.5"
          />
          <span className="text-sm font-semibold text-slate-900">{env.appName}</span>
        </div>

        <nav aria-label="Primary">
          <ul className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <li key={item.path}>
                <NavLink to={item.path} className={linkClasses} end={item.end}>
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  )
}

export default AppHeader
