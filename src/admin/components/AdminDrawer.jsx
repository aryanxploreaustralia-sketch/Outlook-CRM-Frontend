/**
 * Right-hand slide-over panel.
 *
 * Used for the user profile rather than a modal, and the distinction is not
 * decorative: a modal says *finish this, then continue*, and a profile is
 * something you glance at and dismiss. A drawer keeps the directory visible
 * behind it, so the row you came from is still on screen when you close it.
 *
 * Shares `useDialog` with `AdminModal`, so both owe the same accessibility
 * contract and neither can drift from it. On narrow viewports it becomes a
 * full-width sheet — a 28rem panel on a phone is a modal with a gap down one
 * side.
 */

import { X } from 'lucide-react'
import { useId } from 'react'

import { useDialog } from '@/admin/hooks/useDialog'

/**
 * @param {{
 *   isOpen: boolean,
 *   onClose: () => void,
 *   title: string,
 *   description?: string,
 *   footer?: import('react').ReactNode,
 *   busy?: boolean,
 *   children: import('react').ReactNode,
 * }} props
 */
export function AdminDrawer({ isOpen, onClose, title, description, footer, busy = false, children }) {
  const titleId = useId()
  const panelRef = useDialog({ isOpen, onClose })

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={busy ? undefined : onClose}
        aria-hidden="true"
      />

      <div
        ref={panelRef}
        data-admin-dialog
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-busy={busy || undefined}
        tabIndex={-1}
        className="relative flex h-full w-full flex-col bg-white shadow-dropdown outline-none sm:max-w-lg"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="truncate text-base font-semibold text-slate-900">
              {title}
            </h2>
            {description && <p className="mt-0.5 truncate text-sm text-slate-500">{description}</p>}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </header>

        {/* `min-h-0` so this scrolls internally rather than stretching the
            panel past the viewport — the same rule the app shell relies on. */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {footer && (
          <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3">
            {footer}
          </footer>
        )}
      </div>
    </div>
  )
}

export default AdminDrawer
