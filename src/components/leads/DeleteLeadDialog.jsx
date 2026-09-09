/**
 * Confirms deleting one enquiry.
 *
 * ## Why this is not `DeleteAllLeadsDialog`
 *
 * That dialog guards a purge of the entire register and makes the reader type a
 * word before the button arms. That friction is right for an irreversible bulk
 * action and wrong here: deleting one enquiry is an ordinary, expected part of
 * working the list, and a typing gate on every row would train people to
 * dismiss the safeguard that matters.
 *
 * So this asks once, plainly, and keeps the same visual shell — same scrim,
 * same panel, same rose warning mark — so the two read as members of one family
 * rather than two different products.
 *
 * ## What it does not claim
 *
 * The server soft-deletes: `lead.isDeleted = true`, and the record stays in the
 * database with its audit entry. So the wording says the enquiry is removed
 * from the register, not that it is destroyed — the reader is not promised an
 * erasure the CRM does not perform.
 */

import { useEffect } from 'react'
import { AlertTriangle, X } from 'lucide-react'

/**
 * @param {object}    props
 * @param {boolean}   props.isOpen
 * @param {?object}   props.lead       The enquiry being deleted, for naming it.
 * @param {boolean}   props.isDeleting
 * @param {?string}   props.error
 * @param {Function}  props.onCancel
 * @param {Function}  props.onConfirm
 */
export function DeleteLeadDialog({ isOpen, lead, isDeleting, error, onCancel, onConfirm }) {
  // Escape cancels, as it does everywhere else in the product — but never
  // mid-delete, when the request is already in flight.
  useEffect(() => {
    if (!isOpen) return undefined

    const onKey = (event) => {
      if (event.key === 'Escape' && !isDeleting) onCancel()
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, isDeleting, onCancel])

  if (!isOpen) return null

  /*
   * Named where possible.
   *
   * A confirmation that says only "this lead" asks somebody to trust that the
   * row they clicked is the row the dialog holds. Showing the reference — and
   * the contact, when there is one — lets them check rather than trust.
   */
  const reference = lead?.reference ?? null
  const who = lead?.contactPerson || lead?.companyName || null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-lead-title"
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
              <h2 id="delete-lead-title" className="text-base font-semibold text-slate-900">
                Delete this lead?
              </h2>
              <p className="mt-0.5 text-sm text-slate-500">
                It will be removed from the register.
              </p>
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

        <div className="space-y-3 px-5 py-4">
          <p className="text-sm text-slate-700">
            {reference ? (
              <>
                Enquiry <strong className="font-mono">{reference}</strong>
                {who ? (
                  <>
                    {' '}for <strong>{who}</strong>
                  </>
                ) : null}{' '}
                will be removed from the register.
              </>
            ) : (
              'This enquiry will be removed from the register.'
            )}
          </p>

          {/*
            The same reassurance the bulk dialog gives, for the same reason: the
            first question anybody asks is whether the company and the
            correspondence go with it. They do not.
          */}
          <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600 ring-1 ring-inset ring-slate-200">
            The company, contact and any mail history are not affected.
          </p>

          {error && (
            <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </p>
          )}
        </div>

        <footer className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-300 transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            // Disabled while the request is in flight, so a second click cannot
            // send a second delete. The handler guards this too.
            disabled={isDeleting}
            className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isDeleting ? 'Deleting…' : 'Delete'}
          </button>
        </footer>
      </div>
    </div>
  )
}

export default DeleteLeadDialog
