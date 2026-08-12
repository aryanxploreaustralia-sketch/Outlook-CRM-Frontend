/**
 * Travel sales vocabulary, mirrored from the backend.
 *
 * The strings are the API contract — `backend/src/modules/leads/constants/
 * leadConstants.js` is authoritative and these must not drift. Kept here rather
 * than fetched so a stage badge renders before any request completes.
 */

/**
 * The four lead stages, in board order.
 *
 * Mirrors `LEAD_STAGE` on the server, and the sales workbook's own `Status`
 * column, which is where all three get their vocabulary. `eligible` mirrors
 * `CAMPAIGN_ELIGIBLE_STAGES`: the server enforces it in the audience resolver,
 * and this copy only decides whether the badge says "no mail".
 *
 * Every dropdown, filter and badge in the application reads this list, so it is
 * the only place a stage is named.
 */
export const LEAD_STAGES = Object.freeze([
  { value: 'active', label: 'Active', eligible: true },
  { value: 'inactive', label: 'Inactive', eligible: true },
  { value: 'confirmed', label: 'Confirmed', eligible: false },
  { value: 'closed', label: 'Closed', eligible: false },
  /**
   * The agency or contact has stopped trading.
   *
   * `eligible: false` mirrors the server's `CAMPAIGN_ELIGIBLE_STAGES`, which
   * omits it: a business that no longer exists is the one audience a
   * re-engagement campaign must not reach. The server enforces that in the
   * audience resolver; this copy only decides whether the badge says "no mail".
   */
  { value: 'not_operating', label: 'Not operating', eligible: false },
  // `eligible` mirrors the server's CAMPAIGN_ELIGIBLE_STAGES, which does not
  // list it — so it is blocked from campaign mail by default. See the note in
  // the report if that should change.
  { value: 'query', label: 'Query', eligible: false },
])

/**
 * Badge styling per stage.
 *
 * Colour carries meaning: blue is live work, amber is waiting on the customer,
 * green is won, slate is finished. A salesperson scanning fifty rows reads the
 * colour before the word.
 */
export const LEAD_STAGE_STYLES = Object.freeze({
  active: { label: 'Active', className: 'bg-blue-50 text-blue-700 ring-blue-200' },
  inactive: { label: 'Inactive', className: 'bg-amber-50 text-amber-700 ring-amber-200' },
  confirmed: { label: 'Confirmed', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  closed: { label: 'Closed', className: 'bg-slate-100 text-slate-600 ring-slate-200' },
  // Rose, not red-as-error: the enquiry is not faulty, the counterparty is
  // gone. Distinct from `closed`'s neutral slate so the two do not read alike.
  not_operating: { label: 'Not operating', className: 'bg-rose-50 text-rose-700 ring-rose-200' },
  query: { label: 'Query', className: 'bg-sky-50 text-sky-700 ring-sky-200' },
})

/** Stages a campaign may target. Mirrors `CAMPAIGN_ELIGIBLE_STAGES`. */
export const CAMPAIGN_ELIGIBLE_STAGES = Object.freeze(
  LEAD_STAGES.filter((stage) => stage.eligible).map((stage) => stage.value),
)

export const MARKETS = Object.freeze([
  { value: '', label: 'All markets' },
  { value: 'AU', label: 'Australia' },
  { value: 'NZ', label: 'New Zealand' },
  { value: 'OTHER', label: 'Other' },
])

export const COMPANY_STATUS_STYLES = Object.freeze({
  active: { label: 'Active', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  dormant: { label: 'Dormant', className: 'bg-slate-100 text-slate-600 ring-slate-200' },
  blocked: { label: 'Blocked', className: 'bg-rose-50 text-rose-700 ring-rose-200' },
})

/** How a worksheet was classified, and how the wizard should present it. */
export const SHEET_KIND_STYLES = Object.freeze({
  leads: {
    label: 'Lead register',
    className: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    importable: true,
  },
  operations: {
    label: 'Hotel operations',
    className: 'bg-slate-100 text-slate-600 ring-slate-200',
    importable: false,
  },
  unknown: {
    label: 'Unrecognised',
    className: 'bg-amber-50 text-amber-700 ring-amber-200',
    importable: false,
  },
  empty: { label: 'Empty', className: 'bg-slate-100 text-slate-400 ring-slate-200', importable: false },
})

/** Fields a column can be mapped onto in the wizard. */
export const LEAD_FIELDS = Object.freeze([
  { value: 'reference', label: 'Reference (business key)' },
  // `value` is the stored field name and is part of the import mapping the API
  // receives — only the label is the user's wording.
  { value: 'quoteDate', label: 'Query Date' },
  { value: 'travelDate', label: 'Travel Date' },
  { value: 'city', label: 'Departure City' },
  { value: 'companyName', label: 'Company / Source' },
  { value: 'contactPerson', label: 'Contact Person' },
  { value: 'email', label: 'Email Address' },
  { value: 'phone', label: 'Contact Number' },
  { value: 'pax', label: 'Pax' },
  { value: 'handledBy', label: 'Handled By' },
  { value: 'stage', label: 'Status' },
  { value: 'notes', label: 'Remark' },
  { value: '__ignore__', label: '— Do not import —' },
])

/** The wizard's steps, in order. */
export const IMPORT_STEPS = Object.freeze([
  { id: 'upload', label: 'Upload' },
  { id: 'sheet', label: 'Choose sheet' },
  { id: 'mapping', label: 'Review mapping' },
  { id: 'preview', label: 'Preview' },
  { id: 'result', label: 'Result' },
])

export default LEAD_STAGES
