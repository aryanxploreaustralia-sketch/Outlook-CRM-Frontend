/**
 * Template constants shared by the library and the editor.
 *
 * The variable list is *not* here — it is served by `/templates/variables`, so
 * the picker can never offer a variable the renderer cannot fill. Duplicating
 * it in the client is how those two drift apart.
 */

export const TEMPLATE_STATUS = Object.freeze({
  DRAFT: 'draft',
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  ARCHIVED: 'archived',
})

/** Badge styling per status. Active is the only one that earns a colour. */
export const TEMPLATE_STATUS_STYLES = Object.freeze({
  active: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  inactive: 'bg-slate-100 text-slate-600 ring-slate-200',
  draft: 'bg-amber-50 text-amber-700 ring-amber-200',
  archived: 'bg-slate-50 text-slate-400 ring-slate-200',
})

export const TEMPLATE_STATUS_LABELS = Object.freeze({
  active: 'Active',
  inactive: 'Inactive',
  draft: 'Draft',
  archived: 'Archived',
})

export const TEMPLATE_STATUS_FILTERS = Object.freeze([
  { value: '', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'draft', label: 'Drafts' },
  { value: 'archived', label: 'Archived' },
])

/** Mirrors the server's `TEMPLATE_CATEGORY`. */
export const TEMPLATE_CATEGORIES = Object.freeze([
  { value: 'travel_offer', label: 'Travel offer' },
  { value: 'follow_up', label: 'Follow-up' },
  { value: 'visa', label: 'Visa' },
  { value: 'quotation', label: 'Quotation' },
  { value: 'reminder', label: 'Reminder' },
  { value: 'custom', label: 'Custom' },
])

/**
 * Widths the preview offers.
 *
 * 390px is an iPhone 15 viewport and 600px is the width every HTML email
 * template on earth is built to — between them they cover what a recipient
 * will actually see.
 */
export const PREVIEW_WIDTHS = Object.freeze({
  desktop: { label: 'Desktop', width: '100%', maxWidth: '720px' },
  mobile: { label: 'Mobile', width: '390px', maxWidth: '390px' },
})

/**
 * Subject-line length at which mail clients start truncating.
 *
 * Not a hard limit — the server allows 998, the RFC ceiling — but a warning
 * worth showing, because a subject cut off mid-word is the first thing the
 * recipient sees.
 */
export const SUBJECT_TRUNCATION_HINT = 78

export default TEMPLATE_STATUS
