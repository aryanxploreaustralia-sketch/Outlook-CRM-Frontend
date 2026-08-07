/**
 * Minimal rich-text editor for the message body.
 *
 * Built on `contentEditable` and `document.execCommand` rather than pulling in
 * an editor library. The reasoning: the formatting an email needs is bold,
 * italic, underline, lists and links — a fraction of what a full editor ships —
 * and adding one would add hundreds of kilobytes to a bundle that currently has
 * no editor dependency at all.
 *
 * `execCommand` is formally deprecated. It is used anyway because every current
 * browser implements it, the replacement (a manual Selection/Range
 * implementation) is substantially more code to get right, and the output is
 * exactly what is wanted here: the plain, widely-compatible HTML that email
 * clients render most predictably. If a richer editor is ever needed, this
 * component is the only file that changes — everything else deals in an HTML
 * string.
 *
 * ## The uncontrolled-input problem
 *
 * A `contentEditable` node cannot be driven from React state the way an `<input>`
 * can: writing `innerHTML` on every render destroys the caret position, so the
 * cursor jumps to the start on each keystroke. The DOM is therefore left as the
 * source of truth while the user types, and `value` is only written back when it
 * diverges from what is already there — which happens on reset, not on typing.
 */

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Bold, Italic, Link2, List, ListOrdered, Underline as UnderlineIcon } from 'lucide-react'

/** Toolbar actions handled by a plain `execCommand` with no argument. */
const SIMPLE_COMMANDS = [
  { command: 'bold', icon: Bold, label: 'Bold', shortcut: '⌘B' },
  { command: 'italic', icon: Italic, label: 'Italic', shortcut: '⌘I' },
  { command: 'underline', icon: UnderlineIcon, label: 'Underline', shortcut: '⌘U' },
  { command: 'insertUnorderedList', icon: List, label: 'Bulleted list' },
  { command: 'insertOrderedList', icon: ListOrdered, label: 'Numbered list' },
]

/**
 * @param {{
 *   value: string,
 *   onChange: (html: string) => void,
 *   placeholder?: string,
 *   disabled?: boolean,
 *   minHeight?: string,
 * }} props
 */
export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Write your message…',
  disabled = false,
  minHeight = '16rem',
}) {
  const editorRef = useRef(null)
  const labelId = useId()
  const [isEmpty, setIsEmpty] = useState(true)

  // Only writes when the incoming value differs from the DOM, so typing is never
  // interrupted — see the note above about caret position.
  useEffect(() => {
    const node = editorRef.current
    if (!node) return

    if (node.innerHTML !== value) {
      node.innerHTML = value ?? ''
    }

    setIsEmpty((node.textContent ?? '').trim() === '' && !node.querySelector('img'))
  }, [value])

  const emitChange = useCallback(() => {
    const node = editorRef.current
    if (!node) return

    setIsEmpty((node.textContent ?? '').trim() === '' && !node.querySelector('img'))
    onChange(node.innerHTML)
  }, [onChange])

  /**
   * Applies a formatting command to the current selection.
   *
   * The editor is focused first: clicking a toolbar button moves focus to the
   * button, and `execCommand` operates on whatever is focused — without this the
   * command would silently apply to nothing.
   */
  const runCommand = useCallback(
    (command, argument = null) => {
      const node = editorRef.current
      if (!node || disabled) return

      node.focus()
      document.execCommand(command, false, argument)
      emitChange()
    },
    [disabled, emitChange],
  )

  const insertLink = useCallback(() => {
    const url = window.prompt('Link address', 'https://')
    if (!url || url === 'https://') return

    // Rejected explicitly: `javascript:` in an href is a script-execution vector,
    // and it would be carried into the recipient's mail client.
    if (/^\s*javascript:/i.test(url)) {
      window.alert('That link type is not allowed.')
      return
    }

    runCommand('createLink', url)
  }, [runCommand])

  /**
   * Strips formatting from pasted content.
   *
   * Pasting from Word or a web page carries a payload of inline styles and
   * classes that render inconsistently across mail clients and can multiply the
   * message size several times over. Plain text is the predictable choice.
   */
  const handlePaste = useCallback(
    (event) => {
      event.preventDefault()
      const text = event.clipboardData.getData('text/plain')
      document.execCommand('insertText', false, text)
      emitChange()
    },
    [emitChange],
  )

  return (
    <div
      className={`overflow-hidden rounded-lg border border-slate-300 bg-white transition-colors focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/30 ${
        disabled ? 'opacity-60' : ''
      }`}
    >
      {/* --- Toolbar ------------------------------------------------------- */}
      <div
        role="toolbar"
        aria-label="Text formatting"
        aria-controls={labelId}
        className="flex flex-wrap items-center gap-0.5 border-b border-slate-200 bg-slate-50/80 px-2 py-1.5"
      >
        {SIMPLE_COMMANDS.map(({ command, icon: Icon, label, shortcut }) => (
          <button
            key={command}
            type="button"
            disabled={disabled}
            // `onMouseDown` with preventDefault, not `onClick`: a click would
            // first blur the editor and collapse the selection, so the command
            // would have nothing to format.
            onMouseDown={(event) => {
              event.preventDefault()
              runCommand(command)
            }}
            title={shortcut ? `${label} (${shortcut})` : label}
            aria-label={label}
            className="grid size-7 place-items-center rounded text-slate-600 transition-colors hover:bg-slate-200 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Icon className="size-4" aria-hidden="true" />
          </button>
        ))}

        <span className="mx-1 h-4 w-px bg-slate-300" aria-hidden="true" />

        <button
          type="button"
          disabled={disabled}
          onMouseDown={(event) => {
            event.preventDefault()
            insertLink()
          }}
          title="Insert link"
          aria-label="Insert link"
          className="grid size-7 place-items-center rounded text-slate-600 transition-colors hover:bg-slate-200 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Link2 className="size-4" aria-hidden="true" />
        </button>
      </div>

      {/* --- Editable surface ---------------------------------------------- */}
      <div className="relative">
        {isEmpty && (
          <p
            className="pointer-events-none absolute left-4 top-3 text-sm text-slate-400"
            aria-hidden="true"
          >
            {placeholder}
          </p>
        )}

        <div
          id={labelId}
          ref={editorRef}
          role="textbox"
          aria-multiline="true"
          aria-label="Message body"
          contentEditable={!disabled}
          suppressContentEditableWarning
          onInput={emitChange}
          onBlur={emitChange}
          onPaste={handlePaste}
          style={{ minHeight }}
          className="prose-sm max-w-none px-4 py-3 text-sm leading-relaxed text-slate-900 outline-none [&_a]:text-brand-600 [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5"
        />
      </div>
    </div>
  )
}

export default RichTextEditor
