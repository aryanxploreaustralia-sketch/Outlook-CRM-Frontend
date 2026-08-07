/**
 * Mail constants shared by the compose screen, history view and dashboard.
 *
 * The status values mirror `backend/src/constants/mailStatus.js` exactly. They
 * are part of the API contract, so a change on either side must be made on both.
 */

export const MAIL_STATUS = Object.freeze({
  DRAFT: 'draft',
  PENDING: 'pending',
  SENT: 'sent',
  FAILED: 'failed',
})

/**
 * Badge treatment per status.
 *
 * Deliberately kept out of `StatusBadge`'s own variant map: that component's
 * keys are health and connection states, and mail statuses would collide with
 * them semantically — a "failed" send is not a "down" service. Reusing the
 * colour vocabulary without reusing the keyspace keeps both readable.
 */
export const MAIL_STATUS_VARIANTS = Object.freeze({
  [MAIL_STATUS.SENT]: {
    label: 'Sent',
    className: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
    dot: 'bg-emerald-500',
  },
  [MAIL_STATUS.FAILED]: {
    label: 'Failed',
    className: 'bg-red-50 text-red-700 ring-red-600/20',
    dot: 'bg-red-500',
  },
  [MAIL_STATUS.PENDING]: {
    label: 'Pending',
    className: 'bg-amber-50 text-amber-700 ring-amber-600/20',
    // Animated because this state is genuinely transient.
    dot: 'bg-amber-500 animate-pulse',
  },
  [MAIL_STATUS.DRAFT]: {
    label: 'Draft',
    className: 'bg-slate-100 text-slate-600 ring-slate-500/20',
    dot: 'bg-slate-400',
  },
})

/** Options for the history status filter. */
export const MAIL_STATUS_FILTERS = Object.freeze([
  { value: '', label: 'All messages' },
  { value: MAIL_STATUS.SENT, label: 'Sent' },
  { value: MAIL_STATUS.FAILED, label: 'Failed' },
  { value: MAIL_STATUS.PENDING, label: 'Pending' },
  { value: MAIL_STATUS.DRAFT, label: 'Drafts' },
])

/**
 * Client-side fallbacks for the server's limits.
 *
 * The real values arrive with `/mail/history`; these apply only before that
 * lands, so the compose form can validate on the very first interaction. They
 * match the defaults in `backend/.env.example`.
 */
export const MAIL_LIMIT_FALLBACKS = Object.freeze({
  maxRecipients: 100,
  maxAttachments: 10,
  maxAttachmentBytes: 3 * 1024 * 1024,
})

/**
 * Formats a byte count for display.
 *
 * @param {number} bytes
 * @returns {string}
 */
export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default MAIL_STATUS
