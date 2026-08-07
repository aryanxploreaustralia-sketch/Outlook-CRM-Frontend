/**
 * The confirmation for deleting every lead.
 *
 * Two barriers, because an accidental click here costs the whole register:
 * a modal that states exactly what will go, and a typed confirmation. The
 * delete button stays disabled until the word matches exactly — an "are you
 * sure?" with a live button is a button people click without reading.
 */

import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Trash2, X } from 'lucide-react'

import { Button } from '@/components/ui/Button'

/** The word the user must type. Case-sensitive, deliberately. */
const CONFIRMATION_WORD = 'DELETE'

/**
 * @param {{ isOpen: boolean, counts: ?object, isDeleting: boolean, error: ?string,
 *           onCancel: () => void, onConfirm: () => void }} props
 */
export function DeleteAllLeadsDialog({ isOpen, counts, isDeleting, error, onCancel, onConfirm }) {
  const [typed, setTyped] = useState('')
  const inputRef = useRef(null)

  // The word is cleared whenever the dialog opens, so a previous confirmation
  // can never carry over and arm the button before it is read.
  useEffect(() => {
    if (isOpen) {
      setTyped('')
      // Focus after paint, or the field is not yet in the document.
      const timer = setTimeout(() => inputRef.current?.focus(), 0)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [isOpen])

  // Escape cancels, as it does everywhere else in the product.
  useEffect(() => {
    if (!isOpen) return undefined

    const onKey = (event) => {
      if (event.key === 'Escape' && !isDeleting) onCancel()
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, isDeleting, onCancel])

  if (!isOpen) return null

  const isArmed = typed === CONFIRMATION_WORD && !isDeleting
  const leadCount = counts?.leads ?? null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-all-title"
    >
      {/* Scrim. Clicking it cancels, but never mid-delete. */}
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={() => !isDeleting && onCancel()}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl">
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-rose-50">
              <AlertTriangle className="size-5 text-rose-600" aria-hidden="true" />
            </span>
            <div>
              <h2 id="delete-all-title" className="text-base font-semibold text-slate-900">
                Delete All Leads
              </h2>
              <p className="mt-0.5 text-sm text-slate-500">This cannot be undone.</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            aria-label="Cancel"
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </header>

        <div className="space-y-4 px-5 py-4">
          <p className="text-sm text-slate-700">
            You are about to permanently delete{' '}
            {leadCount === null ? (
              'all Lead records'
            ) : (
              <strong>{leadCount.toLocaleString()} lead record(s)</strong>
            )}
            . This action cannot be undone.
          </p>

          {/*
            What survives is stated explicitly. The most common fear about a
            button like this is that it takes the Microsoft connection or the
            customer correspondence with it, and answering that up front is
            faster than making someone go and check.
          */}
          <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600 ring-1 ring-inset ring-slate-200">
            <p className="font-medium text-slate-700">Not affected:</p>
            <p className="mt-1">
              Companies, contacts, campaigns, mail history, conversations, import history, your
              Microsoft connection and your sign-in.
            </p>
          </div>

          {counts && (counts.timelineEntries > 0 || counts.tasks > 0 || counts.conversationsToUnlink > 0) && (
            <p className="text-xs text-slate-500">
              {counts.timelineEntries > 0 && `${counts.timelineEntries.toLocaleString()} timeline entries`}
              {counts.timelineEntries > 0 && counts.tasks > 0 && ', '}
              {counts.tasks > 0 && `${counts.tasks.toLocaleString()} task(s)`}
              {(counts.timelineEntries > 0 || counts.tasks > 0) && ' will go with them.'}
              {counts.conversationsToUnlink > 0 && (
                <>
                  {' '}
                  {counts.conversationsToUnlink.toLocaleString()} conversation(s) will be kept but
                  will no longer be linked to an enquiry.
                </>
              )}
            </p>
          )}

          <div>
            <label htmlFor="delete-confirm" className="block text-sm font-medium text-slate-700">
              Type <span className="font-mono font-semibold">{CONFIRMATION_WORD}</span> to continue.
            </label>
            <input
              id="delete-confirm"
              ref={inputRef}
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && isArmed) onConfirm()
              }}
              disabled={isDeleting}
              autoComplete="off"
              spellCheck={false}
              aria-describedby="delete-confirm-hint"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-100 disabled:bg-slate-50"
            />
            <p id="delete-confirm-hint" className="mt-1 text-xs text-slate-400">
              {typed.length === 0
                ? 'The delete button stays disabled until this matches exactly.'
                : isArmed || typed === CONFIRMATION_WORD
                  ? 'Confirmed.'
                  : 'Does not match yet.'}
            </p>
          </div>

          {error && (
            <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-inset ring-rose-200">
              {error}
            </p>
          )}
        </div>

        <footer className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">
          <Button variant="secondary" onClick={onCancel} disabled={isDeleting}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={!isArmed} isLoading={isDeleting}>
            <Trash2 className="size-4" aria-hidden="true" />
            Delete All
          </Button>
        </footer>
      </div>
    </div>
  )
}

export default DeleteAllLeadsDialog
