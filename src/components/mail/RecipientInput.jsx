/**
 * Chip-based recipient field.
 *
 * Addresses become discrete chips rather than staying as free text, which is
 * what makes a mistake visible *before* sending: a typo is a chip you can see
 * and remove, whereas a comma-separated string hides it until Graph rejects the
 * whole message.
 *
 * Committing happens on Enter, comma, semicolon, Tab and blur. Blur matters most
 * — a user who types an address and clicks Send directly would otherwise lose it,
 * which is the single most common way a naive chip input drops data.
 */

import { useCallback, useId, useRef, useState } from 'react'
import { X } from 'lucide-react'

/** Matches the server's rule closely enough to catch typos without rejecting valid addresses. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Characters that end an address while typing. */
const COMMIT_KEYS = new Set(['Enter', ',', ';', 'Tab'])

/**
 * @param {{
 *   id?: string,
 *   label: string,
 *   value: string[],
 *   onChange: (next: string[]) => void,
 *   placeholder?: string,
 *   maxRecipients?: number,
 *   autoFocus?: boolean,
 *   action?: import('react').ReactNode,
 * }} props
 */
export function RecipientInput({
  id,
  label,
  value,
  onChange,
  placeholder = 'name@company.com',
  maxRecipients = 100,
  autoFocus = false,
  action,
}) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const errorId = `${inputId}-error`

  const [draft, setDraft] = useState('')
  const [error, setError] = useState(null)
  const inputRef = useRef(null)

  /**
   * Validates and appends one address.
   *
   * @returns {boolean} True when the draft was consumed.
   */
  const commit = useCallback(
    (raw) => {
      const candidate = raw.trim().replace(/[,;]+$/, '')
      if (candidate === '') return true

      if (!EMAIL_PATTERN.test(candidate)) {
        setError(`“${candidate}” is not a valid email address.`)
        return false
      }

      const normalised = candidate.toLowerCase()

      // Silently ignored rather than treated as an error: re-adding an address
      // already on the list is a slip, not something to interrupt the user for.
      if (value.includes(normalised)) {
        setError(null)
        return true
      }

      if (value.length >= maxRecipients) {
        setError(`You can add at most ${maxRecipients} recipients.`)
        return false
      }

      onChange([...value, normalised])
      setError(null)
      return true
    },
    [value, onChange, maxRecipients],
  )

  const handleKeyDown = useCallback(
    (event) => {
      // Tab only commits when there is something to commit, so it still moves
      // focus normally on an empty field.
      if (event.key === 'Tab' && draft.trim() === '') return

      if (COMMIT_KEYS.has(event.key)) {
        event.preventDefault()
        if (commit(draft)) setDraft('')
        return
      }

      // Backspace on an empty field removes the last chip — the behaviour every
      // mail client has trained users to expect.
      if (event.key === 'Backspace' && draft === '' && value.length > 0) {
        onChange(value.slice(0, -1))
        setError(null)
      }
    },
    [draft, commit, value, onChange],
  )

  /** Splits a pasted list so copying addresses out of a spreadsheet works. */
  const handlePaste = useCallback(
    (event) => {
      const text = event.clipboardData.getData('text')
      if (!/[,;\s]/.test(text)) return

      event.preventDefault()

      const candidates = text.split(/[,;\s]+/).filter(Boolean)
      const accepted = []
      const rejected = []

      for (const candidate of candidates) {
        const normalised = candidate.trim().toLowerCase()
        if (!EMAIL_PATTERN.test(normalised)) {
          rejected.push(candidate)
        } else if (!value.includes(normalised) && !accepted.includes(normalised)) {
          accepted.push(normalised)
        }
      }

      const room = Math.max(0, maxRecipients - value.length)
      onChange([...value, ...accepted.slice(0, room)])

      // Rejects go back into the field so the user can fix them rather than
      // discovering later that some addresses vanished on paste.
      setDraft(rejected.join(', '))
      setError(
        rejected.length > 0 ? `${rejected.length} address(es) could not be recognised.` : null,
      )
    },
    [value, onChange, maxRecipients],
  )

  const remove = useCallback(
    (address) => {
      onChange(value.filter((entry) => entry !== address))
      setError(null)
    },
    [value, onChange],
  )

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label htmlFor={inputId} className="text-xs font-medium text-slate-600">
          {label}
          {value.length > 0 && (
            <span className="ml-1.5 font-normal text-slate-400">({value.length})</span>
          )}
        </label>
        {action}
      </div>

      {/* Clicking anywhere in the box focuses the input, so the whole control
          behaves like the single text field it appears to be. */}
      <div
        className={`flex flex-wrap items-center gap-1.5 rounded-lg border bg-white px-2 py-1.5 transition-colors focus-within:ring-2 focus-within:ring-brand-500/30 ${
          error ? 'border-red-300' : 'border-slate-300 focus-within:border-brand-500'
        }`}
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((address) => (
          <span
            key={address}
            className="inline-flex max-w-full items-center gap-1 rounded-md bg-slate-100 py-0.5 pl-2 pr-1 text-xs text-slate-700"
          >
            <span className="truncate">{address}</span>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                remove(address)
              }}
              className="grid size-4 shrink-0 place-items-center rounded text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700"
              aria-label={`Remove ${address}`}
            >
              <X className="size-3" aria-hidden="true" />
            </button>
          </span>
        ))}

        <input
          ref={inputRef}
          id={inputId}
          type="email"
          autoFocus={autoFocus}
          value={draft}
          placeholder={value.length === 0 ? placeholder : ''}
          onChange={(event) => {
            setDraft(event.target.value)
            if (error) setError(null)
          }}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          // The critical one: an uncommitted address is captured before focus
          // moves to the Send button.
          onBlur={() => {
            if (commit(draft)) setDraft('')
          }}
          className="min-w-[12rem] flex-1 border-0 bg-transparent py-0.5 text-sm text-slate-900 outline-none placeholder:text-slate-400"
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? errorId : undefined}
        />
      </div>

      {error && (
        <p id={errorId} role="alert" className="mt-1 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}

export default RecipientInput
