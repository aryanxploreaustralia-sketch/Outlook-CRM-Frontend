/**
 * Admin top bar.
 *
 * Fixed chrome by construction: a non-shrinking flex child of a frame that does
 * not scroll. No `sticky`, so no ancestor's overflow can reposition it — the
 * failure the CRM shell documents at length and paid for once already.
 *
 * `UserMenu` is imported from the CRM chrome unchanged. It is a shared,
 * self-contained control that takes a user and a sign-out callback and needs
 * nothing from either shell, so reusing it is free and forking it would only
 * create a second dropdown to keep accessible.
 */

import { useCallback, useState } from 'react'
import { Menu, Search, ShieldCheck } from 'lucide-react'

import { GlobalSearch } from '@/components/search/GlobalSearch'
import { useSearchHotkey } from '@/hooks/useSearchHotkey'
import { NotificationBell } from '@/components/layout/NotificationBell'
import { UserMenu } from '@/components/layout/UserMenu'
import { Button } from '@/components/ui/Button'

/**
 * @param {{
 *   title?: string,
 *   subtitle?: string,
 *   user?: ?object,
 *   isMobile: boolean,
 *   onOpenDrawer: () => void,
 *   onSignOut: () => void,
 *   isSigningOut?: boolean,
 * }} props
 */
export function AdminTopbar({
  title = 'Administration',
  subtitle,
  user,
  isMobile,
  onOpenDrawer,
  onSignOut,
  isSigningOut = false,
}) {
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const openSearch = useCallback(() => setIsSearchOpen(true), [])

  // Disabled while open, so the shortcut cannot re-trigger and pull focus back
  // out of the palette.
  useSearchHotkey(openSearch, !isSearchOpen)

  return (
    /*
     * `sticky`, and now genuinely load-bearing.
     *
     * This was deliberately *not* sticky for two phases, and the reasoning was
     * right at the time: the shell was locked to `h-dvh overflow-hidden` with
     * `<main>` as the only scroll container, so the bar had nowhere to scroll
     * to and `sticky` was inert at best.
     *
     * The shell now lets the document scroll, so this bar would scroll away
     * with the page. `sticky top-0` is what keeps it where it has always
     * appeared to be. There is no scroll-container ancestor left for it to
     * resolve against unexpectedly — that was the hazard, and removing the
     * inner container removed it.
     */
    <header className="sticky top-0 z-20 shrink-0 border-b border-slate-200 bg-white/80 backdrop-blur-md">
      <div className="flex h-(--spacing-topbar) items-center gap-3 px-4 sm:gap-3 sm:px-6">
        {isMobile && (
          <button
            type="button"
            onClick={onOpenDrawer}
            aria-label="Open navigation menu"
            aria-controls="admin-sidebar"
            className="-ml-1 rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            <Menu className="size-5" aria-hidden="true" />
          </button>
        )}

        {/*
          The bar names the *context*; the page header below names the subject.
          Two titles at the same weight would compete, so this one is quieter
          and the page's `h1` carries the hierarchy — the split Stripe and
          Vercel both use.

          `min-w-0` stops a long title widening the bar past the viewport.
        */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.8125rem] font-semibold text-slate-800">{title}</p>
          {subtitle && <p className="truncate text-[11px] text-slate-500">{subtitle}</p>}
        </div>

        {/*
          Phase 16.1A: search and notifications reach the admin chrome.

          Both already existed in the CRM bar and were simply absent here, so an
          operator in the console had to leave it to search or to read a
          notification. Same components, so there is one search and one bell in
          the product rather than two implementations.
        */}
        <button
          type="button"
          onClick={() => setIsSearchOpen(true)}
          className="hidden items-center gap-2 rounded-(--radius-control) border border-slate-200 bg-slate-50/80 px-2.5 py-1.5 text-sm text-slate-400 transition-colors duration-(--duration-fast) hover:border-slate-300 hover:bg-white md:flex lg:w-64"
          aria-label="Search"
          aria-keyshortcuts="Control+K"
        >
          <Search className="size-4 shrink-0" aria-hidden="true" />
          <span className="hidden flex-1 text-left lg:inline">Search…</span>
          <kbd className="hidden rounded border border-slate-200 bg-white px-1.5 py-0.5 font-sans text-[10px] text-slate-400 lg:inline">
            ⌘K
          </kbd>
        </button>

        <NotificationBell />

        {/* The second half of the "where am I" answer the violet sidebar mark
            starts. An operator glancing at the top of the screen — which is
            where the CRM trained them to look for context — sees it here too. */}
        <span className="hidden items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-medium text-brand-700 ring-1 ring-inset ring-brand-600/20 lg:inline-flex">
          <ShieldCheck className="size-3.5" aria-hidden="true" />
          Admin mode
        </span>

        {/* A hairline before the account controls, so the bar reads as two
            groups — what you are looking at, and who you are. */}
        <span className="hidden h-6 w-px bg-slate-200 sm:block" aria-hidden="true" />

        <Button
          variant="secondary"
          size="sm"
          onClick={onSignOut}
          isLoading={isSigningOut}
          loadingLabel="Signing out…"
          className="hidden md:inline-flex"
        >
          Logout
        </Button>

        <UserMenu user={user} onSignOut={onSignOut} isSigningOut={isSigningOut} />
      </div>

      <GlobalSearch isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </header>
  )
}

export default AdminTopbar
