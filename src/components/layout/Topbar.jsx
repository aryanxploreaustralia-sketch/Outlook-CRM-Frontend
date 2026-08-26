/**
 * Application top bar.
 *
 * Fixed chrome: it is a non-shrinking flex child of the app shell, which owns
 * the single scroll container. It therefore stays put without `sticky`, and
 * without `sticky` it cannot be broken by an ancestor's overflow.
 *
 * Global search landed here in Phase 15.1, in exactly the position this comment
 * reserved for it: between the title and the notification bell.
 *
 * It is a *button* that opens a palette, not an inline input. An input in the
 * chrome has to be clicked before it can be typed into, and it competes for
 * width with the page title on every viewport. A palette is reachable from the
 * keyboard from anywhere (⌘K or `/`), owns the screen while it is open, and
 * costs the bar a fixed 200px that never fights the title.
 */

import { useCallback, useState } from 'react'
import { Menu, Search } from 'lucide-react'

import { GlobalSearch } from '@/components/search/GlobalSearch'
import { useSearchHotkey } from '@/hooks/useSearchHotkey'
import { NotificationBell } from '@/components/layout/NotificationBell'
import { UserMenu } from '@/components/layout/UserMenu'
import { Button } from '@/components/ui/Button'
import { InstallAppButton } from '@/components/pwa/InstallAppButton'

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
export function Topbar({
  title = 'Dashboard',
  subtitle,
  user,
  isMobile,
  onOpenDrawer,
  onSignOut,
  isSigningOut = false,
}) {
  const [isSearchOpen, setIsSearchOpen] = useState(false)

  const openSearch = useCallback(() => setIsSearchOpen(true), [])

  // Disabled while open, so the shortcut cannot re-trigger and steal focus back
  // from whatever the reader is doing inside the palette.
  useSearchHotkey(openSearch, !isSearchOpen)

  return (
    <header className="sticky top-0 z-20 shrink-0 border-b border-slate-200 bg-white/85 backdrop-blur">
      <div className="flex h-(--spacing-topbar) items-center gap-3 px-4 sm:gap-4 sm:px-6">
        {/* --- Mobile menu button ------------------------------------------- */}
        {isMobile && (
          <button
            type="button"
            onClick={onOpenDrawer}
            aria-label="Open navigation menu"
            aria-controls="app-sidebar"
            className="-ml-1 rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            <Menu className="size-5" aria-hidden="true" />
          </button>
        )}

        {/* --- Page title ---------------------------------------------------
            `min-w-0` is what stops a long title forcing the whole bar wider
            than the viewport and introducing horizontal scroll. */}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold text-slate-900">{title}</h1>
          {subtitle && <p className="truncate text-xs text-slate-500">{subtitle}</p>}
        </div>

        {/* --- Global search -------------------------------------------------
            A button, not an input. On small screens it collapses to the icon:
            the shortcut hint is the first thing to go when width is scarce,
            because it is the least useful part on a device with no keyboard. */}
        <button
          type="button"
          onClick={openSearch}
          className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm text-slate-400 transition-colors hover:border-slate-300 hover:bg-white sm:w-52"
          aria-label="Search"
          aria-keyshortcuts="Control+K"
        >
          <Search className="size-4 shrink-0" aria-hidden="true" />
          <span className="hidden flex-1 text-left sm:inline">Search…</span>
          <kbd className="hidden rounded border border-slate-200 bg-white px-1.5 py-0.5 font-sans text-[10px] text-slate-400 sm:inline">
            ⌘K
          </kbd>
        </button>

        {/* --- Install offer -------------------------------------------------
            Renders `null` unless Chromium has fired `beforeinstallprompt`, so
            for anybody already running the installed app — or on a browser that
            cannot install it — this row is byte-for-byte what it was. */}
        <InstallAppButton />

        {/* --- Notifications -------------------------------------------------
            Live since Phase H4. Replaces the disabled placeholder that had
            stood here since Phase 1, in the same position, so the chrome does
            not shift now that it works. */}
        <NotificationBell />

        {/* --- Sign out (explicit, alongside the dropdown) ------------------ */}
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

        {/* --- User dropdown ------------------------------------------------ */}
        <UserMenu user={user} onSignOut={onSignOut} isSigningOut={isSigningOut} />
      </div>

      <GlobalSearch isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </header>
  )
}

export default Topbar
