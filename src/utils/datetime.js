/**
 * How the CRM writes a date. One place, one answer.
 *
 * ## Why not `toLocaleDateString()`
 *
 * It was used in about twenty files, and it is not deterministic: the same
 * enquiry read on a machine set to `en-US` shows `08/21/2026` and on `en-GB`
 * shows `21/08/2026`. For a register where a Query Date and a Travel Date sit
 * next to each other, a reader cannot tell those two formats apart — 04/08 and
 * 08/04 are both plausible dates — so the display has to be fixed rather than
 * inherited from whatever the browser happens to be set to.
 *
 * Everything here formats to `DD/MM/YYYY`, always, on every machine.
 *
 * ## Timezone is deliberately unchanged
 *
 * These read the local calendar fields (`getDate`, `getMonth`, `getFullYear`),
 * exactly as `toLocaleDateString()` did. Switching to UTC would be a quieter
 * change than it looks: the workbook stores `quoteDate` and `travelDate` at
 * midnight UTC, so west of Greenwich every one of them would start rendering as
 * the previous day. Formatting is a display concern; which instant a date
 * refers to is not, and this module does not touch it.
 *
 * ## What is *not* here
 *
 * `toDateInput` is the one function that must not follow the house style: a
 * native `<input type="date">` speaks `YYYY-MM-DD` and nothing else, and
 * feeding it anything else silently blanks the control and breaks the form.
 */

/** The em dash every empty value in this CRM renders as. */
export const EMPTY = '—'

/** A valid `Date`, or null for anything that is not one. */
function toDate(value) {
  if (value === null || value === undefined || value === '') return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const pad = (n) => String(n).padStart(2, '0')

/**
 * `DD/MM/YYYY`.
 *
 * @param {*} value
 * @param {{ empty?: * }} [options]
 *   `empty` is what an absent or unreadable value renders as. It is a parameter
 *   because callers genuinely differ: a table cell wants an em dash, while a
 *   caller writing `formatDate(x) ?? lead.travelDateText` needs null so its
 *   fallback can take over.
 */
export function formatDate(value, { empty = EMPTY } = {}) {
  const date = toDate(value)
  if (!date) return empty
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`
}

/** `DD/MM/YYYY HH:mm`, 24-hour — the same reason the date is fixed. */
export function formatDateTime(value, { empty = EMPTY } = {}) {
  const date = toDate(value)
  if (!date) return empty
  return `${formatDate(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** `HH:mm`. For rows where the day is already established by their grouping. */
export function formatTime(value, { empty = EMPTY } = {}) {
  const date = toDate(value)
  if (!date) return empty
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/**
 * "3 days ago", "in 2 hours" — for recency, where the exact instant is noise.
 *
 * Falls back to the fixed date once something is far enough away that "in 87
 * days" has stopped being easier to read than the date itself.
 */
export function formatRelative(value, { empty = EMPTY } = {}) {
  const date = toDate(value)
  if (!date) return empty

  const seconds = Math.round((date.getTime() - Date.now()) / 1000)
  const abs = Math.abs(seconds)

  if (abs < 45) return 'just now'

  const units = [
    ['minute', 60],
    ['hour', 3600],
    ['day', 86_400],
    ['week', 604_800],
  ]

  for (const [unit, size] of units) {
    if (abs < size * (unit === 'week' ? 5 : unit === 'day' ? 7 : 60)) {
      const count = Math.round(abs / size)
      const plural = count === 1 ? unit : `${unit}s`
      return seconds < 0 ? `${count} ${plural} ago` : `in ${count} ${plural}`
    }
  }

  return formatDate(date)
}

/**
 * `YYYY-MM-DD`, for `<input type="date">`.
 *
 * The one place the house format must not be used. A native date input parses
 * only ISO, renders it in the *browser's* locale itself, and submits ISO back —
 * so this is the value the control speaks, not the value a person reads.
 */
export function toDateInput(value) {
  const date = toDate(value)
  if (!date) return ''
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export default { EMPTY, formatDate, formatDateTime, formatTime, formatRelative, toDateInput }
