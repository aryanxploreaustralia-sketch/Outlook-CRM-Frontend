/**
 * Dashboard layout — the shell every authenticated page reuses.
 *
 * A page rendered inside this layout supplies only its own content; the sidebar,
 * top bar, footer, responsive behaviour, sign-out handling and skip link all come
 * from here. That is what makes the next module a matter of adding a route and a
 * page component rather than rebuilding chrome.
 *
 * Page titles come from the route registry via `useMatches`, so a page never has
 * to pass its own title up into the layout.
 *
 * Layout order follows the specified structure: top navigation, then sidebar and
 * main content, then footer.
 */

import { useCallback, useState } from 'react'
import { Outlet, useMatches, useNavigate } from 'react-router-dom'

import { DashboardFooter } from '@/components/layout/DashboardFooter'
import { Sidebar } from '@/components/layout/Sidebar'
import { Topbar } from '@/components/layout/Topbar'
import { useAuth } from '@/hooks/useAuth'
import { useUi } from '@/hooks/useUi'
import { PendingSyncNotice } from '@/components/common/PendingSyncNotice'
import { useSyncCoordinator } from '@/offline/sync/useSyncCoordinator.js'
import { ROUTE_PATHS } from '@/routes/paths'

/** Fallback title when a route declares no handle. */
const DEFAULT_TITLE = 'Dashboard'

export function DashboardLayout() {
  const auth = useAuth()
  const ui = useUi()

  /*
   * Offline-first Phase 3 — fill the local cache in the background.
   *
   * Mounted here because this is the shell every authenticated page already
   * renders inside, so it runs once per session rather than once per
   * navigation. It renders nothing, blocks nothing and returns nothing: the
   * layout below is byte-for-byte what it was.
   *
   * Nothing reads that cache yet. Deleting this line removes the feature.
   */
  /*
   * Offline-first Phase 7 — the single synchronisation trigger.
   *
   * This one hook replaced two: hydration used to pull from its own effect and
   * the queue drained from another, with nothing preventing them overlapping.
   * The coordinator serialises push then pull behind one lock, and this is the
   * only place the application starts it.
   *
   * It renders nothing and blocks nothing. Deleting this line removes automatic
   * synchronisation entirely.
   */
  const queue = useSyncCoordinator()
  const navigate = useNavigate()
  const matches = useMatches()
  const [isSigningOut, setIsSigningOut] = useState(false)

  // The deepest matched route that declares a title wins, so a nested route can
  // override its parent.
  const active = [...matches].reverse().find((match) => match.handle?.title)
  const title = active?.handle?.title ?? DEFAULT_TITLE
  const subtitle = active?.handle?.subtitle

  const handleSignOut = useCallback(async () => {
    setIsSigningOut(true)
    try {
      await auth.signOut()
      // Navigate explicitly rather than relying on the route guard to bounce the
      // user: it makes the intent obvious and avoids a flash of the guarded page.
      navigate(ROUTE_PATHS.LOGIN, { replace: true })
    } finally {
      setIsSigningOut(false)
    }
  }, [auth, navigate])

  return (
    /**
     * The app frame. Exactly one viewport tall, and it never scrolls.
     *
     * ## Why this replaced a `min-h-svh` document-scrolled shell
     *
     * The old shell let the *document* scroll and pinned the chrome with
     * `sticky`. Three things went wrong with that, and they compounded:
     *
     *  1. The flex row carried `overflow-x-hidden`. Per CSS overflow rules, a
     *     non-`visible` value on one axis computes the other axis to `auto` —
     *     so that row silently became a scroll container. The `sticky` sidebar
     *     and top bar then resolved against *it* rather than the viewport,
     *     which is why the chrome drifted, and the row grew its own scrollbar
     *     beside the document's. That is the "page scrolling and content
     *     scrolling together" symptom, exactly.
     *  2. `body` was `min-height: 100svh` and the shell was `min-h-svh` on top
     *     of it, with a top bar and a footer added after. The total always
     *     exceeded the viewport, so even an empty page had a document
     *     scrollbar.
     *  3. Nothing bounded the sidebar's own `overflow-y-auto` nav against the
     *     document scroll, so both could be scrollable at once.
     *
     * Locking the frame to `h-dvh overflow-hidden` removes all three at the
     * source: there is now one scroll container in the entire authenticated
     * app — the `<main>` below — and the chrome is fixed because it simply has
     * nowhere to scroll to. No `sticky`, so no ancestor can break it.
     *
     * ## `dvh` rather than `svh` (Phase 16.1D)
     *
     * `svh` is the viewport at its *smallest* — mobile toolbars fully expanded.
     * Once they retract the viewport grows and an `svh` frame leaves a strip of
     * body background below the app, exactly the toolbar's height. `dvh` tracks
     * the live viewport, so the frame stays flush throughout.
     */
    <div className="flex min-h-dvh flex-col bg-slate-50">
      {/* Lets a keyboard user jump past the navigation on every page. */}
      <a href="#main-content" className="sr-only-focusable">
        Skip to main content
      </a>

      {/* No `min-h-0`. It existed to stop this row growing taller than the
          viewport, back when a document scrollbar was the failure being
          prevented. The document scrollbar is now the mechanism. */}
      <div className="flex flex-1">
        <Sidebar
          user={auth.user}
          isCollapsed={ui.isCollapsed}
          isMobile={ui.isMobile}
          isDrawerOpen={ui.isDrawerOpen}
          canToggleCollapse={ui.canToggleCollapse}
          onToggleCollapse={ui.toggleCollapsed}
          onCloseDrawer={ui.closeDrawer}
          onSignOut={handleSignOut}
          isSigningOut={isSigningOut}
        />

        {/* `min-w-0` allows this column to shrink below its content's intrinsic
            width, and is now the *only* thing preventing a wide table widening
            the page - nothing below clips any more. `min-h-0` is gone with the
            inner scroll container it existed to serve. */}
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar
            title={title}
            subtitle={subtitle}
            user={auth.user}
            isMobile={ui.isMobile}
            onOpenDrawer={ui.openDrawer}
            onSignOut={handleSignOut}
            isSigningOut={isSigningOut}
          />

          {/**
           * No longer a scroll container, and carrying no `overflow` at all.
           *
           * This owned the scrollbar: `flex-1` made it exactly as tall as the
           * viewport allowed and `overflow-y-auto` scrolled inside that box. On
           * a short page the box stayed viewport-tall regardless, which is the
           * empty region every page showed below its content — the space was
           * the container, not the page.
           *
           * Dropping `flex-1` is what makes a page's height its content's
           * height. Dropping the overflow is what gives the scroll back to the
           * document.
           *
           * Both `overflow` values had to go together. Keeping
           * `overflow-x-hidden` to go on clipping wide tables would not work:
           * CSS computes an `overflow` of `visible` to `auto` when the other
           * axis is not `visible`, so `overflow-x: hidden` alone silently
           * restores `overflow-y: auto` and this element owns the scrollbar
           * again. Horizontal containment is `min-w-0` on the column above.
           */}
          <main
            id="main-content"
            className="flex flex-col"
          >
            {/*
              `flex-1` removed in Phase 16.1D — this wrapper is the page
              container, not a spacer. Growing it to fill the scroll area pinned
              the footer to the viewport bottom and left a blank region above it
              on any short page. The footer's own `mt-auto` handles that, and
              handles it once.
            */}
            <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
              <PendingSyncNotice
                pending={queue.pending}
                failed={queue.failed}
                conflict={queue.conflict}
                isSyncing={queue.isSyncing}
                onRetry={queue.sync}
                className="mb-4"
              />
              <Outlet />
            </div>

            <DashboardFooter />
          </main>
        </div>
      </div>
    </div>
  )
}

export default DashboardLayout
