/**
 * Manual enquiry entry.
 *
 * The form the office uses when a lead arrives by phone or email rather than in
 * the morning workbook. Every field here maps to a column the workbook importer
 * already supports; none is invented, and the page holds no parsing of its own.
 *
 * ## Why nothing is parsed in the browser
 *
 * Dates, phone numbers and party sizes are sent as the user typed them. The
 * server hands the whole form to `validateLeadRow` — the importer's validator —
 * so `04/08/2026` is read day-first, `2A + 2C` becomes two adults and two
 * children, and a cell holding two phone numbers keeps both. Parsing any of it
 * here would create a second interpretation that disagrees with an upload of
 * the same values, which is the one thing this phase must not do.
 *
 * The placeholders show the shapes the importer understands, so the rules are
 * discoverable without being duplicated.
 */

import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Check, Info, Save } from 'lucide-react'

import { createLead, fetchNextReference } from '@/api/services/lead.service'
import { Button } from '@/components/ui/Button'
import { LEAD_STAGES } from '@/constants/lead.constants'
import { ROUTE_PATHS } from '@/routes/paths'
import { isCancelledError } from '@/utils/apiError'

/** Markets a lead can be filed under. Mirrors `MARKET` on the server. */
const MARKET_OPTIONS = Object.freeze([
  { value: 'AU', label: 'Australia' },
  { value: 'NZ', label: 'New Zealand' },
  { value: 'OTHER', label: 'Other' },
])

const EMPTY_FORM = Object.freeze({
  reference: '',
  market: 'AU',
  companyName: '',
  contactPerson: '',
  email: '',
  phone: '',
  city: '',
  quoteDate: '',
  travelDate: '',
  pax: '',
  handledBy: '',
  stage: 'active',
  notes: '',
})

/** One labelled control. Keeps the twelve fields below visually identical. */
function Field({ id, label, hint, required = false, error, children }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="ml-0.5 text-rose-600">*</span>}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-xs text-rose-600">{error}</p>
      ) : (
        hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>
      )}
    </div>
  )
}

const INPUT_CLASS =
  'mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ' +
  'focus:border-blue-500 focus:ring-2 focus:ring-blue-100'

export function LeadCreatePage() {
  const navigate = useNavigate()

  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [sendMail, setSendMail] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})
  const [suggested, setSuggested] = useState('')

  const set = useCallback((key) => (event) => {
    const { value } = event.target
    setForm((current) => ({ ...current, [key]: value }))
    // Clearing on edit stops a stale message sitting under a field the user has
    // already corrected.
    setFieldErrors((current) => (current[key] ? { ...current, [key]: undefined } : current))
  }, [])

  /**
   * The reference the server would allocate, shown as the placeholder.
   *
   * Re-fetched when the market changes, because each market continues its own
   * series. Purely informational — leaving the field empty is what actually
   * allocates one, and the server allocates it again at save time so two people
   * with the form open cannot both take the same number.
   */
  useEffect(() => {
    const controller = new AbortController()

    fetchNextReference({ market: form.market }, { signal: controller.signal })
      .then((result) => setSuggested(result?.reference ?? ''))
      .catch((caught) => {
        if (isCancelledError(caught) || controller.signal.aborted) return
        // A failed suggestion is not worth surfacing: the field still works,
        // and the server allocates on save regardless.
        setSuggested('')
      })

    return () => controller.abort()
  }, [form.market])

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault()

      setIsSaving(true)
      setError(null)
      setFieldErrors({})

      try {
        const result = await createLead({ ...form, sendMail })

        navigate(ROUTE_PATHS.LEAD_DETAIL.replace(':id', result.lead.id), {
          state: {
            notice: result.mail?.sent
              ? `Lead ${result.lead.reference} created. The introduction has been sent.`
              : `Lead ${result.lead.reference} created.`,
            warnings: result.warnings ?? [],
          },
        })
      } catch (caught) {
        setError(caught)

        // The server returns field-level detail for validation failures; map it
        // onto the inputs so the user is told where the problem is.
        const fields = caught?.details?.fields ?? []
        if (fields.length > 0) {
          setFieldErrors(
            Object.fromEntries(fields.map((entry) => [entry.field, entry.message])),
          )
        }

        setIsSaving(false)
      }
    },
    [form, sendMail, navigate],
  )

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* --- Header ------------------------------------------------------- */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button as={Link} to={ROUTE_PATHS.LEADS} variant="secondary" size="sm">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to leads
        </Button>
      </div>

      {error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-inset ring-rose-200"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {error?.message ?? 'The lead could not be created.'}
        </p>
      )}

      {/* --- Identity ------------------------------------------------------ */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-slate-900">Enquiry</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          The reference is the business key. Leave it empty and the next one in the series is
          allocated automatically.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field
            id="lead-reference"
            label="Reference"
            hint={suggested ? `Leave empty to use ${suggested}` : 'Leave empty to allocate the next one'}
            error={fieldErrors.reference}
          >
            <input
              id="lead-reference"
              value={form.reference}
              onChange={set('reference')}
              placeholder={suggested || 'Auto'}
              autoComplete="off"
              className={`${INPUT_CLASS} font-mono uppercase`}
            />
          </Field>

          <Field id="lead-market" label="Destination" hint="Sets the reference series">
            <select id="lead-market" value={form.market} onChange={set('market')} className={INPUT_CLASS}>
              {MARKET_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>

          <Field id="lead-stage" label="Status / Stage" hint="Where the enquiry sits in the pipeline">
            <select id="lead-stage" value={form.stage} onChange={set('stage')} className={INPUT_CLASS}>
              {LEAD_STAGES.map((stage) => (
                <option key={stage.value} value={stage.value}>
                  {stage.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </section>

      {/* --- Customer ------------------------------------------------------ */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-slate-900">Customer</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          The company and the contact are matched against the register and created only if they
          are genuinely new — the same matching an upload performs.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field
            id="lead-contact-person"
            label="Contact Person"
            required
            hint="A title is stripped — “Mr. Ramesh Iyer” files as Ramesh Iyer"
            error={fieldErrors.contactPerson}
          >
            <input
              id="lead-contact-person"
              value={form.contactPerson}
              onChange={set('contactPerson')}
              placeholder="Ramesh Iyer"
              className={INPUT_CLASS}
            />
          </Field>

          <Field
            id="lead-company"
            label="Company / Source"
            hint="The agency or firm the enquiry came through"
            error={fieldErrors.companyName}
          >
            <input
              id="lead-company"
              value={form.companyName}
              onChange={set('companyName')}
              placeholder="Tirupati Holidays"
              className={INPUT_CLASS}
            />
          </Field>

          <Field
            id="lead-email"
            label="Email"
            required
            hint="Two addresses in one field are both kept — separate with a comma"
            error={fieldErrors.email}
          >
            <input
              id="lead-email"
              type="text"
              value={form.email}
              onChange={set('email')}
              placeholder="ramesh@tirupatiholidays.com"
              className={INPUT_CLASS}
            />
          </Field>

          <Field
            id="lead-phone"
            label="Phone"
            hint="Several numbers are fine: “+91 98765 43210 ; 040 39555671”"
            error={fieldErrors.phone}
          >
            <input
              id="lead-phone"
              value={form.phone}
              onChange={set('phone')}
              placeholder="+91 98765 43210"
              className={INPUT_CLASS}
            />
          </Field>
        </div>
      </section>

      {/* --- Trip ---------------------------------------------------------- */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-slate-900">Trip</h2>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field id="lead-quote-date" label="Query Date" hint="dd/mm/yyyy" error={fieldErrors.quoteDate}>
            <input
              id="lead-quote-date"
              value={form.quoteDate}
              onChange={set('quoteDate')}
              placeholder="04/08/2026"
              className={INPUT_CLASS}
            />
          </Field>

          <Field
            id="lead-travel-date"
            label="Travel Date"
            hint="A date, or prose like “Low Season” — both are kept"
            error={fieldErrors.travelDate}
          >
            <input
              id="lead-travel-date"
              value={form.travelDate}
              onChange={set('travelDate')}
              placeholder="15/11/2026"
              className={INPUT_CLASS}
            />
          </Field>

          <Field id="lead-pax" label="Pax" hint="“2A + 2C”, “100 Pax”, “15-35 Pax”" error={fieldErrors.pax}>
            <input
              id="lead-pax"
              value={form.pax}
              onChange={set('pax')}
              placeholder="2A + 2C"
              className={INPUT_CLASS}
            />
          </Field>

          <Field id="lead-city" label="City" hint="Departure city" error={fieldErrors.city}>
            <input
              id="lead-city"
              value={form.city}
              onChange={set('city')}
              placeholder="Chennai"
              className={INPUT_CLASS}
            />
          </Field>

          <Field
            id="lead-handled-by"
            label="Handled By"
            hint="Initials or a name — a bare number is ignored"
            error={fieldErrors.handledBy}
          >
            <input
              id="lead-handled-by"
              value={form.handledBy}
              onChange={set('handledBy')}
              placeholder="RI"
              className={INPUT_CLASS}
            />
          </Field>
        </div>

        <div className="mt-4">
          <Field id="lead-notes" label="Notes" hint="Internal only — never sent to the customer">
            <textarea
              id="lead-notes"
              rows={3}
              value={form.notes}
              onChange={set('notes')}
              className={INPUT_CLASS}
            />
          </Field>
        </div>
      </section>

      {/* --- Automation ---------------------------------------------------- */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-slate-900">Automation</h2>

        <label className="mt-3 flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={sendMail}
            onChange={(event) => setSendMail(event.target.checked)}
            className="mt-0.5 size-4 rounded border-slate-300"
          />
          <span>
            <span className="block text-sm font-medium text-slate-800">
              Send the introduction email
            </span>
            <span className="block text-xs text-slate-500">
              Uses the ACTIVE email template and the connected mailbox — the same engine the
              morning workbook run uses. A customer is never introduced twice.
            </span>
          </span>
        </label>

        {!sendMail && (
          <p className="mt-3 flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            The lead is created and stays owed an introduction. You can send it later from the
            enquiry.
          </p>
        )}
      </section>

      {/* --- Actions ------------------------------------------------------- */}
      <div className="flex items-center justify-end gap-3">
        <Button as={Link} to={ROUTE_PATHS.LEADS} variant="secondary" disabled={isSaving}>
          Cancel
        </Button>
        <Button type="submit" isLoading={isSaving} loadingLabel="Creating…" size="lg">
          {sendMail ? <Save className="size-4" aria-hidden="true" /> : <Check className="size-4" aria-hidden="true" />}
          Create lead
        </Button>
      </div>
    </form>
  )
}

export default LeadCreatePage
