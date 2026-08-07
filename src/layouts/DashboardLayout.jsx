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
import { ROUTE_PATHS } from '@/routes/paths'

/** Fallback title when a route declares no handle. */
const DEFAULT_TITLE = 'Dashboard'

export function DashboardLayout() {
  const auth = useAuth()
  const ui = useUi()
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
    <div className="flex h-dvh flex-col overflow-hidden bg-slate-50">
      {/* Lets a keyboard user jump past the navigation on every page. */}
      <a href="#main-content" className="sr-only-focusable">
        Skip to main content
      </a>

      {/* `min-h-0` is load-bearing: a flex child defaults to `min-height:auto`,
          which refuses to shrink below its content and would push the frame
          taller than the viewport, reintroducing the document scrollbar. */}
      <div className="flex min-h-0 flex-1">
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
            width, which is what actually prevents the flex row overflowing and
            is why no `overflow-x-hidden` is needed here. `min-h-0` does the
            same for the vertical axis so `<main>` can own the scrolling. */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
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
           * The one and only scroll container in the authenticated app.
           *
           * `overflow-y-auto` gives a scrollbar only when content actually
           * overflows, so short pages show none at all. `overflow-x-hidden`
           * clips a wide child here — at the scroll container — rather than
           * letting it widen the page, which is what kept horizontal scroll
           * out before, now applied somewhere it cannot break `sticky`.
           *
           * The footer sits inside it so it trails the content instead of
           * permanently occupying viewport height that pages need.
           */}
          <main
            id="main-content"
            className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden"
          >
            {/*
              `flex-1` removed in Phase 16.1D — this wrapper is the page
              container, not a spacer. Growing it to fill the scroll area pinned
              the footer to the viewport bottom and left a blank region above it
              on any short page. The footer's own `mt-auto` handles that, and
              handles it once.
            */}
            <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
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
