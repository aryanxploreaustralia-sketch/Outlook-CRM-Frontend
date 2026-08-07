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

/** The em dash used everywhere a value is absent. One character, one meaning. */
export const EMPTY = '—'

/**
 * Locale date, e.g. `5/08/2026`.
 *
 * Deliberately locale-derived rather than hard-formatted: the organization's
 * date format is a setting, and in Phase 14.2 it comes from
 * `Organization.regional.dateFormat` rather than the browser.
 */
export function formatDate(value) {
  if (!value) return EMPTY

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? EMPTY : date.toLocaleDateString()
}

/** Locale date and time, for audit rows where the minute matters. */
export function formatDateTime(value) {
  if (!value) return EMPTY

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return EMPTY

  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })}`
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
