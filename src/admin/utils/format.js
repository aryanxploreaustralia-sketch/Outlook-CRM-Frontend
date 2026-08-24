/**
 * Display formatting.
 *
 * Every admin screen renders dates, counts and durations. Formatted per page,
 * "2 hours ago" becomes "2h ago" on one screen and "2 hrs" on the next, and a
 * null date renders as "Invalid Date" wherever somebody forgot to check.
 *
 * All four functions take null and return a dash. That is the actual reason this
 * file exists: a users table has invited rows with no `lastLoginAt`, and a
 * mailbox can have no `lastSuccessfulSyncAt`. Absent data is normal here, so it
 * is handled once rather than at forty call sites.
 */

import { formatDate as displayDate, formatDateTime as displayDateTime } from '@/utils/datetime'

/** The em dash used everywhere a value is absent. One character, one meaning. */
export const EMPTY = '—'

/**
 * `DD/MM/YYYY`.
 *
 * Was locale-derived, which meant the console rendered `8/21/2026` or
 * `21/08/2026` depending on the reader's machine. In a register where a query
 * date sits beside a travel date those two formats are indistinguishable, so
 * the format is now fixed for everyone — see `@/utils/datetime`.
 */
export function formatDate(value) {
  return displayDate(value, { empty: EMPTY })
}

/** `DD/MM/YYYY HH:mm`, for audit rows where the minute matters. */
export function formatDateTime(value) {
  return displayDateTime(value, { empty: EMPTY })
}

/**
 * Coarse relative time — "4 min ago", "3 days ago".
 *
 * Coarse on purpose. "4 minutes and 12 seconds ago" is precision nobody reads,
 * and it forces a re-render every second to stay true.
 */
export function formatRelative(value) {
  if (!value) return EMPTY

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return EMPTY

  const seconds = Math.round((Date.now() - date.getTime()) / 1000)

  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 604_800) return `${Math.floor(seconds / 86_400)}d ago`

  return formatDate(value)
}

/** Thousands-separated integer. */
export function formatCount(value) {
  if (value === null || value === undefined) return EMPTY
  return Number(value).toLocaleString()
}

/** A percentage with one decimal, e.g. `99.4%`. */
export function formatPercent(value, decimals = 1) {
  if (value === null || value === undefined) return EMPTY
  return `${Number(value).toFixed(decimals)}%`
}

/** Minutes rendered as hours and minutes past an hour. */
export function formatMinutes(value) {
  if (value === null || value === undefined) return EMPTY
  if (value < 60) return `${value} min`

  const hours = Math.floor(value / 60)
  const minutes = value % 60

  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`
}
