/**
 * Reference order, offline.
 *
 * Runs the real `sortRecords` from `@/offline/read/predicates.js` through
 * Vite's SSR pipeline, so the cached register sorts exactly as the server's
 * aggregation does. The two have to agree: a page that reads one way online
 * and another way offline is a page nobody can trust.
 *
 * Nothing here touches a database or the network.
 *
 *     node scripts/verify-lead-reference-sort.mjs
 */

import { createServer } from 'vite'

let failures = 0
let checks = 0
const check = (ok, label, detail = '') => {
  checks += 1
  if (!ok) failures += 1
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`)
}
const section = (title) => console.log(`\n=== ${title} ===`)

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
const { sortRecords } = await server.ssrLoadModule('/src/offline/read/predicates.js')

/** The register: three prefixes on 079, varied widths, and malformed values. */
const REGISTER = [
  { reference: 'XNMP082', id: 'id-1' },
  { reference: 'XARS079', id: 'id-2' },
  { reference: 'XANB080', id: 'id-3' },
  { reference: 'XANB079', id: 'id-4' },
  { reference: 'XNMP079', id: 'id-5' },
  { reference: 'XARS081', id: 'id-6' },
  { reference: 'XAMP009', id: 'id-7' },
  { reference: 'XAMP010', id: 'id-8' },
  { reference: 'XAMP100', id: 'id-9' },
  { reference: 'XQ7', id: 'id-10' },
  { reference: 'XAMP1000', id: 'id-11' },
  { reference: '', id: 'id-12' },
  { reference: 'NOSUFFIX', id: 'id-13' },
  { reference: null, id: 'id-14' },
]

const refs = (sort) => sortRecords(REGISTER, 'leads', sort).map((row) => row.reference)

const ascending = refs('reference')
const descending = refs('-reference')

section('Ascending')
console.log(`  ${ascending.map((value) => value ?? 'null').join(' ')}`)
check(
  ascending.slice(0, 11).join(' ') === 'XQ7 XAMP009 XAMP010 XANB079 XARS079 XNMP079 XANB080 XARS081 XNMP082 XAMP100 XAMP1000',
  '1. the number is the primary key — 7, 009, 010, 079×3, 080, 081, 082, 100, 1000',
)
check(ascending.indexOf('XAMP100') > ascending.indexOf('XAMP010'), '   numerically, not as text (100 after 010)')
check(ascending.slice(3, 6).join(' ') === 'XANB079 XARS079 XNMP079', '2. the three 079s are adjacent, across prefixes')
check(ascending.slice(3, 6).join(' ') === 'XANB079 XARS079 XNMP079', '3. and in alphabetical prefix order')
check(ascending[0] === 'XQ7', '5. a two-letter prefix is handled like any other')

section('Descending')
console.log(`  ${descending.map((value) => value ?? 'null').join(' ')}`)
check(
  descending.slice(0, 4).join(' ') === 'XAMP1000 XAMP100 XNMP082 XARS081',
  '4. the numbers reverse',
)
check(
  descending.slice(5, 8).join(' ') === 'XANB079 XARS079 XNMP079',
  '3. the prefix tie-break stays ascending — the direction applies to the number only',
)

section('Malformed references')
const tail = (list) => list.slice(-3).map((value) => value ?? 'null')
check(
  tail(ascending).every((value) => ['', 'NOSUFFIX', 'null'].includes(value)),
  '6. a blank, a letters-only and a null reference sort last ascending',
  tail(ascending).join(' '),
)
check(
  tail(descending).every((value) => ['', 'NOSUFFIX', 'null'].includes(value)),
  '   and last descending too, rather than first',
  tail(descending).join(' '),
)
check(
  ascending.length === REGISTER.length && descending.length === REGISTER.length,
  '   and none of them was dropped from the register',
)
check(
  JSON.stringify(sortRecords(REGISTER, 'leads', 'reference').map((r) => r.id)) ===
    JSON.stringify(sortRecords(REGISTER, 'leads', 'reference').map((r) => r.id)),
  '   the order is stable across reads, so a page boundary cannot wobble',
)

section('Every other sort is untouched')
const byQuote = sortRecords(
  [
    { reference: 'A1', id: '1', quoteDate: '2026-01-01' },
    { reference: 'A2', id: '2', quoteDate: '2026-03-01' },
  ],
  'leads',
  '-quote',
).map((row) => row.reference)
check(byQuote.join(' ') === 'A2 A1', '11. the quote-date sort still orders by date, newest first')

const byPerson = sortRecords(
  [
    { reference: 'A1', id: '1', contactPerson: 'Zara' },
    { reference: 'A2', id: '2', contactPerson: 'Aryan' },
  ],
  'leads',
  'person',
).map((row) => row.reference)
check(byPerson.join(' ') === 'A2 A1', '    and the person sort by name')

await server.close()

console.log(`\n${failures === 0 ? `ALL ${checks} CHECKS PASSED` : `${failures} of ${checks} FAILED`}`)
process.exit(failures === 0 ? 0 : 1)
