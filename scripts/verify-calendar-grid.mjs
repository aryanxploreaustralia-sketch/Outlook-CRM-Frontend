/**
 * Drives the month-grid arithmetic.
 *
 * The part of the calendar that can be wrong in ways nobody notices for weeks:
 * a dropped 31st, a month needing six rows, a date shifted by a timezone.
 *
 *     node scripts/verify-calendar-grid.mjs
 */

import { createServer } from 'vite'

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
const { buildMonthGrid, dateKey, describeKey, todayKey, WEEKDAYS } = await vite.ssrLoadModule(
  '/src/admin/utils/calendarGrid.js',
)

let failures = 0
const check = (label, ok, detail = '') => {
  if (!ok) failures += 1
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`)
}

console.log('\n=== EVERY MONTH FROM 2024 TO 2028 ===')
let checked = 0
let sixRowMonths = 0
const problems = []

for (let year = 2024; year <= 2028; year += 1) {
  for (let month = 0; month < 12; month += 1) {
    const cells = buildMonthGrid(year, month)
    const inMonth = cells.filter((c) => c.isCurrentMonth)
    const expected = new Date(year, month + 1, 0).getDate()

    if (cells.length % 7 !== 0) problems.push(`${year}-${month + 1}: ${cells.length} cells, not whole weeks`)
    if (inMonth.length !== expected) problems.push(`${year}-${month + 1}: ${inMonth.length} days, expected ${expected}`)

    // Every day 1..n present exactly once, in order.
    const days = inMonth.map((c) => c.day)
    if (days.join(',') !== Array.from({ length: expected }, (_, i) => i + 1).join(','))
      problems.push(`${year}-${month + 1}: days out of order or missing`)

    // Keys strictly increase across the whole grid, padding included.
    for (let i = 1; i < cells.length; i += 1) {
      if (cells[i].key <= cells[i - 1].key) {
        problems.push(`${year}-${month + 1}: key ${cells[i].key} does not follow ${cells[i - 1].key}`)
        break
      }
    }

    // The first cell must be a Monday.
    const [fy, fm, fd] = cells[0].key.split('-').map(Number)
    if (new Date(fy, fm - 1, fd).getDay() !== 1)
      problems.push(`${year}-${month + 1}: grid starts on ${WEEKDAYS[(new Date(fy, fm - 1, fd).getDay() + 6) % 7]}, not Monday`)

    if (cells.length === 42) sixRowMonths += 1
    checked += 1
  }
}

check(`${checked} months are whole weeks, complete and in order`, problems.length === 0,
  problems.slice(0, 3).join(' | '))
check('six-row months are handled', sixRowMonths > 0, `${sixRowMonths} of ${checked} need 42 cells`)

console.log('\n=== KNOWN-AWKWARD MONTHS ===')
const cases = [
  ['February 2024 (leap, starts Thursday)', 2024, 1, 29],
  ['February 2025 (28 days, starts Saturday)', 2025, 1, 28],
  ['August 2026 (the month on screen)', 2026, 7, 31],
  ['March 2026 (DST changes in many zones)', 2026, 2, 31],
  ['December 2026 (year boundary)', 2026, 11, 31],
]
for (const [label, year, month, expected] of cases) {
  const cells = buildMonthGrid(year, month)
  const inMonth = cells.filter((c) => c.isCurrentMonth)
  check(label, inMonth.length === expected && cells.length % 7 === 0,
    `${inMonth.length} days in ${cells.length / 7} rows`)
}

console.log('\n=== JANUARY 2027 SPILLS BOTH WAYS ===')
const jan = buildMonthGrid(2027, 0)
console.log(`  first cell ${jan[0].key} (padding: ${!jan[0].isCurrentMonth})`)
console.log(`  last cell  ${jan[jan.length - 1].key} (padding: ${!jan[jan.length - 1].isCurrentMonth})`)
check('leading padding belongs to December', jan[0].key.startsWith('2026-12'))
check('the 1st and 31st are both present',
  jan.some((c) => c.key === '2027-01-01') && jan.some((c) => c.key === '2027-01-31'))

/*
 * Trailing padding is not guaranteed, and asserting it was a bug in this test.
 * January 2027 begins on a Friday, so four padding days plus thirty-one fill
 * exactly five weeks and the grid ends on the 31st. The real invariant is that
 * the grid always ends on a Sunday, whichever month that Sunday belongs to.
 */
const lastCell = jan[jan.length - 1]
const [ly, lm, ld] = lastCell.key.split('-').map(Number)
check('the grid ends on a Sunday', new Date(ly, lm - 1, ld).getDay() === 0, lastCell.key)
check('no padding is added that is not needed', jan.length === 35, `${jan.length} cells`)

console.log('\n=== DATE FORMATTING ===')
check('dateKey pads correctly', dateKey(2026, 7, 5) === '2026-08-05', dateKey(2026, 7, 5))
check('describeKey is DD/MM/YYYY', describeKey('2026-08-29').short === '29/08/2026', describeKey('2026-08-29').short)
check('describeKey long form', describeKey('2026-08-29').long === '29 August 2026', describeKey('2026-08-29').long)
check('not MM/DD/YYYY', describeKey('2026-08-29').short !== '08/29/2026')
check('todayKey matches local calendar', todayKey(new Date(2026, 7, 26, 23, 30)) === '2026-08-26',
  todayKey(new Date(2026, 7, 26, 23, 30)))
// The trap: a late-evening local date is the *next* day in UTC for +05:30.
check('late-evening date does not roll forward', todayKey(new Date(2026, 11, 31, 23, 59)) === '2026-12-31')

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`)
await vite.close()
process.exit(failures === 0 ? 0 : 1)
