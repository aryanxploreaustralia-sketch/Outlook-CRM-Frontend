/**
 * A remark, compact in the row and complete on click.
 *
 * ## Why a cell component rather than a wider column
 *
 * `internalNotes` holds up to 4,000 characters and comes from a spreadsheet, so
 * a column sized to fit it would either break the table or reduce every other
 * enquiry to a sliver. The row keeps one truncated line at the width it already
 * had; the full text is one click away.
 *
 * `title` is kept as well as the dialog: a hover reads a slightly-too-long
 * remark without opening anything, and the dialog is there for the rest. Neither
 * is a substitute for the other — `title` never appears on touch, and it does
 * not preserve the line breaks the sheet's remarks often carry.
 *
 * ## The dialog
 *
 * `AdminModal` is the application's modal, and the only one that owns the whole
 * accessibility contract — Escape, focus moved in, focus trapped, focus returned
 * to the opener, scrim, page frozen — through `useDialog`. Its markup is plain
 * Tailwind with no console-specific tokens, and it already renders as a bottom
 * sheet under `sm`, so reusing it here is what avoids a second modal system with
 * a worse contract. The name is the console's; the behaviour is not.
 */

import { useState } from 'react'

import { AdminModal } from '@/admin/components/AdminModal'
import { Button } from '@/components/ui/Button'

/**
 * How the trigger sits in its container.
 *
 * `block` owns a table cell and does its own truncating. `inline` sits inside a
 * line of prose — a card subtitle — where the surrounding `<p>` already
 * truncates and a block-level button would break the line.
 */
const VARIANTS = {
  block: 'block w-full truncate text-left',
  inline: 'inline text-left',
}

/**
 * @param {{
 *   remarks: ?string,
 *   reference?: ?string,
 *   variant?: keyof typeof VARIANTS,
 *   emptyFallback?: import('react').ReactNode,
 *   className?: string,
 * }} props
 *   `reference` only names the enquiry in the dialog's heading, so a reader who
 *   opened one from a long page can see which row they are looking at.
 */
export function RemarkCell({
  remarks,
  reference = null,
  variant = 'block',
  emptyFallback = <span className="text-slate-400">—</span>,
  className = '',
}) {
  const [isOpen, setIsOpen] = useState(false)

  // Whitespace-only remarks exist in the sheet and are not worth a dialog.
  const text = typeof remarks === 'string' ? remarks.trim() : ''

  // The empty placeholder is deliberately not a button: nothing to open, and a
  // focus stop on every blank row would make the table tedious to tab through.
  // Inline callers pass `null`, because a card that has no remark shows no line.
  if (!text) return emptyFallback

  return (
    <>
      <button
        type="button"
        onClick={(event) => {
          /*
           * A card is often wrapped in a link, and a row may grow a click
           * handler later. Both are stopped here so the remark opens its dialog
           * and nothing else — `preventDefault` for the anchor, `stopPropagation`
           * for the row.
           */
          event.preventDefault()
          event.stopPropagation()
          setIsOpen(true)
        }}
        title={text}
        aria-label={`View full remark${reference ? ` for ${reference}` : ''}`}
        className={`cursor-pointer underline-offset-2 hover:text-slate-900 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 ${VARIANTS[variant] ?? VARIANTS.block} ${className}`}
      >
        {text}
      </button>

      <AdminModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Remark"
        description={reference ?? undefined}
        footer={
          <Button variant="secondary" size="sm" onClick={() => setIsOpen(false)}>
            Close
          </Button>
        }
      >
        {/*
          `whitespace-pre-wrap` keeps the sheet's own line breaks, which carry
          meaning in these remarks; `break-words` stops an unbroken run of
          characters — a pasted URL, a reference string — widening the panel.
          The panel body is already the scroll container, so a very long remark
          scrolls rather than growing past the viewport.
        */}
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700">{text}</p>
      </AdminModal>
    </>
  )
}

export default RemarkCell
