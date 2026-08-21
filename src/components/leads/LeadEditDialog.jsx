/**
 * The whole enquiry in one form: the enquiry itself, its contact, its company.
 *
 * ## One component, both panels
 *
 * The CRM's detail page and the console's detail page render this same dialog
 * against the same endpoint. Two implementations would drift — one would gain a
 * field, or a different idea of what "saved" means — and the console's copy is
 * exactly the "admin-only fake form" worth avoiding.
 *
 * ## The contact and company are shared records
 *
 * They are not embedded in the enquiry; they are separate documents that other
 * enquiries may point at. Editing them here edits the shared record, so the
 * form says so rather than letting somebody discover it afterwards.
 *
 * ## Only sections that exist
 *
 * An enquiry imported without a company has nothing to edit, and a disabled
 * section explaining that is more honest than inputs that save nowhere. The
 * section is omitted and a line says why.
 */

import { useState } from 'react'

import { AdminModal } from '@/admin/components/AdminModal'
import { Button } from '@/components/ui/Button'
import { LEAD_STAGES } from '@/constants/lead.constants'

/** An ISO instant as the `yyyy-mm-dd` a date input expects. */
const asDateInput = (value) => (value ? new Date(value).toISOString().slice(0, 10) : '')

const INPUT =
  'mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100'

/**
 * The enquiry's own fields — exactly what `updateLeadSchema` accepts.
 *
 * Reference, market and query date are absent because the API does not accept
 * them: the reference is the business key, the market drives the reference
 * series, and both are set at import. An input the server silently discards
 * would be worse than no input.
 */
const LEAD_FIELDS = [
  { field: 'travelDate', label: 'Travel date', type: 'date' },
  {
    field: 'travelDateText',
    label: 'Travel date (as written)',
    hint: 'Used when the sheet gives a period rather than a date, such as "August".',
  },
  { field: 'city', label: 'Departure city' },
  { field: 'paxText', label: 'Party' },
  { field: 'adultCount', label: 'Adults', type: 'number', min: 0 },
  { field: 'childCount', label: 'Children', type: 'number', min: 0 },
  { field: 'handledBy', label: 'Handled by' },
]

/** Contact fields, from the contacts module's own validator. */
const CONTACT_FIELDS = [
  { field: 'displayName', label: 'Contact name' },
  { field: 'jobTitle', label: 'Job title' },
  { field: 'primaryEmail', label: 'Email', type: 'email' },
  { field: 'secondaryEmail', label: 'Secondary email', type: 'email' },
  { field: 'phone', label: 'Phone' },
  { field: 'mobile', label: 'Mobile' },
  { field: 'city', label: 'City' },
  { field: 'country', label: 'Country' },
]

/** Company fields, from `companyUpdateSchema`. */
const COMPANY_FIELDS = [
  { field: 'companyName', label: 'Company name' },
  { field: 'companyCode', label: 'Company code' },
  { field: 'email', label: 'Email', type: 'email' },
  { field: 'phone', label: 'Phone' },
  { field: 'website', label: 'Website' },
  { field: 'city', label: 'City' },
  { field: 'state', label: 'State' },
  { field: 'country', label: 'Country' },
  { field: 'gstNumber', label: 'GST number' },
]

/** Reads a section's current values off a record, as form strings. */
function draftFrom(record, fields) {
  if (!record) return null
  const draft = {}
  for (const { field, type } of fields) {
    const value = record[field]
    draft[field] = type === 'date' ? asDateInput(value) : (value ?? '')
  }
  return draft
}

/** Only what the reader actually changed, so an untouched field is not sent. */
function changesIn(draft, original, fields) {
  if (!draft || !original) return null
  const changed = {}
  for (const { field, type } of fields) {
    const before = type === 'date' ? asDateInput(original[field]) : (original[field] ?? '')
    const now = draft[field]
    if (String(now) === String(before)) continue
    if (type === 'number') changed[field] = now === '' ? null : Number(now)
    else changed[field] = now === '' ? null : now
  }
  return Object.keys(changed).length > 0 ? changed : null
}

function Section({ title, description, children }) {
  return (
    <section className="border-t border-slate-100 pt-4 first:border-0 first:pt-0">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
      <div className="mt-3 grid gap-x-5 gap-y-3 sm:grid-cols-2">{children}</div>
    </section>
  )
}

function Fields({ fields, draft, onChange }) {
  return fields.map(({ field, label, type = 'text', hint, min }) => (
    <div key={field}>
      <label htmlFor={`edit-${field}`} className="block text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </label>
      <input
        id={`edit-${field}`}
        type={type}
        min={min}
        value={draft[field]}
        onChange={(event) => onChange(field, event.target.value)}
        className={INPUT}
      />
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  ))
}

/**
 * @param {{
 *   isOpen: boolean,
 *   onClose: () => void,
 *   lead: object,
 *   contact: ?object,
 *   company: ?object,
 *   onSave: (payload: object) => Promise<object|null>,
 *   isSaving?: boolean,
 *   error?: ?object,
 * }} props
 *   `onSave` receives `{ lead?, contact?, company? }` and resolves to the
 *   response, or to null when the save failed — the caller owns the request so
 *   this component stays the form and nothing else.
 */
export function LeadEditDialog({ isOpen, onClose, lead, contact, company, onSave, isSaving = false, error = null }) {
  const [leadDraft, setLeadDraft] = useState(() => draftFrom(lead, LEAD_FIELDS) ?? {})
  const [stage, setStage] = useState(lead?.stage ?? '')
  const [notes, setNotes] = useState(lead?.internalNotes ?? '')
  const [contactDraft, setContactDraft] = useState(() => draftFrom(contact, CONTACT_FIELDS))
  const [companyDraft, setCompanyDraft] = useState(() => draftFrom(company, COMPANY_FIELDS))

  if (!isOpen || !lead) return null

  const field = (setter) => (name, value) => setter((current) => ({ ...current, [name]: value }))

  const submit = async (event) => {
    event.preventDefault()

    const leadChanges = changesIn(leadDraft, lead, LEAD_FIELDS) ?? {}
    if (stage !== lead.stage) {
      leadChanges.stage = stage
      leadChanges.stageReason = 'Changed on the enquiry page'
    }
    if (notes !== (lead.internalNotes ?? '')) leadChanges.internalNotes = notes === '' ? null : notes

    const payload = {}
    if (Object.keys(leadChanges).length > 0) payload.lead = leadChanges

    const contactChanges = changesIn(contactDraft, contact, CONTACT_FIELDS)
    if (contactChanges) payload.contact = contactChanges

    const companyChanges = changesIn(companyDraft, company, COMPANY_FIELDS)
    if (companyChanges) payload.company = companyChanges

    // Nothing touched: close rather than sending a request the server would
    // reject for having no sections.
    if (Object.keys(payload).length === 0) {
      onClose()
      return
    }

    const result = await onSave(payload)
    // On failure the dialog stays open with everything typed still in it.
    if (result) onClose()
  }

  return (
    <AdminModal
      isOpen={isOpen}
      onClose={isSaving ? () => {} : onClose}
      title="Edit lead"
      description={lead.reference}
      size="lg"
      busy={isSaving}
      footer={
        <>
          <Button type="button" variant="ghost" size="sm" disabled={isSaving} onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="lead-edit-form" size="sm" isLoading={isSaving} disabled={isSaving}>
            Save changes
          </Button>
        </>
      }
    >
      <form id="lead-edit-form" onSubmit={submit} className="space-y-5">
        {error && (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-inset ring-rose-200">
            {error.message ?? 'That could not be saved.'}
          </p>
        )}

        <Section title="Enquiry" description="Reference, destination, company and contact links are set at import.">
          <Fields fields={LEAD_FIELDS} draft={leadDraft} onChange={field(setLeadDraft)} />

          <div>
            <label htmlFor="edit-stage" className="block text-xs font-medium uppercase tracking-wide text-slate-500">
              Stage
            </label>
            <select
              id="edit-stage"
              value={stage}
              onChange={(event) => setStage(event.target.value)}
              className={INPUT}
            >
              {LEAD_STAGES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </Section>

        <Section
          title="Contact"
          description={
            contactDraft
              ? 'This is a shared address-book record. Other enquiries for the same person will show these changes.'
              : undefined
          }
        >
          {contactDraft ? (
            <Fields fields={CONTACT_FIELDS} draft={contactDraft} onChange={field(setContactDraft)} />
          ) : (
            <p className="text-sm text-slate-500 sm:col-span-2">
              This enquiry is not linked to a contact record, so there is nothing to edit here.
            </p>
          )}
        </Section>

        <Section
          title="Company"
          description={
            companyDraft
              ? 'This is a shared company record. Other enquiries for the same company will show these changes.'
              : undefined
          }
        >
          {companyDraft ? (
            <Fields fields={COMPANY_FIELDS} draft={companyDraft} onChange={field(setCompanyDraft)} />
          ) : (
            <p className="text-sm text-slate-500 sm:col-span-2">
              This enquiry is not linked to a company record, so there is nothing to edit here.
            </p>
          )}
        </Section>

        <Section title="Internal notes">
          <div className="sm:col-span-2">
            <label htmlFor="edit-notes" className="block text-xs font-medium uppercase tracking-wide text-slate-500">
              Remarks
            </label>
            <textarea
              id="edit-notes"
              rows={4}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className={INPUT}
            />
            <p className="mt-1 text-xs text-slate-400">Never sent to the customer.</p>
          </div>
        </Section>
      </form>
    </AdminModal>
  )
}

export default LeadEditDialog
