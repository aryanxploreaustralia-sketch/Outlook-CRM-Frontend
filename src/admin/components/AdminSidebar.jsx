/**
 * Admin navigation column.
 *
 * Structurally identical to the CRM sidebar — one component covering desktop,
 * tablet and drawer modes, differing only in positioning classes — because
 * forking those three into separate components is how they drift apart.
 *
 * ## The one visual difference, and why it exists
 *
 * The head of the column is a **workspace block** — organization mark, name and
 * an `Admin` mode line — and a permanent "Back to CRM" row sits at the foot.
 *
 * (Until Phase 16.1A this was a violet `Ad` chip. The chip identified the mode
 * but not the workspace, which is only half the question.)
 *
 * Administration screens act across every user's data. An operator who cannot
 * tell at a glance which context they are in is an operator who will eventually
 * take an admin action believing they are in their own workspace. The colour
 * shift is the cheapest possible always-visible answer to "where am I", and the
 * exit route means leaving is never a guess about which browser control to use.
 *
 * Everything else — surface tokens, spacing, collapse behaviour, focus rings —
 * is the CRM's, so the two read as one product.
 */

import { ChevronLeft, ChevronRight, LayoutGrid, X } from 'lucide-react'
import { Link } from 'react-router-dom'

import { AdminSidebarNavItem } from '@/admin/components/AdminSidebarNavItem'
import { ADMIN_NAV_SECTIONS } from '@/admin/constants/adminNavigation'
import { usePermissions } from '@/admin/hooks/usePermissions'
import { ADMIN_PATHS } from '@/admin/routes/adminPaths'
import { UserAvatar } from '@/components/common/UserAvatar'
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
 * }} props
 */
export function AdminSidebar({
  user,
  isCollapsed,
  isMobile,
  isDrawerOpen,
  canToggleCollapse,
  onToggleCollapse,
  onCloseDrawer,
}) {
  const { can } = usePermissions()

  /**
   * Navigation, filtered to what this account may actually open.
   *
   * Items are **removed, not disabled**. An unauthorized user should not learn
   * that a page exists — a greyed-out "Audit logs" entry tells somebody exactly
   * what the role above theirs can see and invites them to ask for it.
   *
   * Sections whose items all disappear are dropped too, so a heading can never
   * stand above nothing. `ADMIN_NAV_SECTIONS` already applies that rule at
   * build time; this applies the same rule per user.
   */
  const sections = ADMIN_NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => !item.permission || can(item.permission)),
  })).filter((section) => section.items.length > 0)

  const width = isCollapsed ? 'w-(--spacing-sidebar-collapsed)' : 'w-(--spacing-sidebar)'

  /** Tapping a link inside the drawer should dismiss it. */
  const handleNavigate = isMobile ? onCloseDrawer : undefined

  return (
    <>
      {isMobile && isDrawerOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/60 backdrop-blur-sm md:hidden"
          onClick={onCloseDrawer}
          aria-hidden="true"
        />
      )}

      <aside
        id="admin-sidebar"
        aria-label="Administration navigation"
        // Keeps off-screen drawer links out of the tab order.
        aria-hidden={isMobile && !isDrawerOpen ? 'true' : undefined}
        className={[
          'sidebar-surface flex flex-col bg-sidebar-bg',
          'border-r border-sidebar-border',
          isMobile
            ? `fixed inset-y-0 left-0 z-40 w-(--spacing-sidebar) transition-transform duration-300 ease-out ${
                isDrawerOpen ? 'translate-x-0' : '-translate-x-full'
              }`
            : `sticky top-0 h-dvh shrink-0 transition-[width] duration-200 ease-out ${width}`,
        ].join(' ')}
      >
        {/* --- Workspace ----------------------------------------------------- */}
        <div
          className={`flex h-(--spacing-topbar) shrink-0 items-center border-b border-sidebar-border ${
            isCollapsed ? 'justify-center px-2' : 'gap-2.5 px-4'
          }`}
        >
          {/*
            Phase 16.1A: a workspace block, not a wordmark.

            The mark carries the organization's initial; the two lines name the
            workspace and the mode. So the column answers "whose CRM is this,
            and am I in admin?" before anything else on the screen is read —
            which is what the Microsoft 365 and Teams rails both do first.
          */}
          <Link
            to={ADMIN_PATHS.DASHBOARD}
            onClick={handleNavigate}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-[--radius-control]"
          >
            <img
              src="/xplore-logo-mark.svg"
              alt=""
              aria-hidden="true"
              className="size-9 shrink-0 rounded-[--radius-control] bg-white object-contain p-0.5 shadow-card"
            />
            {!isCollapsed && (
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold leading-tight text-sidebar-text-strong">
                  Xplore Australia
                </span>
                <span className="mt-0.5 flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
                  <span className="truncate text-[11px] font-medium uppercase tracking-[0.06em] text-sidebar-text/70">
                    Admin
                  </span>
                </span>
              </span>
            )}
            <span className="sr-only">
              Xplore Australia, administration — go to the admin dashboard
            </span>
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
        {/* `min-h-0` lets this scroll internally rather than stretching the
            column past the locked app frame. */}
        <nav
          className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-4"
          aria-label="Administration sections"
        >
          {sections.map((section, sectionIndex) => (
            <div key={section.id} className={sectionIndex > 0 ? 'mt-5' : ''}>
              {section.label && !isCollapsed && (
                <h2 className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.09em] text-sidebar-text/45">
                  {section.label}
                </h2>
              )}
              {/* Collapsed mode drops the label but keeps the grouping visible. */}
              {section.label && isCollapsed && (
                <div className="mx-2 mb-2 border-t border-sidebar-border" aria-hidden="true" />
              )}

              <ul className="space-y-0.5">
                {section.items.map((item) => (
                  <AdminSidebarNavItem
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

        {/* --- Context + exit ------------------------------------------------ */}
        <div className="shrink-0 border-t border-sidebar-border p-3">
          {user && (
            <div
              className={`mb-1.5 flex items-center rounded-[--radius-control] bg-sidebar-bg-elevated py-2.5 ${
                isCollapsed ? 'justify-center px-0' : 'gap-3 px-3'
              }`}
            >
              {/* The presence dot sits on the avatar, as it does in Teams — a
                  live session is exactly what it reports. */}
              <span className="relative shrink-0">
                <UserAvatar
                  name={user.displayName}
                  email={user.email}
                  initials={user.initials}
                  size={isCollapsed ? 'sm' : 'md'}
                />
                <span
                  className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-sidebar-bg-elevated bg-emerald-400"
                  aria-hidden="true"
                />
              </span>

              {!isCollapsed && (
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.8125rem] font-semibold leading-tight text-sidebar-text-strong">
                    {user.displayName ?? 'Signed in'}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-sidebar-text">
                    {user.email ?? '—'}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* The way out. Deliberately a link to the CRM dashboard rather than a
              history-based "back": an operator may have arrived here by typing
              the URL, in which case there is no back to go to. */}
          <Link
            to={ROUTE_PATHS.DASHBOARD}
            onClick={handleNavigate}
            title={isCollapsed ? 'Back to CRM' : undefined}
            className={`flex w-full items-center rounded-[--radius-control] text-[0.8125rem] font-medium text-sidebar-text ring-1 ring-inset ring-sidebar-border transition-colors duration-[--duration-fast] hover:bg-sidebar-hover hover:text-sidebar-text-strong hover:ring-sidebar-hover ${
              isCollapsed ? 'justify-center px-0 py-2.5' : 'gap-2.5 px-3 py-2.5'
            }`}
          >
            <LayoutGrid className="size-[1.125rem] shrink-0" aria-hidden="true" />
            {!isCollapsed && <span>Back to CRM</span>}
            {isCollapsed && <span className="sr-only">Back to CRM</span>}
          </Link>

          {canToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-expanded={!isCollapsed}
              aria-controls="admin-sidebar"
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

export default AdminSidebar
