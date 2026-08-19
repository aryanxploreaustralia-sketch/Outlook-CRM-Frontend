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
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  Link2,
  List,
  ListOrdered,
  Redo2,
  Strikethrough,
  Image as ImageIcon,
  PenLine,
  Table as TableIcon,
  Underline as UnderlineIcon,
  Undo2,
} from 'lucide-react'

import { fetchMySignature } from '@/api/services/signature.service'

/** Toolbar actions handled by a plain `execCommand` with no argument. */
const SIMPLE_COMMANDS = [
  { command: 'bold', icon: Bold, label: 'Bold', shortcut: '⌘B' },
  { command: 'italic', icon: Italic, label: 'Italic', shortcut: '⌘I' },
  { command: 'underline', icon: UnderlineIcon, label: 'Underline', shortcut: '⌘U' },
  { command: 'insertUnorderedList', icon: List, label: 'Bulleted list' },
  { command: 'insertOrderedList', icon: ListOrdered, label: 'Numbered list' },
  { command: 'strikeThrough', icon: Strikethrough, label: 'Strikethrough' },
  { command: 'justifyLeft', icon: AlignLeft, label: 'Align left' },
  { command: 'justifyCenter', icon: AlignCenter, label: 'Align centre' },
  { command: 'justifyRight', icon: AlignRight, label: 'Align right' },
  { command: 'undo', icon: Undo2, label: 'Undo' },
  { command: 'redo', icon: Redo2, label: 'Redo' },
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
  const imageInput = useRef(null)
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
   * Inserts a real `<table>`, styled for mail clients rather than for a browser.
   *
   * Every rule is an inline attribute or an inline style, and the layout is the
   * table itself — not flex, not grid. Outlook's rendering engine is Word's: it
   * ignores a stylesheet, drops most modern CSS, and collapses borders it was
   * not told about explicitly. `border-collapse` plus per-cell borders and
   * padding is the combination that survives Outlook, Gmail and Apple Mail
   * alike, which is why the markup looks dated — it has to.
   *
   * The header row is real `<th>` with a background, so the table still reads
   * as a table when a client strips colour.
   */
  const insertTable = useCallback(() => {
    const rows = Number(window.prompt('Rows (including the header)', '4'))
    const columns = Number(window.prompt('Columns', '4'))

    if (!Number.isInteger(rows) || !Number.isInteger(columns)) return
    if (rows < 1 || columns < 1 || rows > 50 || columns > 12) {
      window.alert('Enter between 1 and 50 rows and 1 and 12 columns.')
      return
    }

    const cell = 'border:1px solid #cbd5e1;padding:8px 10px;font-size:14px;vertical-align:top;'
    const head = `${cell}background-color:#f1f5f9;font-weight:bold;text-align:left;`

    const headerCells = Array.from({ length: columns }, () => `<th style="${head}">&nbsp;</th>`).join('')
    const bodyRows = Array.from({ length: rows - 1 }, () =>
      `<tr>${Array.from({ length: columns }, () => `<td style="${cell}">&nbsp;</td>`).join('')}</tr>`,
    ).join('')

    const html =
      `<table role="presentation" cellpadding="0" cellspacing="0" border="0" ` +
      `style="border-collapse:collapse;width:100%;margin:12px 0;font-family:Arial,Helvetica,sans-serif;">` +
      `<thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table><p><br /></p>`

    runCommand('insertHTML', html)
  }, [runCommand])

  /**
   * Inserts a picture at the cursor, inline as a data URI.
   *
   * ## Why base64 and not an upload
   *
   * There is no media storage in this product, and inventing one to hold a
   * signature logo would be a larger change than this control. A data URI needs
   * no endpoint, no bucket and no cleanup job, and it survives every step that
   * matters here: the template stores it in `bodyHtml`, the sanitiser allows
   * `data:` on `img` specifically (it cannot execute there), and the preview
   * renders it.
   *
   * ## What it costs
   *
   * Base64 is a third larger than the file, and the bytes live in the template
   * document and in every message built from it. Hence the 512 KB ceiling — a
   * logo or a screenshot fits comfortably; a photograph straight off a camera
   * does not, and is refused with a message saying so rather than silently
   * producing a template too large to save.
   *
   * Outlook and Gmail both restrict remote and embedded images by default, so a
   * recipient may see a placeholder until they choose to load pictures. That is
   * true of every image in every email and is not something this control can
   * change.
   */
  const insertImage = useCallback(
    (file) => {
      if (!file) return

      if (!file.type.startsWith('image/')) {
        window.alert('Choose an image file.')
        return
      }

      if (file.size > 512 * 1024) {
        window.alert(
          `That image is ${Math.round(file.size / 1024)} KB. Images are embedded in the message, so please use one under 512 KB.`,
        )
        return
      }

      const reader = new FileReader()

      reader.onload = () => {
        // `max-width` keeps a wide image inside the message column; `height:auto`
        // stops mail clients stretching it. Both inline, because Outlook ignores
        // stylesheets.
        const alt = file.name.replace(/\.[^.]+$/, '').replace(/["<>]/g, '')
        runCommand(
          'insertHTML',
          `<img src="${reader.result}" alt="${alt}" style="max-width:100%;height:auto;" />`,
        )
      }

      reader.readAsDataURL(file)
    },
    [runCommand],
  )

  /**
   * Inserts the caller's saved signature at the cursor.
   *
   * Fetched on demand rather than held in state: a signature edited in Account
   * should be the one that lands here on the next click, and caching it would
   * mean the editor quietly using a stale copy for the rest of the session.
   *
   * `insertHTML` places it at the selection, so it appends to whatever has been
   * written rather than replacing the body. The content is already sanitised —
   * `PUT /v1/account/signature` sanitises before storing — so nothing is
   * re-processed here.
   */
  const insertSignature = useCallback(async () => {
    try {
      const signatureHtml = await fetchMySignature()

      if (!signatureHtml || signatureHtml.trim() === '') {
        window.alert('No signature configured. Add your signature from Account.')
        return
      }

      // A leading break so it never runs into the last line of the message.
      runCommand('insertHTML', `<br />${signatureHtml}`)
    } catch {
      window.alert('Your signature could not be loaded. Please try again.')
    }
  }, [runCommand])

  /** Font size, via `execCommand`'s 1–7 scale — the one mail clients honour. */
  const applyFontSize = useCallback(
    (value) => {
      if (value) runCommand('fontSize', value)
    },
    [runCommand],
  )

  const applyColour = useCallback(
    (command, value) => {
      if (value) runCommand(command, value)
    },
    [runCommand],
  )

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

        <span className="mx-1 h-5 w-px bg-slate-300" aria-hidden="true" />

        <button
          type="button"
          disabled={disabled}
          onMouseDown={(event) => event.preventDefault()}
          onClick={insertTable}
          className="rounded p-1.5 text-slate-600 transition-colors hover:bg-slate-200 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
          title="Insert table"
        >
          <TableIcon className="size-4" aria-hidden="true" />
          <span className="sr-only">Insert table</span>
        </button>

        {/* A hidden input driven by the button, so the control matches the rest
            of the toolbar instead of showing a browser file field. */}
        <input
          ref={imageInput}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          className="hidden"
          onChange={(event) => {
            insertImage(event.target.files?.[0])
            // Cleared so choosing the same file twice fires `change` again.
            event.target.value = ''
          }}
        />

        <button
          type="button"
          disabled={disabled}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => imageInput.current?.click()}
          className="rounded p-1.5 text-slate-600 transition-colors hover:bg-slate-200 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
          title="Insert image"
        >
          <ImageIcon className="size-4" aria-hidden="true" />
          <span className="sr-only">Insert image</span>
        </button>

        <button
          type="button"
          disabled={disabled}
          onMouseDown={(event) => event.preventDefault()}
          onClick={insertSignature}
          className="rounded p-1.5 text-slate-600 transition-colors hover:bg-slate-200 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
          title="Insert signature"
        >
          <PenLine className="size-4" aria-hidden="true" />
          <span className="sr-only">Insert signature</span>
        </button>

        <label className="ml-1 flex items-center gap-1 text-xs text-slate-600">
          <span className="sr-only">Text size</span>
          <select
            disabled={disabled}
            defaultValue=""
            onMouseDown={(event) => event.stopPropagation()}
            onChange={(event) => {
              applyFontSize(event.target.value)
              event.target.value = ''
            }}
            className="rounded border border-slate-300 bg-white px-1.5 py-1 text-xs text-slate-700"
          >
            <option value="">Size</option>
            <option value="2">Small</option>
            <option value="3">Normal</option>
            <option value="5">Large</option>
            <option value="6">Heading</option>
          </select>
        </label>

        {/*
          Native colour inputs rather than a custom palette: they are already
          keyboard-accessible and localised, and the value goes straight into
          `foreColor`/`hiliteColor` as an inline style, which is what mail
          clients keep.
        */}
        <label className="ml-1 flex items-center gap-1" title="Text colour">
          <span className="sr-only">Text colour</span>
          <input
            type="color"
            disabled={disabled}
            defaultValue="#0f172a"
            onMouseDown={(event) => event.stopPropagation()}
            onChange={(event) => applyColour('foreColor', event.target.value)}
            className="size-6 cursor-pointer rounded border border-slate-300 bg-white p-0.5"
          />
        </label>

        <label className="flex items-center gap-1" title="Highlight colour">
          <span className="sr-only">Highlight colour</span>
          <input
            type="color"
            disabled={disabled}
            defaultValue="#fef08a"
            onMouseDown={(event) => event.stopPropagation()}
            onChange={(event) => applyColour('hiliteColor', event.target.value)}
            className="size-6 cursor-pointer rounded border border-slate-300 bg-white p-0.5"
          />
        </label>
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
