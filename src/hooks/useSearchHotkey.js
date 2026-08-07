/**
 * Opens the command palette on Ctrl/⌘+K or `/`.
 *
 * ## Why `/` needs a guard and `Ctrl+K` does not
 *
 * `/` is an ordinary character. Bound unconditionally it would be impossible to
 * type a slash anywhere in the application — in a search box, a URL field, a
 * template body. So it only fires when focus is not in something editable, and
 * `contentEditable` counts: the rich-text template editor is exactly where
 * swallowing a keystroke would be most infuriating.
 *
 * `Ctrl+K` carries a modifier, so it cannot be typed by accident. It is still
 * prevented from reaching the browser, which binds it to the address bar in
 * some builds.
 *
 * ## Listening on the window, in capture
 *
 * Capture so the palette wins before a component that binds the same key for
 * its own list. Window rather than document so it works regardless of where
 * focus currently is, including nothing.
 */

import { useEffect } from 'react'

/** Whether a keystroke is destined for somewhere the reader is typing. */
function isEditable(target) {
  if (!target) return false

  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true

  return target.isContentEditable === true
}

/**
 * @param {() => void} onOpen Called when the shortcut fires.
 * @param {boolean} [enabled] False while the palette is already open.
 */
export function useSearchHotkey(onOpen, enabled = true) {
  useEffect(() => {
    if (!enabled) return undefined

    const handler = (event) => {
      const isCommandK = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k'

      if (isCommandK) {
        event.preventDefault()
        onOpen()
        return
      }

      // A bare slash, only when it is not being typed into something.
      if (event.key === '/' && !event.metaKey && !event.ctrlKey && !event.altKey && !isEditable(event.target)) {
        event.preventDefault()
        onOpen()
      }
    }

    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [onOpen, enabled])
}

export default useSearchHotkey
