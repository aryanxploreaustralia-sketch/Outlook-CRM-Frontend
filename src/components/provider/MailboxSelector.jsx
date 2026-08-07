/**
 * Chooses which mailbox the Provider page is describing.
 *
 * ## View context, not configuration
 *
 * Selecting a mailbox here changes what this page *shows and acts on*. It does
 * not change which mailbox the CRM sends from — that is the workspace default,
 * set on Account, and nothing on this page touches it. The two are deliberately
 * separate concerns and the wording keeps them apart: the default mailbox is
 * labelled as such in the list, but selecting another one never moves it.
 *
 * Disconnected mailboxes are listed. They are precisely what an operator comes
 * here to select, because selecting one is how they reach its Reconnect button;
 * hiding them would leave the page unable to offer the only action that helps.
 */

import { Check, ChevronDown, Mail } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

/** Per-status dot and label, matching the Account page's vocabulary. */
const STATUS = {
  connected: { dot: 'bg-emerald-500', label: 'Connected' },
  degraded: { dot: 'bg-amber-500', label: 'Needs attention' },
  expired: { dot: 'bg-amber-500', label: 'Needs reconnecting' },
  error: { dot: 'bg-red-500', label: 'Unavailable' },
  disconnected: { dot: 'bg-slate-300', label: 'Disconnected' },
  not_configured: { dot: 'bg-slate-300', label: 'Not set up' },
}

const describe = (mailbox) => STATUS[mailbox?.status] ?? STATUS.disconnected

/**
 * @param {{
 *   mailboxes: object[],
 *   selectedId: ?string,
 *   onSelect: (id: string) => void,
 *   disabled?: boolean,
 * }} props
 */
export function MailboxSelector({ mailboxes, selectedId, onSelect, disabled = false }) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef(null)

  // Closes on an outside click or Escape, so the menu never strands the page.
  useEffect(() => {
    if (!isOpen) return undefined

    const onPointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) setIsOpen(false)
    }
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setIsOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [isOpen])

  if (mailboxes.length === 0) return null

  const selected = mailboxes.find((mailbox) => mailbox.id === selectedId) ?? mailboxes[0]
  const selectedStatus = describe(selected)

  return (
    <div ref={containerRef} className="relative">
      <label
        id="mailbox-selector-label"
        className="mb-1.5 block text-xs font-medium text-slate-600"
      >
        Mailbox
      </label>

      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-labelledby="mailbox-selector-label"
        className="flex w-full min-w-72 items-center gap-2.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-left text-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 sm:w-auto"
      >
        <Mail className="size-4 shrink-0 text-slate-400" aria-hidden="true" />

        <span className="min-w-0 flex-1 truncate font-medium text-slate-900">
          {selected?.emailAddress ?? selected?.displayName ?? 'Select a mailbox'}
        </span>

        <span className="flex shrink-0 items-center gap-1.5 text-xs text-slate-500">
          <span className={`size-2 rounded-full ${selectedStatus.dot}`} aria-hidden="true" />
          {selectedStatus.label}
        </span>

        <ChevronDown className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
      </button>

      {isOpen && (
        <ul
          role="listbox"
          aria-labelledby="mailbox-selector-label"
          className="absolute z-20 mt-1.5 max-h-80 w-full min-w-72 overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
        >
          {mailboxes.map((mailbox) => {
            const status = describe(mailbox)
            const isSelected = mailbox.id === selected?.id

            return (
              <li key={mailbox.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onSelect(mailbox.id)
                    setIsOpen(false)
                  }}
                  className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-slate-50 ${
                    isSelected ? 'bg-brand-50/60' : ''
                  }`}
                >
                  <span className={`size-2 shrink-0 rounded-full ${status.dot}`} aria-hidden="true" />

                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-slate-900">
                      {mailbox.emailAddress ?? mailbox.displayName ?? 'Microsoft mailbox'}
                    </span>
                    <span className="block text-xs text-slate-500">
                      {status.label}
                      {/* Stated, never changed from here — see the note above. */}
                      {mailbox.isDefault && ' · Default sender'}
                    </span>
                  </span>

                  {isSelected && (
                    <Check className="size-4 shrink-0 text-brand-600" aria-hidden="true" />
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default MailboxSelector
