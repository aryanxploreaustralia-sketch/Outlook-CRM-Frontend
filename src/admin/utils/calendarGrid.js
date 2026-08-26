/**
 * The arithmetic behind a month grid.
 *
 * Separated from the component because this is the part that can be wrong in
 * ways nobody notices for a month: a grid that drops the 31st, a February that
 * needs six rows, a date that shifts a day because it was built through UTC.
 * Here it can be driven directly.
 *
 * ## Days are strings, not `Date`s
 *
 * A cell is identified by its `YYYY-MM-DD`, which is exactly what the server
 * groups counts by. Comparing dates as strings cannot drift across a timezone
 * the way comparing two `Date` objects can, and it makes the lookup from a cell
 * to its counts a plain `Map.get`.
 *
 * `Date` is used only to walk the calendar — always through local calendar
 * fields (`getFullYear`/`getMonth`/`getDate`), never `toISOString`, which would
 * report the previous day for anybody west of Greenwich.
 */

/** Monday-first, matching how the rest of the product reads a week. */
export const WEEKDAYS = Object.freeze(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])

export const MONTHS = Object.freeze([
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
])

/** `YYYY-MM-DD` from calendar parts. `month` is zero-based, as `Date` has it. */
export const dateKey = (year, month, day) =>
  `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

/** Today, as the reader's own calendar would write it. */
export function todayKey(now = new Date()) {
  return dateKey(now.getFullYear(), now.getMonth(), now.getDate())
}

/**
 * `DD/MM/YYYY` from a `YYYY-MM-DD` key, and the long form beside it.
 *
 * Takes the key rather than a `Date` so it cannot reintroduce the timezone
 * question the key exists to avoid.
 */
export function describeKey(key) {
  const [year, month, day] = key.split('-')

  return {
    short: `${day}/${month}/${year}`,
    long: `${Number(day)} ${MONTHS[Number(month) - 1]} ${year}`,
  }
}

/**
 * The cells of a month, including the neighbouring days that pad it out.
 *
 * Always whole weeks, so the grid is rectangular and every column sits under
 * its heading. A month beginning on a Sunday and running 31 days needs six
 * rows; the count is derived rather than fixed at five.
 *
 * Each step is built from the first of the month rather than by adding a day to
 * the previous cell. `new Date(y, m, 1 - lead + i)` normalises out of range
 * values correctly and never accumulates the hour that a daylight-saving
 * boundary would otherwise introduce.
 *
 * @param {number} year
 * @param {number} month Zero-based.
 * @returns {Array<{ key: string, day: number, isCurrentMonth: boolean }>}
 */
export function buildMonthGrid(year, month) {
  // `getDay()` is Sunday-first; shift so Monday is 0.
  const lead = (new Date(year, month, 1).getDay() + 6) % 7

  // Day 0 of the next month is the last day of this one.
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cellCount = Math.ceil((lead + daysInMonth) / 7) * 7

  return Array.from({ length: cellCount }, (_, index) => {
    const date = new Date(year, month, 1 - lead + index)

    return {
      key: dateKey(date.getFullYear(), date.getMonth(), date.getDate()),
      day: date.getDate(),
      isCurrentMonth: date.getMonth() === month && date.getFullYear() === year,
    }
  })
}

export default { WEEKDAYS, MONTHS, dateKey, todayKey, describeKey, buildMonthGrid }
