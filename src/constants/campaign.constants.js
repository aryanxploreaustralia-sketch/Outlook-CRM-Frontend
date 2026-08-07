/**
 * Campaign vocabulary, mirrored from the backend.
 *
 * The strings are the API contract — the backend's `campaignConstants.js` is
 * authoritative and these must not drift. Kept here rather than fetched so the
 * UI can render a status badge before any request completes.
 */

/** Lifecycle states, in the order the list filter offers them. */
export const CAMPAIGN_STATUS = Object.freeze({
  DRAFT: 'draft',
  SCHEDULED: 'scheduled',
  RUNNING: 'running',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  ARCHIVED: 'archived',
})

/**
 * Badge styling per status.
 *
 * Colour carries meaning here: green is finished, blue is in flight, amber is
 * waiting on a person, grey is inert, red is stopped. A user scanning twenty
 * rows reads the colour before the word.
 */
export const CAMPAIGN_STATUS_STYLES = Object.freeze({
  draft: { label: 'Draft', className: 'bg-slate-100 text-slate-700 ring-slate-200' },
  scheduled: { label: 'Scheduled', className: 'bg-violet-50 text-violet-700 ring-violet-200' },
  running: { label: 'Running', className: 'bg-blue-50 text-blue-700 ring-blue-200' },
  paused: { label: 'Paused', className: 'bg-amber-50 text-amber-700 ring-amber-200' },
  completed: { label: 'Completed', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  cancelled: { label: 'Cancelled', className: 'bg-rose-50 text-rose-700 ring-rose-200' },
  archived: { label: 'Archived', className: 'bg-slate-100 text-slate-500 ring-slate-200' },
})

export const RECIPIENT_STATUS_STYLES = Object.freeze({
  queued: { label: 'Queued', className: 'bg-slate-100 text-slate-600 ring-slate-200' },
  sending: { label: 'Sending', className: 'bg-blue-50 text-blue-700 ring-blue-200' },
  sent: { label: 'Sent', className: 'bg-sky-50 text-sky-700 ring-sky-200' },
  delivered: { label: 'Delivered', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  opened: { label: 'Opened', className: 'bg-teal-50 text-teal-700 ring-teal-200' },
  clicked: { label: 'Clicked', className: 'bg-indigo-50 text-indigo-700 ring-indigo-200' },
  replied: { label: 'Replied', className: 'bg-emerald-100 text-emerald-800 ring-emerald-300' },
  failed: { label: 'Failed', className: 'bg-rose-50 text-rose-700 ring-rose-200' },
  bounced: { label: 'Bounced', className: 'bg-rose-100 text-rose-800 ring-rose-300' },
  skipped: { label: 'Skipped', className: 'bg-slate-100 text-slate-500 ring-slate-200' },
})

/** List filters. `''` means every non-archived campaign. */
export const CAMPAIGN_FILTERS = Object.freeze([
  { value: '', label: 'All active' },
  { value: 'draft', label: 'Drafts' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'running', label: 'Running' },
  { value: 'paused', label: 'Paused' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'archived', label: 'Archived' },
])

/** Which control actions a status permits. Mirrors the backend's guard. */
export const AVAILABLE_CONTROLS = Object.freeze({
  draft: [],
  scheduled: ['cancel'],
  running: ['pause', 'cancel'],
  paused: ['resume', 'cancel'],
  completed: ['archive'],
  cancelled: ['archive'],
  archived: [],
})

export const CONTROL_LABELS = Object.freeze({
  pause: 'Pause',
  resume: 'Resume',
  cancel: 'Cancel',
  archive: 'Archive',
})

export const TEMPLATE_CATEGORIES = Object.freeze([
  { value: 'travel_offer', label: 'Travel offer' },
  { value: 'follow_up', label: 'Follow-up' },
  { value: 'visa', label: 'Visa' },
  { value: 'quotation', label: 'Quotation' },
  { value: 'reminder', label: 'Reminder' },
  { value: 'custom', label: 'Custom' },
])

/**
 * Variables offered by the builder's insert menu.
 *
 * Matches `BUILT_IN_VARIABLES` on the server. A variable the server cannot
 * resolve blocks launch, so offering one here that does not exist there would
 * be a trap.
 */
export const PERSONALISATION_VARIABLES = Object.freeze([
  { name: 'FirstName', hint: "Contact's first name" },
  { name: 'LastName', hint: "Contact's surname" },
  { name: 'FullName', hint: 'Display name' },
  { name: 'Company', hint: 'Company name' },
  { name: 'Email', hint: 'Primary email address' },
  { name: 'JobTitle', hint: 'Job title' },
  { name: 'Destination', hint: 'Set once, per campaign' },
  { name: 'Source', hint: 'Where the lead came from' },
  { name: 'Agent', hint: 'Sending agent, per campaign' },
])

/** Ceilings the server enforces. Shown so the builder can warn before saving. */
export const MAX_RATE_LIMITS = Object.freeze({ perMinute: 30, perHour: 3000, perDay: 10_000 })

export const DEFAULT_THROTTLE = Object.freeze({
  perMinute: 20,
  perHour: 500,
  perDay: 5000,
  batchSize: 25,
})

/** The six steps of the builder, in order. */
export const BUILDER_STEPS = Object.freeze([
  { id: 'details', label: 'Details' },
  { id: 'audience', label: 'Audience' },
  { id: 'message', label: 'Message' },
  { id: 'sending', label: 'Sending' },
  { id: 'preview', label: 'Preview' },
  { id: 'launch', label: 'Launch' },
])

export default CAMPAIGN_STATUS
