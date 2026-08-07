/**
 * Topbar user dropdown.
 *
 * Implemented directly rather than with a headless menu library, to keep the
 * dependency footprint small. That means the accessibility contract is this
 * component's responsibility, so it is handled explicitly:
 *
 *  - `aria-haspopup="menu"` / `aria-expanded` on the trigger;
 *  - `role="menu"` with `role="menuitem"` children;
 *  - Escape closes and returns focus to the trigger;
 *  - a pointerdown listener outside the menu closes it;
 *  - focus moves to the first item when opened by keyboard.
 */

import { ChevronDown, LogOut, UserCircle } from 'lucide-react'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import { UserAvatar } from '@/components/common/UserAvatar'
import { ROUTE_PATHS } from '@/routes/paths'

/**
 * @param {{
 *   user?: ?object,
 *   onSignOut: () => void,
 *   isSigningOut?: boolean,
 * }} props
 */
export function UserMenu({ user, onSignOut, isSigningOut = false }) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef(null)
  const triggerRef = useRef(null)
  const menuRef = useRef(null)
  const menuId = useId()

  const close = useCallback(({ returnFocus = false } = {}) => {
    setIsOpen(false)
    if (returnFocus) triggerRef.current?.focus()
  }, [])

  // Close on any interaction outside the menu. `pointerdown` is used rather than
  // `click` so the menu closes on press, matching native platform menus.
  useEffect(() => {
    if (!isOpen) return undefined

    const onPointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) setIsOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [isOpen])

  // Escape closes and restores focus, so keyboard users are never stranded.
  useEffect(() => {
    if (!isOpen) return undefined

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        close({ returnFocus: true })
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isOpen, close])

  /** Opens the menu and moves focus inside, for keyboard activation. */
  const openWithFocus = () => {
    setIsOpen(true)
    // Deferred a frame so the menu exists before focus is moved into it.
    requestAnimationFrame(() => {
      menuRef.current?.querySelector('[role="menuitem"]')?.focus()
    })
  }

  const handleTriggerKeyDown = (event) => {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openWithFocus()
    }
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((previous) => !previous)}
        onKeyDown={handleTriggerKeyDown}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={menuId}
        className="flex max-w-56 items-center gap-2 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-slate-100 sm:px-2"
      >
        <UserAvatar
          name={user?.displayName}
          email={user?.email}
          initials={user?.initials}
          size="sm"
        />
        {/* The name is hidden on the narrowest screens to protect the topbar from
            wrapping; the avatar plus the accessible label still identify the user. */}
        <span className="hidden min-w-0 flex-1 text-left sm:block">
          <span className="block truncate text-sm font-medium text-slate-800">
            {user?.displayName ?? 'Account'}
          </span>
        </span>
        <ChevronDown
          className={`hidden size-4 shrink-0 text-slate-400 transition-transform sm:block ${
            isOpen ? 'rotate-180' : ''
          }`}
          aria-hidden="true"
        />
        <span className="sr-only">
          Account menu for {user?.displayName ?? 'the current user'}
        </span>
      </button>

      {isOpen && (
        <div
          id={menuId}
          ref={menuRef}
          role="menu"
          aria-label="Account menu"
          className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-dropdown"
        >
          <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
            <UserAvatar
              name={user?.displayName}
              email={user?.email}
              initials={user?.initials}
              size="md"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">
                {user?.displayName ?? 'Signed in'}
              </p>
              <p className="truncate text-xs text-slate-500">{user?.email ?? '—'}</p>
            </div>
          </div>

          <div className="p-1.5">
            <Link
              to={ROUTE_PATHS.ACCOUNT}
              role="menuitem"
              onClick={() => close()}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-100"
            >
              <UserCircle className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
              Account settings
            </Link>

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                close()
                onSignOut()
              }}
              disabled={isSigningOut}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <LogOut className="size-4 shrink-0" aria-hidden="true" />
              {isSigningOut ? 'Signing out…' : 'Logout'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default UserMenu
