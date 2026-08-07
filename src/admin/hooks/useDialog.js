/**
 * The accessibility contract every admin overlay owes.
 *
 * Written once because both the modal and the drawer owe exactly the same
 * things, and an overlay that gets any of them wrong is a keyboard trap:
 *
 *  - **Escape closes**, from anywhere inside.
 *  - **Focus moves in** when it opens, so the next Tab lands in the dialog
 *    rather than back at the top of the page behind it.
 *  - **Focus is trapped** while open. Tabbing past the last control wraps to the
 *    first; Shift+Tab from the first wraps to the last. Without this a keyboard
 *    user tabs straight out into a page they cannot see and cannot get back from.
 *  - **Focus returns** to whatever opened it on close, so the user resumes where
 *    they were instead of at the top of the document.
 *  - **The page behind cannot scroll**, or the backdrop moves under the dialog.
 *
 * `UserMenu` implements the first, second and fourth of these by hand for a
 * dropdown, and this follows the same approach for the same reason it gives:
 * a headless dialog library is a dependency, and the contract is small enough
 * to own — provided it is owned in one place.
 */

import { useCallback, useEffect, useRef } from 'react'

/** Everything focusable, in document order. `:not([disabled])` matters here. */
const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * @param {{ isOpen: boolean, onClose: () => void }} params
 * @returns {import('react').RefObject<HTMLElement>} Attach to the dialog panel.
 */
export function useDialog({ isOpen, onClose }) {
  const panelRef = useRef(null)
  const openerRef = useRef(null)

  const close = useCallback(() => onClose(), [onClose])

  // --- Remember who opened it, and give focus back on close ---------------
  useEffect(() => {
    if (!isOpen) return undefined

    openerRef.current = document.activeElement

    // Deferred a frame so the panel exists before focus is moved into it.
    const frame = requestAnimationFrame(() => {
      const panel = panelRef.current
      if (!panel) return

      const first = panel.querySelector(FOCUSABLE)
      // The panel itself carries `tabIndex={-1}`, so there is always somewhere
      // to land even in a dialog whose only content is text.
      ;(first ?? panel).focus()
    })

    return () => {
      cancelAnimationFrame(frame)

      // Only restore focus if it is still inside the dialog. If the user has
      // already clicked elsewhere, yanking it back is the more jarring bug.
      const opener = openerRef.current
      if (opener?.isConnected && !document.activeElement?.closest?.('[data-admin-dialog]')) {
        opener.focus?.()
      }
    }
  }, [isOpen])

  // --- Escape, and the focus trap ------------------------------------------
  useEffect(() => {
    if (!isOpen) return undefined

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        // Stopped so a dialog opened over another overlay closes only itself.
        event.stopPropagation()
        close()
        return
      }

      if (event.key !== 'Tab') return

      const panel = panelRef.current
      if (!panel) return

      const focusable = [...panel.querySelectorAll(FOCUSABLE)]
      if (focusable.length === 0) {
        // Nothing to cycle through — keep focus on the panel rather than
        // letting Tab escape to the page behind.
        event.preventDefault()
        return
      }

      const first = focusable[0]
      const last = focusable.at(-1)

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [isOpen, close])

  // --- Freeze the page behind ----------------------------------------------
  useEffect(() => {
    if (!isOpen) return undefined

    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = overflow
    }
  }, [isOpen])

  return panelRef
}

export default useDialog
