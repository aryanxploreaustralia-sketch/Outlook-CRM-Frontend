/**
 * Travel sales vocabulary, mirrored from the backend.
 *
 * The strings are the API contract — `backend/src/modules/leads/constants/
 * leadConstants.js` is authoritative and these must not drift. Kept here rather
 * than fetched so a stage badge renders before any request completes.
 */

/** Pipeline stages in board order. */
export const LEAD_STAGES = Object.freeze([
  { value: 'new', label: 'New', eligible: true },
  { value: 'quoted', label: 'Quoted', eligible: true },
  { value: 'follow_up', label: 'Follow Up', eligible: true },
  { value: 'interested', label: 'Interested', eligible: true },
  { value: 'negotiation', label: 'Negotiation', eligible: true },
  { value: 'visa_process', label: 'Visa Process', eligible: false },
  { value: 'booked', label: 'Booked', eligible: false },
  { value: 'completed', label: 'Completed', eligible: false },
  { value: 'cancelled', label: 'Cancelled', eligible: false },
  { value: 'lost', label: 'Lost', eligible: false },
])

/**
 * Badge styling per stage.
 *
 * Colour carries meaning: slate is untouched, blue is in flight, amber is
 * waiting on the customer, violet is paperwork, green is won, red is dead. A
 * salesperson scanning fifty rows reads the colour before the word.
 */
export const LEAD_STAGE_STYLES = Object.freeze({
  new: { label: 'New', className: 'bg-slate-100 text-slate-700 ring-slate-200' },
  quoted: { label: 'Quoted', className: 'bg-sky-50 text-sky-700 ring-sky-200' },
  follow_up: { label: 'Follow Up', className: 'bg-amber-50 text-amber-700 ring-amber-200' },
  interested: { label: 'Interested', className: 'bg-blue-50 text-blue-700 ring-blue-200' },
  negotiation: { label: 'Negotiation', className: 'bg-indigo-50 text-indigo-700 ring-indigo-200' },
  visa_process: { label: 'Visa Process', className: 'bg-violet-50 text-violet-700 ring-violet-200' },
  booked: { label: 'Booked', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  completed: { label: 'Completed', className: 'bg-emerald-100 text-emerald-800 ring-emerald-300' },
  cancelled: { label: 'Cancelled', className: 'bg-rose-50 text-rose-700 ring-rose-200' },
  lost: { label: 'Lost', className: 'bg-rose-100 text-rose-800 ring-rose-300' },
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
