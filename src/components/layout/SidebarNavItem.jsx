/**
 * A single sidebar navigation row.
 *
 * Handles three states from one declaration: active, inactive, and disabled.
 *
 * Disabled items render as `<span aria-disabled>` rather than a `<NavLink>` or a
 * `<button disabled>`. A disabled `<button>` is removed from the tab order
 * entirely, which hides the product roadmap from keyboard and screen-reader users
 * — they should be able to discover these items too, just not activate them.
 */

import { NavLink } from 'react-router-dom'

/**
 * @param {{
 *   item: import('@/config/navigation').NavItem,
 *   isCollapsed: boolean,
 *   onNavigate?: () => void,
 * }} props
 */
export function SidebarNavItem({ item, isCollapsed, onNavigate }) {
  const { label, path, icon: Icon, enabled, end, badge, description } = item

  const base = [
    'group relative flex items-center rounded-lg text-sm font-medium transition-colors duration-150',
    isCollapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2.5',
  ].join(' ')

  // --- Disabled ------------------------------------------------------------
  if (!enabled || !path) {
    return (
      <li>
        <span
          aria-disabled="true"
          title={description ?? `${label} — coming soon`}
          className={`${base} cursor-not-allowed text-sidebar-text/45`}
        >
          <Icon className="size-5 shrink-0" aria-hidden="true" />

          {!isCollapsed && (
            <>
              <span className="flex-1 truncate">{label}</span>
              {badge && (
                <span className="shrink-0 rounded-md bg-sidebar-bg-elevated px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sidebar-text/70">
                  {badge}
                </span>
              )}
            </>
          )}

          {/* Collapsed mode has no visible label, so the name is announced here. */}
          {isCollapsed && <span className="sr-only">{label} — coming soon</span>}
        </span>
      </li>
    )
  }

  // --- Enabled -------------------------------------------------------------
  return (
    <li>
      <NavLink
        to={path}
        end={end}
        onClick={onNavigate}
        title={isCollapsed ? label : undefined}
        className={({ isActive }) =>
          [
            base,
            isActive
              ? 'bg-brand-600/90 text-white shadow-card'
              : 'text-sidebar-text hover:bg-sidebar-hover hover:text-sidebar-text-strong',
          ].join(' ')
        }
      >
        {({ isActive }) => (
          <>
            {/* Active indicator rail: a second, non-colour cue for the active row. */}
            <span
              className={`absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-r-full bg-white transition-opacity ${
                isActive ? 'opacity-100' : 'opacity-0'
              }`}
              aria-hidden="true"
            />
            <Icon className="size-5 shrink-0" aria-hidden="true" />
            {!isCollapsed && <span className="flex-1 truncate">{label}</span>}
            {isCollapsed && <span className="sr-only">{label}</span>}
          </>
        )}
      </NavLink>
    </li>
  )
}

export default SidebarNavItem
