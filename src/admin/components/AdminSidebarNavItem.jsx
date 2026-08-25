/**
 * One row of the admin sidebar.
 *
 * A separate file rather than a reuse of `@/components/layout/SidebarNavItem`,
 * because that component is typed against `@/config/navigation`'s `NavItem` and
 * is rendered by the sidebar nine live CRM pages depend on. Copying ~40 lines is
 * the cheaper risk than widening a shipped component.
 *
 * ## Every item here navigates
 *
 * The CRM's item carries a "coming soon" branch for roadmap entries with no
 * route. This one has no such branch, because the admin navigation has no such
 * entries — Billing was the only one, and Phase 14.2 removed it entirely. A
 * disabled-item code path that nothing reaches is a code path nobody maintains,
 * and it would only be re-added the day an item genuinely needs it.
 */

import { NavLink } from 'react-router-dom'

/**
 * @param {{
 *   item: import('@/admin/constants/adminNavigation').AdminNavItem,
 *   isCollapsed: boolean,
 *   onNavigate?: () => void,
 * }} props
 */
export function AdminSidebarNavItem({ item, isCollapsed, onNavigate }) {
  const { label, path, icon: Icon, end } = item

  /*
   * Phase 16.1A: a rounded pill at 14px.
   *
   * The extra 36px of column width bought back the room 16.1 had to economise
   * on. `rounded-lg` on a taller row reads as a pill rather than a rectangle,
   * which is the difference between "selected" looking like a state and looking
   * like a button somebody left pressed.
   */
  const base = [
    'group relative flex items-center rounded-lg text-sm font-medium',
    'transition-colors duration-(--duration-fast)',
    isCollapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2.5',
  ].join(' ')

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
            /*
             * Phase 16.1.
             *
             * The active row was a solid brand fill, which is the loudest thing
             * on the screen for a state that is simply "you are here". A tinted
             * surface plus a full-strength label reads as selected without
             * competing with the page beside it — the pattern Linear and Vercel
             * both use, and the reason their sidebars stay quiet.
             */
            isActive
              ? 'bg-sidebar-hover text-sidebar-text-strong'
              : 'text-sidebar-text hover:bg-sidebar-hover/60 hover:text-sidebar-text-strong',
          ].join(' ')
        }
      >
        {({ isActive }) => (
          <>
            {/*
              The rail. A second, non-colour cue for the active row — and now
              the accent's only appearance in the sidebar, so it means one thing.
              It grows from the centre rather than fading, which reads as the
              indicator *moving* between items as you navigate.
            */}
            <span
              className={`absolute left-0 top-1/2 w-[3px] -translate-y-1/2 rounded-r-full bg-brand-500 transition-all duration-(--duration-base) ${
                isActive ? 'h-5 opacity-100' : 'h-0 opacity-0'
              }`}
              aria-hidden="true"
            />
            {/*
              Icons nudge right on hover — 2px, once, at 150ms. Enough to
              acknowledge the pointer without becoming a thing that moves.
            */}
            <Icon
              className={`size-5 shrink-0 transition-[color,transform] duration-(--duration-fast) group-hover:translate-x-0.5 ${
                isActive ? 'text-brand-400' : ''
              }`}
              aria-hidden="true"
            />
            {!isCollapsed && <span className="flex-1 truncate">{label}</span>}
            {isCollapsed && <span className="sr-only">{label}</span>}
          </>
        )}
      </NavLink>
    </li>
  )
}

export default AdminSidebarNavItem
