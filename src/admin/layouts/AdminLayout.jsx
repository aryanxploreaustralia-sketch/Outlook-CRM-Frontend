/**
 * The admin shell.
 *
 * Structurally the same frame as `DashboardLayout`, and identical for a reason
 * rather than by copy-paste habit. That layout's comments document three
 * compounding scroll defects it was rebuilt to fix — a nested scroll container
 * created by `overflow-x-hidden`, a shell taller than the viewport, and a
 * sidebar nav that could scroll alongside the document. The fix was to lock the
 * frame to `h-dvh overflow-hidden` so the whole authenticated app has exactly
 * one scroll container.
 *
 * Any divergence here would reintroduce those bugs on eleven new pages, so the
 * geometry is deliberately the same: locked frame, `min-h-0` on the flex
 * children, one `<main>` that scrolls.
 *
 * ## Reuse
 *
 * `useAuth`, `useUi`, `ProtectedRoute` (applied by the router) and `UserMenu`
 * are the CRM's, unmodified. This layout adds no auth logic of its own: signing
 * in is the same act for the admin surface as for the CRM, and a second opinion
 * about who is signed in is how two answers to that question come to exist.
 *
 * ## Authorization (Phase 14.4)
 *
 * The shell mounts `PermissionProvider` and then gates on `adminAccess` — does
 * this account hold *any* admin-surface permission? A user with none never sees
 * the console at all, rather than landing in a shell of pages that each refuse
 * them individually.
 *
 * The provider is mounted here rather than at the application root because the
 * CRM does not consult permissions yet, and every CRM user would otherwise pay
 * for a request nothing reads.
 *
 * None of this is the security boundary. Every screen inside loads from an
 * endpoint that enforces the same permission server-side and answers 403.
 */

import { useCallback, useState } from 'react'
import { Outlet, useMatches, useNavigate } from 'react-router-dom'

import { AdminSidebar } from '@/admin/components/AdminSidebar'
import { AdminTopbar } from '@/admin/components/AdminTopbar'
import { PermissionProvider } from '@/admin/context/PermissionProvider'
import { usePermissions } from '@/admin/hooks/usePermissions'
import { AdminErrorState } from '@/admin/components/AdminErrorState'
import { AdminNoAccess } from '@/admin/components/AdminNoAccess'
import { LoadingScreen } from '@/components/common/LoadingScreen'
import { DashboardFooter } from '@/components/layout/DashboardFooter'
import { useAuth } from '@/hooks/useAuth'
import { useUi } from '@/hooks/useUi'
import { ROUTE_PATHS } from '@/routes/paths'

/** Fallback when a route declares no handle. */
const DEFAULT_TITLE = 'Administration'

/**
 * The shell proper. Split out so it can call `usePermissions()`, which is only
 * available beneath the provider that `AdminLayout` mounts.
 */
function AdminShell() {
  const auth = useAuth()
  const ui = useUi()
  const navigate = useNavigate()
  const matches = useMatches()
  const [isSigningOut, setIsSigningOut] = useState(false)

  const permissions = usePermissions()

  // Deepest matching route wins, so a nested route can override its parent —
  // the same rule `DashboardLayout` uses.
  const active = [...matches].reverse().find((match) => match.handle?.title)
  const title = active?.handle?.title ?? DEFAULT_TITLE
  const subtitle = active?.handle?.subtitle

  const handleSignOut = useCallback(async () => {
    setIsSigningOut(true)
    try {
      await auth.signOut()
      // Navigated explicitly rather than left to the route guard, so there is no
      // flash of the guarded page on the way out.
      navigate(ROUTE_PATHS.LOGIN, { replace: true })
    } finally {
      setIsSigningOut(false)
    }
  }, [auth, navigate])

  // --- Console-level gate --------------------------------------------------
  // Ordered like `ProtectedRoute`'s: never decide before the answer has arrived.
  if (!permissions.isReady) {
    return <LoadingScreen fullScreen message="Checking your access" detail="One moment." />
  }

  if (permissions.error) {
    // Could not read the grants. Distinct from being refused — telling somebody
    // they lack access because the server blinked sends them asking for a grant
    // they already hold.
    return (
      <div className="grid min-h-dvh place-items-center bg-slate-50 px-6">
        <AdminErrorState error={permissions.error} onRetry={permissions.refresh} />
      </div>
    )
  }

  if (!permissions.adminAccess) {
    return <AdminNoAccess roleLabel={permissions.roleLabel} onSignOut={handleSignOut} />
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-slate-50">
      <a href="#admin-main" className="sr-only-focusable">
        Skip to main content
      </a>

      {/* `min-h-0` is load-bearing: a flex child defaults to `min-height:auto`
          and refuses to shrink below its content, which would push the frame
          past the viewport and hand the document a scrollbar. */}
      <div className="flex min-h-0 flex-1">
        <AdminSidebar
          user={auth.user}
          isCollapsed={ui.isCollapsed}
          isMobile={ui.isMobile}
          isDrawerOpen={ui.isDrawerOpen}
          canToggleCollapse={ui.canToggleCollapse}
          onToggleCollapse={ui.toggleCollapsed}
          onCloseDrawer={ui.closeDrawer}
        />

        {/* `min-w-0` lets this column shrink below its content's intrinsic
            width, which is what actually keeps a wide table from widening the
            page — and is why no `overflow-x-hidden` is needed at this level. */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <AdminTopbar
            title={title}
            subtitle={subtitle}
            user={auth.user}
            isMobile={ui.isMobile}
            onOpenDrawer={ui.openDrawer}
            onSignOut={handleSignOut}
            isSigningOut={isSigningOut}
          />

          {/* The one scroll container. `overflow-x-hidden` clips a wide child
              *here*, at the scroll container, rather than letting it widen the
              page — tables own their horizontal scroll internally. */}
          <main
            id="admin-main"
            /*
             * `tabIndex={-1}` makes this focusable without adding it to the tab
             * order, which does two things.
             *
             * The skip link at the top targets `#admin-main`; without a tabindex
             * the browser scrolls to the anchor but leaves focus on the link, so
             * the next Tab returns to the navigation the user just skipped.
             *
             * And it is what makes keyboard scrolling work. Arrow keys, Page
             * Up/Down, Home and End scroll the *focused* scrollable element —
             * with focus on `body` they try to scroll the document, which is
             * locked at `h-dvh overflow-hidden` and does not move. Focusing the
             * real scroll container is what connects the keyboard to it.
             *
             * This matters more now that the scrollbar is hidden: the keyboard
             * path can no longer be replaced by dragging a bar.
             */
            tabIndex={-1}
            /*
             * No `focus:outline-none` here. The global `:focus-visible` ring is
             * what confirms the skip link worked — suppressing it would send
             * focus somewhere invisible, which is the failure the skip link
             * exists to prevent.
             */
            className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden"
          >
            {/*
              No `flex-1` filler here (Phase 16.1D).

              It used to wrap the outlet and grow to fill the scroll container,
              which pinned the footer to the bottom of the viewport. On a short
              page — Organization, System Health, an empty table — that produced
              a tall blank region between the content and a full-width white
              footer bar, read as "a large white area below the application".

              Two mechanisms were doing one job: this `flex-1` *and* the
              footer's own `mt-auto`. Removing the wrapper leaves one, and the
              page now ends where its content ends.
            */}
            <Outlet />

            <DashboardFooter />
          </main>
        </div>
      </div>
    </div>
  )
}

/**
 * The exported shell.
 *
 * A thin wrapper whose only job is to establish the permission context that
 * `AdminShell` and every screen beneath it read.
 */
export function AdminLayout() {
  return (
    <PermissionProvider>
      <AdminShell />
    </PermissionProvider>
  )
}

export default AdminLayout
