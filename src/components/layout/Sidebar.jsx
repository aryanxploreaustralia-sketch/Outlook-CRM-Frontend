/**
 * Application sidebar.
 *
 * One component serves all three responsive modes, because forking into separate
 * desktop and mobile sidebars is how the two drift out of sync:
 *
 *  - **desktop** — a static column, expanded or collapsed to icons;
 *  - **tablet**  — the same column, forced to icon width;
 *  - **mobile**  — the same markup as an overlay drawer.
 *
 * Only the positioning classes and the surrounding overlay differ.
 */

import { ChevronLeft, ChevronRight, LogOut, ShieldCheck, X } from 'lucide-react'
import { Link } from 'react-router-dom'

import { ADMIN_PATHS } from '@/admin/routes/adminPaths'
import { UserAvatar } from '@/components/common/UserAvatar'
import { SidebarNavItem } from '@/components/layout/SidebarNavItem'
import { NAV_SECTIONS } from '@/config/navigation'
import { env } from '@/config/env'
import { useAdminAccess } from '@/hooks/useAdminAccess'
import { ROUTE_PATHS } from '@/routes/paths'

/**
 * @param {{
 *   user?: ?object,
 *   isCollapsed: boolean,
 *   isMobile: boolean,
 *   isDrawerOpen: boolean,
 *   canToggleCollapse: boolean,
 *   onToggleCollapse: () => void,
 *   onCloseDrawer: () => void,
 *   onSignOut: () => void,
 *   isSigningOut?: boolean,
 * }} props
 */
export function Sidebar({
  user,
  isCollapsed,
  isMobile,
  isDrawerOpen,
  canToggleCollapse,
  onToggleCollapse,
  onCloseDrawer,
  onSignOut,
  isSigningOut = false,
}) {
  /**
   * Whether to offer the way through to the admin console.
   *
   * Read here rather than passed down, so `DashboardLayout` does not have to
   * thread a prop it has no other use for. One `<Sidebar>` is mounted — it
   * renders the desktop, tablet and drawer presentations from the same
   * instance — so this is one request per CRM session, not one per mode.
   */
  const { hasAdminAccess } = useAdminAccess()

  const width = isCollapsed ? 'w-(--spacing-sidebar-collapsed)' : 'w-(--spacing-sidebar)'

  /** Tapping a link inside the drawer should dismiss it. */
  const handleNavigate = isMobile ? onCloseDrawer : undefined

  return (
    <>
      {/* Scrim. Click-to-dismiss is a convenience; Escape is the accessible path,
          handled centrally in UiProvider. */}
      {isMobile && isDrawerOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/60 backdrop-blur-sm md:hidden"
          onClick={onCloseDrawer}
          aria-hidden="true"
        />
      )}

      <aside
        id="app-sidebar"
        aria-label="Main navigation"
        // `aria-hidden` when the drawer is shut keeps its links out of the tab
        // order, so a keyboard user cannot tab into an off-screen panel.
        aria-hidden={isMobile && !isDrawerOpen ? 'true' : undefined}
        className={[
          'sidebar-surface flex flex-col bg-sidebar-bg',
          'border-r border-sidebar-border',
          isMobile
            ? `fixed inset-y-0 left-0 z-40 w-(--spacing-sidebar) transition-transform duration-300 ease-out ${
                isDrawerOpen ? 'translate-x-0' : '-translate-x-full'
              }`
            : // `h-full` inside the locked app frame, not `sticky top-0 h-svh`.
              // The frame no longer scrolls, so the column is fixed by
              // construction — and dropping `sticky` means no ancestor's
              // overflow can silently reposition it. `h-svh` was also wrong
              // here: it ignored the frame and could exceed it by a hair,
              // which is what let the nav and the document both scroll.
              `sticky top-0 h-dvh shrink-0 transition-[width] duration-200 ease-out ${width}`,
        ].join(' ')}
      >
        {/* --- Logo area ----------------------------------------------------- */}
        <div
          className={`flex h-(--spacing-topbar) shrink-0 items-center border-b border-sidebar-border ${
            isCollapsed ? 'justify-center px-2' : 'gap-2.5 px-4'
          }`}
        >
          <Link
            to={ROUTE_PATHS.DASHBOARD}
            onClick={handleNavigate}
            className="flex min-w-0 items-center gap-2.5 rounded-md"
          >
            <span
              className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-600 text-sm font-bold text-white"
              aria-hidden="true"
            >
              OA
            </span>
            {!isCollapsed && (
              <span className="truncate text-sm font-semibold text-sidebar-text-strong">
                {env.appName}
              </span>
            )}
            <span className="sr-only">{env.appName} — go to dashboard</span>
          </Link>

          {isMobile && (
            <button
              type="button"
              onClick={onCloseDrawer}
              className="ml-auto rounded-md p-1.5 text-sidebar-text transition-colors hover:bg-sidebar-hover hover:text-sidebar-text-strong"
              aria-label="Close navigation menu"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          )}
        </div>

        {/* --- Navigation ---------------------------------------------------- */}
        {/* `min-h-0` lets this shrink below its content so the nav scrolls
            internally instead of stretching the sidebar past the frame. */}
        <nav
          className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 py-4"
          aria-label="Sections"
        >
          {NAV_SECTIONS.map((section, sectionIndex) => (
            <div key={section.id} className={sectionIndex > 0 ? 'mt-6' : ''}>
              {section.label && !isCollapsed && (
                <h2 className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-sidebar-text/50">
                  {section.label}
                </h2>
              )}
              {/* Collapsed mode hides the heading text but keeps a divider, so
                  the grouping is still visible without a label. */}
              {section.label && isCollapsed && (
                <div className="mx-2 mb-2 border-t border-sidebar-border" aria-hidden="true" />
              )}

              <ul className="space-y-1">
                {section.items.map((item) => (
                  <SidebarNavItem
                    key={item.id}
                    item={item}
                    isCollapsed={isCollapsed}
                    onNavigate={handleNavigate}
                  />
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {/* --- Current user + sign out --------------------------------------- */}
        <div className="shrink-0 border-t border-sidebar-border p-2">
          {user && (
            <div
              className={`mb-1 flex items-center rounded-lg py-2 ${
                isCollapsed ? 'justify-center px-0' : 'gap-3 px-2'
              }`}
            >
              <UserAvatar
                name={user.displayName}
                email={user.email}
                initials={user.initials}
                size={isCollapsed ? 'sm' : 'md'}
              />
              {!isCollapsed && (
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-sidebar-text-strong">
                    {user.displayName ?? 'Signed in'}
                  </p>
                  <p className="truncate text-xs text-sidebar-text">{user.email ?? '—'}</p>
                </div>
              )}
            </div>
          )}

          {/* --- The way in to the admin console ---------------------------
              The mirror of the console's own "Back to CRM" row, in the same
              position at the foot of the sidebar and following the same
              collapsed pattern: icon only, with the label moved to `title` and
              a screen-reader span.

              Shown only to an account the server says holds admin access. This
              is presentation, not protection — `AdminLayout` gates on the same
              flag and every admin endpoint enforces its own permission. */}
          {hasAdminAccess && (
            <Link
              to={ADMIN_PATHS.ROOT}
              onClick={handleNavigate}
              title={isCollapsed ? 'Admin Panel' : undefined}
              className={`mb-1 flex w-full items-center rounded-lg text-sm font-medium text-sidebar-text transition-colors hover:bg-sidebar-hover hover:text-sidebar-text-strong ${
                isCollapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2.5'
              }`}
            >
              <ShieldCheck className="size-5 shrink-0" aria-hidden="true" />
              {!isCollapsed && <span>Admin Panel</span>}
              {isCollapsed && <span className="sr-only">Admin Panel</span>}
            </Link>
          )}

          <button
            type="button"
            onClick={onSignOut}
            disabled={isSigningOut}
            title={isCollapsed ? 'Sign out' : undefined}
            className={`flex w-full items-center rounded-lg text-sm font-medium text-sidebar-text transition-colors hover:bg-red-500/10 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-60 ${
              isCollapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2.5'
            }`}
          >
            <LogOut className="size-5 shrink-0" aria-hidden="true" />
            {!isCollapsed && <span>{isSigningOut ? 'Signing out…' : 'Logout'}</span>}
            {isCollapsed && <span className="sr-only">Logout</span>}
          </button>

          {/* Collapse control is hidden where collapsing is not the user's
              choice — mobile uses a drawer, tablet is forced to icons. */}
          {canToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-expanded={!isCollapsed}
              aria-controls="app-sidebar"
              className={`mt-1 flex w-full items-center rounded-lg py-2 text-xs font-medium text-sidebar-text/70 transition-colors hover:bg-sidebar-hover hover:text-sidebar-text-strong ${
                isCollapsed ? 'justify-center px-0' : 'gap-3 px-3'
              }`}
            >
              {isCollapsed ? (
                <ChevronRight className="size-4 shrink-0" aria-hidden="true" />
              ) : (
                <ChevronLeft className="size-4 shrink-0" aria-hidden="true" />
              )}
              {!isCollapsed && <span>Collapse sidebar</span>}
              {isCollapsed && <span className="sr-only">Expand sidebar</span>}
            </button>
          )}
        </div>
      </aside>
    </>
  )
}

export default Sidebar
