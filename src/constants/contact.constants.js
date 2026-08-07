/**
 * Contact constants shared by the contacts pages and the dashboard widget.
 *
 * Mirrors `backend/src/modules/contacts/constants/contactConstants.js`. These
 * values are part of the API contract, so a change on either side must be made
 * on both.
 */

export const CONTACT_SOURCE = Object.freeze({
  OUTLOOK: 'outlook',
  CRM: 'crm',
  IMPORT: 'import',
  API: 'api',
})

export const SOURCE_VARIANTS = Object.freeze({
  [CONTACT_SOURCE.OUTLOOK]: { label: 'Outlook', className: 'bg-blue-50 text-blue-700 ring-blue-600/20' },
  [CONTACT_SOURCE.CRM]: { label: 'CRM', className: 'bg-violet-50 text-violet-700 ring-violet-600/20' },
  [CONTACT_SOURCE.IMPORT]: { label: 'Imported', className: 'bg-amber-50 text-amber-700 ring-amber-600/20' },
  [CONTACT_SOURCE.API]: { label: 'API', className: 'bg-slate-100 text-slate-600 ring-slate-500/20' },
})

export const CONTACT_CATEGORY = Object.freeze({
  CUSTOMER: 'customer',
  LEAD: 'lead',
  PARTNER: 'partner',
  VENDOR: 'vendor',
  PERSONAL: 'personal',
  OTHER: 'other',
})

export const CATEGORY_OPTIONS = Object.freeze([
  { value: CONTACT_CATEGORY.CUSTOMER, label: 'Customer' },
  { value: CONTACT_CATEGORY.LEAD, label: 'Lead' },
  { value: CONTACT_CATEGORY.PARTNER, label: 'Partner' },
  { value: CONTACT_CATEGORY.VENDOR, label: 'Vendor' },
  { value: CONTACT_CATEGORY.PERSONAL, label: 'Personal' },
  { value: CONTACT_CATEGORY.OTHER, label: 'Other' },
])

export const CATEGORY_TONES = Object.freeze({
  customer: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  lead: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  partner: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  vendor: 'bg-violet-50 text-violet-700 ring-violet-600/20',
  personal: 'bg-pink-50 text-pink-700 ring-pink-600/20',
  other: 'bg-slate-100 text-slate-600 ring-slate-500/20',
})

export const SYNC_STATUS_VARIANTS = Object.freeze({
  local: { label: 'CRM only', className: 'bg-slate-100 text-slate-600 ring-slate-500/20' },
  synced: { label: 'Synced', className: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' },
  pending: { label: 'Pending upload', className: 'bg-amber-50 text-amber-700 ring-amber-600/20' },
  conflict: { label: 'Conflict', className: 'bg-orange-50 text-orange-700 ring-orange-600/20' },
  deleted_remote: { label: 'Deleted in Outlook', className: 'bg-red-50 text-red-700 ring-red-600/20' },
  failed: { label: 'Sync failed', className: 'bg-red-50 text-red-700 ring-red-600/20' },
})

/** Named filters offered by the list toolbar. */
export const CONTACT_FILTERS = Object.freeze([
  { value: '', label: 'All contacts' },
  { value: 'favorites', label: 'Favorites' },
  { value: 'recently_added', label: 'Recently added' },
  { value: 'recently_contacted', label: 'Recently contacted' },
  { value: 'crm_only', label: 'CRM only' },
  { value: 'outlook_only', label: 'Outlook only' },
  { value: 'has_conflict', label: 'Has conflict' },
])

export const SORT_OPTIONS = Object.freeze([
  { value: '-created', label: 'Newest first' },
  { value: 'created', label: 'Oldest first' },
  { value: 'name', label: 'Name A–Z' },
  { value: '-name', label: 'Name Z–A' },
  { value: 'company', label: 'Company' },
  { value: 'interaction', label: 'Last contacted' },
])

export const TRANSFER_FORMATS = Object.freeze([
  { value: 'csv', label: 'CSV', hint: 'Opens in Excel and Google Sheets.' },
  { value: 'xlsx', label: 'Excel', hint: 'Native .xlsx workbook.' },
  { value: 'vcf', label: 'vCard', hint: 'Imports into Outlook and Apple Contacts.' },
  { value: 'json', label: 'JSON', hint: 'For scripting and backups.' },
])

export const IMPORT_MODES = Object.freeze([
  { value: 'skip_duplicates', label: 'Skip duplicates', hint: 'Add new contacts only. Existing ones are left untouched.' },
  { value: 'merge', label: 'Merge', hint: 'Fill in blank fields on existing contacts without overwriting values.' },
  { value: 'overwrite', label: 'Overwrite', hint: 'Replace existing contacts entirely. Cannot be undone.' },
])

/** Deterministic avatar colour, so a contact keeps the same one across sessions. */
const AVATAR_TONES = [
  'bg-blue-100 text-blue-700',
  'bg-emerald-100 text-emerald-700',
  'bg-violet-100 text-violet-700',
  'bg-amber-100 text-amber-700',
  'bg-pink-100 text-pink-700',
  'bg-cyan-100 text-cyan-700',
  'bg-orange-100 text-orange-700',
]

export function avatarTone(seed) {
  const text = String(seed ?? '')
  let hash = 0
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) >>> 0
  }
  return AVATAR_TONES[hash % AVATAR_TONES.length]
}

/** Up to two initials from a display name. */
export function initialsOf(contact) {
  const source =
    [contact?.firstName, contact?.lastName].filter(Boolean).join(' ') ||
    contact?.displayName ||
    contact?.primaryEmail ||
    '?'

  const parts = source.trim().split(/\s+/).slice(0, 2)
  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('') || '?'
}

/** Formats an ISO timestamp, tolerating null and invalid input. */
export function formatDate(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString()
}

/** Short relative age — "3d ago" answers the question a list reader has. */
export function formatRelative(value) {
  if (!value) return 'never'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'never'

  const seconds = Math.round((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 2_592_000) return `${Math.floor(seconds / 86_400)}d ago`
  return date.toLocaleDateString()
}

export default CONTACT_SOURCE
