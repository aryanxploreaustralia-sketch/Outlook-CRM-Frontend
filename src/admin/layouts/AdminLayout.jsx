/**
 * The admin shell.
 *
 * ## The document owns the scroll
 *
 * This frame was locked to `h-dvh overflow-hidden` with `<main>` carrying
 * `overflow-y-auto`, so an inner element owned the scrollbar and the document
 * never moved. That solved a real set of defects — a nested scroll container, a
 * shell taller than the viewport, a nav scrolling alongside the page — but it
 * paid for them with an inner scrollbar on every screen: browser find-in-page
 * scrolled the wrong box, `window.scrollTo` did nothing, and a short page left
 * a tall dead region because the frame was viewport-height regardless of
 * content.
 *
 * The frame is now `min-h-dvh` and nothing between here and the page clips.
 * The document scrolls, as it does everywhere else on the web.
 *
 * What replaces the old guarantees:
 *
 *  - **Nothing widens the page.** `min-w-0` on the content column, which was
 *    always the mechanism — the `overflow-x-hidden` beside it was belt and
 *    braces, and had to go, because `overflow-x: hidden` with a `visible`
 *    `overflow-y` computes that `y` to `auto` and silently rebuilds the very
 *    scroll container this removed.
 *  - **The chrome stays put.** The sidebar and topbar are `sticky`, which is
 *    how an element stays visible in a document that scrolls. They were merely
 *    outside the scrolling box before.
 *
 * `DashboardLayout` still uses the locked-frame geometry. The two have
 * deliberately diverged; this comment is the record of why.
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
    <div className="flex min-h-dvh flex-col bg-slate-50">
      <a href="#admin-main" className="sr-only-focusable">
        Skip to main content
      </a>

      {/* No `min-h-0` any more. It existed to stop this row growing past the
          viewport, back when the document was forbidden to scroll — handing the
          document a scrollbar was the failure. Now it is the goal. */}
      <div className="flex flex-1">
        <AdminSidebar
          user={auth.user}
          isCollapsed={ui.isCollapsed}
          isMobile={ui.isMobile}
          isDrawerOpen={ui.isDrawerOpen}
          canToggleCollapse={ui.canToggleCollapse}
          onToggleCollapse={ui.toggleCollapsed}
          onCloseDrawer={ui.closeDrawer}
        />

        {/* `min-w-0` stays, and is now the *only* thing keeping a wide table
            from widening the page: nothing below clips any more. It lets this
            column shrink below its content's intrinsic width, so a 46rem table
            scrolls inside its own container instead of stretching the shell. */}
        <div className="flex min-w-0 flex-1 flex-col">
          <AdminTopbar
            title={title}
            subtitle={subtitle}
            user={auth.user}
            isMobile={ui.isMobile}
            onOpenDrawer={ui.openDrawer}
            onSignOut={handleSignOut}
            isSigningOut={isSigningOut}
          />

          {/*
            No longer a scroll container, and deliberately carrying no
            `overflow` at all.

            The obvious half-measure — drop `overflow-y-auto` but keep
            `overflow-x-hidden` to go on clipping wide tables — does not work.
            CSS computes an `overflow` of `visible` to `auto` when the other
            axis is not `visible`, so `overflow-x: hidden` alone would quietly
            reinstate `overflow-y: auto` and this element would still own the
            scrollbar. Horizontal containment is `min-w-0` on the column above.
          */}
          <main
            id="admin-main"
            /*
             * `tabIndex={-1}` for the skip link, and only for that now.
             *
             * It used to do a second job: arrow keys and Page Up/Down scroll the
             * focused scrollable element, and with the document locked the
             * keyboard could only reach the scroll container by focusing it.
             * The document scrolls again, so the keyboard works from `body`
             * without help — but the skip link still needs a focusable target,
             * or Tab after "skip to main content" returns to the navigation the
             * reader just skipped.
             */
            tabIndex={-1}
            /*
             * No `focus:outline-none` here. The global `:focus-visible` ring is
             * what confirms the skip link worked — suppressing it would send
             * focus somewhere invisible, which is the failure the skip link
             * exists to prevent.
             */
            /*
             * No `flex-1`, and that is the whole of Phase 16.1D's lesson
             * carried across.
             *
             * `DashboardFooter` positions itself with `mt-auto`. Give this
             * element `flex-1` and it stretches to the full column height, so
             * `mt-auto` finds free space and pins the footer to the bottom of
             * the viewport — putting a tall blank region between the end of a
             * short page and a full-width footer bar. That is exactly the
             * "large white area below the application" that was reported and
             * fixed once already.
             *
             * Sized to its content instead: the page ends where its content
             * ends, and the column's own background fills whatever is left.
             */
            className="flex flex-col"
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
