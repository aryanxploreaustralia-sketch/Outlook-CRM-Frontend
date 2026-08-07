/**
 * Centred modal dialog.
 *
 * The accessibility contract — Escape, focus in, focus trapped, focus returned,
 * page frozen — is `useDialog`'s, so this file is layout and nothing else.
 *
 * `role="dialog"` with `aria-modal="true"` and a heading referenced by
 * `aria-labelledby`, because a `<div>` that merely looks like a dialog is
 * announced as a `<div>`.
 *
 * Deliberately not rendered through a portal. The admin shell has one scroll
 * container and no transformed ancestors, so `fixed` resolves against the
 * viewport as intended — and a portal would put the panel outside the React tree
 * the focus trap queries.
 */

import { X } from 'lucide-react'
import { useId } from 'react'

import { useDialog } from '@/admin/hooks/useDialog'

const SIZES = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
}

/**
 * @param {{
 *   isOpen: boolean,
 *   onClose: () => void,
 *   title: string,
 *   description?: string,
 *   size?: keyof typeof SIZES,
 *   footer?: import('react').ReactNode,
 *   busy?: boolean,
 *   children: import('react').ReactNode,
 * }} props
 */
export function AdminModal({
  isOpen,
  onClose,
  title,
  description,
  size = 'md',
  footer,
  busy = false,
  children,
}) {
  const titleId = useId()
  const descriptionId = useId()
  const panelRef = useDialog({ isOpen, onClose })

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6">
      {/* Scrim. Click-to-dismiss is a convenience; Escape is the accessible
          path and is handled centrally. Ignored while a request is in flight,
          so a stray click cannot discard a form mid-submit. */}
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
        aria-describedby={description ? descriptionId : undefined}
        aria-busy={busy || undefined}
        tabIndex={-1}
        className={`relative flex max-h-[90svh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-dropdown outline-none sm:rounded-2xl ${SIZES[size] ?? SIZES.md}`}
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-semibold text-slate-900">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="mt-1 text-sm text-slate-500">
                {description}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="-mr-1 shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </header>

        {/* The dialog body is the scroll container, so a long form scrolls
            inside the panel and the header and footer stay put. */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>

        {footer && (
          <footer className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-6 py-3.5">
            {footer}
          </footer>
        )}
      </div>
    </div>
  )
}

export default AdminModal
