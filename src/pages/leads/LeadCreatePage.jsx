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

import { createLead, fetchLeadAssignees, fetchNextReference } from '@/api/services/lead.service'
import { Button } from '@/components/ui/Button'
import { LEAD_STAGES, MARKETS } from '@/constants/lead.constants'
import { ROUTE_PATHS } from '@/routes/paths'
import { isCancelledError } from '@/utils/apiError'

/*
 * Destinations a lead can be filed under.
 *
 * Derived from the shared list rather than restated. It was a second copy, and
 * a second copy is how "Other" survived here after it was removed elsewhere.
 * The blank "all" row is dropped: this is a required choice, not a filter.
 */
const MARKET_OPTIONS = MARKETS.filter((market) => market.value)

const EMPTY_FORM = Object.freeze({
  reference: '',
  market: 'AU',
  companyName: '',
  /** The agent's own city. Stored on the company, not on the enquiry. */
  agentCity: '',
  contactPerson: '',
  email: '',
  phone: '',
  city: '',
  quoteDate: '',
  travelDate: '',
  pax: '',
  handledBy: '',
  stage: 'active',
  /** "From" — where the enquiry came from. */
  source: '',
  /*
   * The manager who will hold the enquiry. An id, not a name.
   *
   * Empty means "keep it myself", which is what this form did before and what
   * a manager creating their own enquiry still wants.
   */
  assignTo: '',
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

  /**
   * The managers this enquiry may be assigned to.
   *
   * Loaded once. An empty list is not an error: a deployment with no active
   * manager simply cannot assign, and the control says so rather than offering
   * a dropdown with nothing in it.
   */
  const [managers, setManagers] = useState([])
  useEffect(() => {
    const controller = new AbortController()

    fetchLeadAssignees({ signal: controller.signal })
      .then((data) => setManagers(data?.items ?? []))
      // A failed lookup costs the assignment, not the form: the field falls
      // back to "keep it myself", which is what it did before this existed.
      .catch(() => setManagers([]))

    return () => controller.abort()
  }, [])

  const set = useCallback((key) => (event) => {
    const { value } = event.target
    setForm((current) => ({ ...current, [key]: value }))
    // Clearing on edit stops a stale message sitting under a field the user has
    // already corrected.
    setFieldErrors((current) => (current[key] ? { ...current, [key]: undefined } : current))
  }, [])

  /**
   * The reference the server would allocate, shown as the placeholder.
   * The reference is allocated on-save so the user can leave it empty and still get one.
   * The placeholder is purely informational - it is not a default value and does not get sent to the server.
   * The server allocates a new reference on save, so two people with the form open cannot both take the same number.
   * The placeholder is re-fetched when the market changes, because each market continues its own series.
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

        const assignedElsewhere = Boolean(form.assignTo)
        const manager = managers.find((option) => option.id === form.assignTo)
        const sent = result.mail?.sent ? ' The introduction has been sent.' : ''

        /*
         * An assigned enquiry belongs to the manager from the moment it is
         * saved, and `GET /leads/:id` is owner-scoped — so sending its creator
         * to the detail page would hand them a 404 for the record they just
         * made. They go back to the register instead, told where it went.
         */
        navigate(
          assignedElsewhere
            ? ROUTE_PATHS.LEADS
            : ROUTE_PATHS.LEAD_DETAIL.replace(':id', result.lead.id),
          {
            state: {
              notice: assignedElsewhere
                ? `Lead ${result.lead.reference} created and assigned to ${manager?.name ?? 'the selected manager'}.${sent}`
                : `Lead ${result.lead.reference} created.${sent}`,
              warnings: result.warnings ?? [],
            },
          },
        )
      } catch (caught) {
        setError(caught)

        /*
         * The server returns field-level detail for validation failures; map it
         * onto the inputs so the user is told where the problem is.
         *
         * `details` *is* the array. This read `details.fields`, which is always
         * undefined — so every validation failure fell back to an empty list
         * and the page showed only the generic banner with nothing marked. A
         * rejection whose cause is on screen but unattributed is the hardest
         * kind to act on, and it is what made the `assignTo` defect above look
         * like an unexplained refusal.
         *
         * `Array.isArray` rather than a bare `??`: a 4xx that carries an object
         * in `details` — the mail routes send `{ reason }` — must not be spread
         * into field errors.
         */
        const fields = Array.isArray(caught?.details) ? caught.details : []
        if (fields.length > 0) {
          setFieldErrors(
            Object.fromEntries(fields.map((entry) => [entry.field, entry.message])),
          )
        }

        setIsSaving(false)
      }
    },
    [form, sendMail, navigate, managers],
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

      {/*
        The register's fields, in the order the sales team reads them — the
        order of the workbook this CRM was built around, which is why an
        enquiry typed here and one imported from a sheet describe the same
        thing in the same sequence.
      */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-slate-900">Enquiry</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          The travel agent and the contact are matched against the register and created only if
          they are genuinely new — the same matching an upload performs.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* 1 */}
          <Field id="lead-quote-date" label="Q Date" hint="dd/mm/yyyy" error={fieldErrors.quoteDate}>
            <input id="lead-quote-date" type="date" value={form.quoteDate} onChange={set('quoteDate')} className={INPUT_CLASS} />
          </Field>

          {/* 2 — a free date, because the sheet often gives a period instead. */}
          <Field
            id="lead-travel-date"
            label="Travel Date"
            hint="A date, or a period such as “August”"
            error={fieldErrors.travelDate}
          >
            <input id="lead-travel-date" value={form.travelDate} onChange={set('travelDate')} className={INPUT_CLASS} />
          </Field>

          {/* 3 */}
          <Field id="lead-city" label="City" hint="Departure city of the travellers" error={fieldErrors.city}>
            <input id="lead-city" value={form.city} onChange={set('city')} className={INPUT_CLASS} />
          </Field>

          {/* 4 */}
          <Field
            id="lead-company-name"
            label="Travel Agent"
            hint="Matched against the company register"
            error={fieldErrors.companyName}
          >
            <input id="lead-company-name" value={form.companyName} onChange={set('companyName')} className={INPUT_CLASS} />
          </Field>

          {/* 5 — the agent's city, kept apart from the travellers' city above. */}
          <Field id="lead-agent-city" label="Agent City" hint="Saved on the agent's company record">
            <input id="lead-agent-city" value={form.agentCity} onChange={set('agentCity')} className={INPUT_CLASS} />
          </Field>

          {/* 6 */}
          <Field
            id="lead-contact-person"
            label="Contact Person"
            required
            error={fieldErrors.contactPerson}
          >
            <input id="lead-contact-person" value={form.contactPerson} onChange={set('contactPerson')} className={INPUT_CLASS} />
          </Field>

          {/* 7 */}
          <Field id="lead-email" label="Email ID" hint="Where the introduction is sent" error={fieldErrors.email}>
            <input id="lead-email" type="email" value={form.email} onChange={set('email')} autoComplete="off" className={INPUT_CLASS} />
          </Field>

          {/* 8 */}
          <Field id="lead-phone" label="Contact No" error={fieldErrors.phone}>
            <input id="lead-phone" value={form.phone} onChange={set('phone')} autoComplete="off" className={INPUT_CLASS} />
          </Field>

          {/* 9 */}
          <Field id="lead-pax" label="Pax" hint="“2A + 2C”, “100 Pax”, “15-35 Pax”" error={fieldErrors.pax}>
            <input id="lead-pax" value={form.pax} onChange={set('pax')} className={INPUT_CLASS} />
          </Field>

          {/* 10 — blank allocates the next in the series; see `suggested`. */}
          <Field
            id="lead-reference"
            label="Reference"
            hint={
              /*
               * The suggestion is drawn from *this* user's series, and an
               * assigned enquiry is numbered from the manager's — so once one is
               * chosen the number is not promised, only that one is allocated.
               */
              form.assignTo
                ? "Allocated from the assigned manager's series"
                : suggested
                  ? `Leave empty to use ${suggested}`
                  : 'Leave empty to allocate the next one'
            }
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

          {/* 11 */}
          <Field id="lead-handled-by" label="Handled By" hint="Sales executive initials" error={fieldErrors.handledBy}>
            <input id="lead-handled-by" value={form.handledBy} onChange={set('handledBy')} className={INPUT_CLASS} />
          </Field>

          {/*
            11b — assignment, next to Handled By because both answer "whose is
            this". They are different fields and deliberately so: `handledBy` is
            the sheet's free-text initials column, while this sets `owner`, the
            reference the whole CRM scopes on.
          */}
          <Field
            id="lead-assign-to"
            label="Assign To"
            hint={
              managers.length > 0
                ? 'Managers only. Leave empty to keep it yourself.'
                : 'No active manager to assign to — it stays with you.'
            }
            error={fieldErrors.assignTo}
          >
            <select
              id="lead-assign-to"
              value={form.assignTo}
              onChange={set('assignTo')}
              disabled={managers.length === 0}
              className={INPUT_CLASS}
            >
              <option value="">Keep it myself</option>
              {managers.map((manager) => (
                <option key={manager.id} value={manager.id}>
                  {manager.name}
                </option>
              ))}
            </select>
          </Field>

          {/* 12 */}
          <Field id="lead-stage" label="Status" hint="Where the enquiry sits in the pipeline">
            <select id="lead-stage" value={form.stage} onChange={set('stage')} className={INPUT_CLASS}>
              {LEAD_STAGES.map((stage) => (
                <option key={stage.value} value={stage.value}>
                  {stage.label}
                </option>
              ))}
            </select>
          </Field>

          {/* 13 */}
          <Field id="lead-source" label="From" hint="Website, referral, email, walk-in…">
            <input id="lead-source" value={form.source} onChange={set('source')} className={INPUT_CLASS} />
          </Field>

          {/*
            Not one of the fourteen, and not removable: the destination decides
            which reference series the enquiry is allocated from, so leaving it
            out would break reference numbering. It sits beside Reference for
            that reason.
          */}
          <Field id="lead-market" label="Destination" hint="Sets the reference series">
            <select id="lead-market" value={form.market} onChange={set('market')} className={INPUT_CLASS}>
              {MARKET_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {/* 14 — full width: remarks run long. */}
        <div className="mt-4">
          <Field id="lead-notes" label="Remark" hint="Internal only — never sent to the customer">
            <textarea id="lead-notes" rows={3} value={form.notes} onChange={set('notes')} className={INPUT_CLASS} />
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
