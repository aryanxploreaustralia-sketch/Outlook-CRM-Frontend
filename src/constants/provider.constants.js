/**
 * Provider constants shared by the provider pages and the dashboard card.
 *
 * Mirrors `backend/src/modules/provider/constants/` exactly. These values are
 * part of the API contract, so a change on either side must be made on both.
 */

import { formatDateTime as displayDateTime } from '@/utils/datetime'

export const CONNECTION_STATUS = Object.freeze({
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  EXPIRED: 'expired',
  DEGRADED: 'degraded',
  NOT_CONFIGURED: 'not_configured',
  ERROR: 'error',
})

/**
 * Badge treatment per connection state.
 *
 * `degraded` is amber rather than red on purpose: the mailbox still works for
 * sending, and painting it as broken would send the user to fix something that
 * is not wrong.
 */
export const CONNECTION_VARIANTS = Object.freeze({
  [CONNECTION_STATUS.CONNECTED]: {
    label: 'Connected',
    className: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
    dot: 'bg-emerald-500',
  },
  [CONNECTION_STATUS.DEGRADED]: {
    label: 'Degraded',
    className: 'bg-amber-50 text-amber-700 ring-amber-600/20',
    dot: 'bg-amber-500',
  },
  [CONNECTION_STATUS.EXPIRED]: {
    label: 'Expired',
    className: 'bg-orange-50 text-orange-700 ring-orange-600/20',
    dot: 'bg-orange-500',
  },
  [CONNECTION_STATUS.ERROR]: {
    label: 'Error',
    className: 'bg-red-50 text-red-700 ring-red-600/20',
    dot: 'bg-red-500',
  },
  [CONNECTION_STATUS.DISCONNECTED]: {
    label: 'Disconnected',
    className: 'bg-slate-100 text-slate-600 ring-slate-500/20',
    dot: 'bg-slate-400',
  },
  [CONNECTION_STATUS.NOT_CONFIGURED]: {
    label: 'Not configured',
    className: 'bg-violet-50 text-violet-700 ring-violet-600/20',
    dot: 'bg-violet-400',
  },
})

export const SYNC_STATUS = Object.freeze({
  IDLE: 'idle',
  RUNNING: 'running',
  SUCCESS: 'success',
  PARTIAL: 'partial',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
})

export const SYNC_VARIANTS = Object.freeze({
  [SYNC_STATUS.SUCCESS]: {
    label: 'Up to date',
    className: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
    dot: 'bg-emerald-500',
  },
  [SYNC_STATUS.PARTIAL]: {
    label: 'Partially synced',
    className: 'bg-amber-50 text-amber-700 ring-amber-600/20',
    dot: 'bg-amber-500',
  },
  [SYNC_STATUS.FAILED]: {
    label: 'Sync failed',
    className: 'bg-red-50 text-red-700 ring-red-600/20',
    dot: 'bg-red-500',
  },
  [SYNC_STATUS.RUNNING]: {
    label: 'Syncing',
    className: 'bg-blue-50 text-blue-700 ring-blue-600/20',
    dot: 'bg-blue-500 animate-pulse',
  },
  [SYNC_STATUS.CANCELLED]: {
    label: 'Cancelled',
    className: 'bg-slate-100 text-slate-600 ring-slate-500/20',
    dot: 'bg-slate-400',
  },
  [SYNC_STATUS.IDLE]: {
    label: 'Never synced',
    className: 'bg-slate-100 text-slate-500 ring-slate-400/20',
    dot: 'bg-slate-300',
  },
})

export const FOLDERS = Object.freeze({
  INBOX: 'inbox',
  SENT: 'sent',
  DRAFTS: 'drafts',
  TRASH: 'trash',
  ARCHIVE: 'archive',
  SPAM: 'spam',
  OUTBOX: 'outbox',
  CUSTOM: 'custom',
})

/** Display order for folder lists — the order a mail client shows them in. */
export const FOLDER_ORDER = Object.freeze([
  FOLDERS.INBOX,
  FOLDERS.DRAFTS,
  FOLDERS.SENT,
  FOLDERS.ARCHIVE,
  FOLDERS.SPAM,
  FOLDERS.TRASH,
  FOLDERS.OUTBOX,
  FOLDERS.CUSTOM,
])

/** Human-readable explanations for why the mock is serving a request. */
export const FALLBACK_REASONS = Object.freeze({
  microsoft_not_configured:
    'Microsoft credentials are not set on the server, so simulated data is shown.',
  no_linked_microsoft_account:
    'This mailbox has no Microsoft sign-in linked, so simulated data is shown.',
  explicitly_requested: 'The simulated provider was requested explicitly.',
  no_mailbox: 'No mailbox is connected yet.',
})

/** `DD/MM/YYYY HH:mm`, tolerating null and invalid input. */
export function formatDateTime(value) {
  // `null` rather than a dash: these callers supply their own absent wording.
  return displayDateTime(value, { empty: null })
}

/**
 * Formats a timestamp as a short relative age.
 *
 * "3h ago" answers the question a status card reader actually has — is this
 * recent? — which an absolute time makes them compute for themselves.
 */
export function formatRelative(value) {
  if (!value) return 'never'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'never'

  const seconds = Math.round((Date.now() - date.getTime()) / 1000)

  // Negative means the future, which is what `nextSyncAt` is.
  if (seconds < 0) {
    const ahead = Math.abs(seconds)
    if (ahead < 60) return 'in under a minute'
    if (ahead < 3600) return `in ${Math.floor(ahead / 60)}m`
    return `in ${Math.floor(ahead / 3600)}h`
  }

  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86_400)}d ago`
}

/** Formats a millisecond duration for the history table. */
export function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms < 0) return '—'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`
}

export default CONNECTION_STATUS
