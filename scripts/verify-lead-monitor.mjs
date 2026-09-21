/**
 * Lead monitor: the owner cards are a control, not a second filter system.
 *
 * The redesign moved owner selection from a dropdown to a row of cards. What
 * has to stay true is that the cards write the *existing* URL filter and that
 * nothing else about the page's data flow changed — no second fetcher, no
 * local copy of the lead list, no duplicated pagination.
 *
 * Source-level assertions, in the style of `verify-app-shell.mjs`: this checks
 * the wiring, not the pixels. Clicking through both panels in a browser is
 * still the only way to confirm how it looks.
 *
 *     node scripts/verify-lead-monitor.mjs
 */

import { readFileSync } from 'node:fs'

let failures = 0
let checks = 0
const check = (ok, label, detail = '') => {
  checks += 1
  if (!ok) failures += 1
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`)
}
const section = (title) => console.log(`\n=== ${title} ===`)
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\/.*$/gm, '')

const page = strip(read('src/admin/pages/AdminLeadMonitorPage.jsx'))
const cards = strip(read('src/admin/components/AdminOwnerCards.jsx'))

// ---------------------------------------------------------------------------
section('The banner is gone')
check(!page.includes('notice='), 'no notice prop on the page container')
check(!/last modification, not a conversation/i.test(page), 'the "Last activity…" sentence is not rendered')
check(read('src/admin/components/AdminPageContainer.jsx').includes('notice'), 'the shared container still supports notices for other pages')

// ---------------------------------------------------------------------------
section('Owner cards drive the existing filter')
check(page.includes('<AdminOwnerCards'), 'the page renders the card row')
check(/onSelect=\{\(next\) => setFilters\(\{ owner: next \}\)\}/.test(page), 'selecting an owner writes the existing `owner` filter')
check(page.includes('value={owner}'), 'the selected card comes from the URL, not local state')
check(!/useState\(\s*['"]?owner/i.test(page), 'no second owner state was introduced')
check(!cards.includes('useSearchParams'), 'the card component owns no routing state')
check(!/setFilters|setParams/.test(cards), 'and writes no URL itself — it calls the page back')

// ---------------------------------------------------------------------------
section('No second data system')
check((page.match(/useAdminResource\(/g) ?? []).length === 1, 'the page still has exactly one lead resource')
check(page.includes('const loader = useCallback((options) => fetchAdminLeads({ ...query, ...options })'), 'served by the original loader')
check(!cards.includes('useAdminResource'), 'the cards do not open a second resource')
check((cards.match(/fetchAdminLeads\(/g) ?? []).length === 1, 'they call the existing endpoint in exactly one place')
check(/limit: 1,/.test(cards), 'and only to count — limit 1, rows discarded')
check(cards.includes('summary?.total'), 'the number is the server total, the same one the KPI strip shows')
check(!/\.items\b|rows=\{|setItems/.test(cards), 'no lead rows are held by the cards')

// ---------------------------------------------------------------------------
section('Counts stay honest and quiet')
check(cards.includes('cacheRef'), 'counted results are cached')
check(cards.includes('AbortController') && cards.includes('controller.abort()'), 'superseded count requests are aborted')
check(cards.includes('...countParams'), 'counts apply the page\'s other filters')
check(/owner: query\.owner/.test(page) === false && page.includes('const ownerCountParams'), 'the count params deliberately exclude `owner`')
for (const excluded of ['page:', 'limit:', 'sort:']) {
  check(!new RegExp(`ownerCountParams[\\s\\S]{0,400}${excluded.replace(':', ':')}\\s*query`).test(page), `count params exclude ${excluded.replace(':', '')}`)
}

// ---------------------------------------------------------------------------
section('Everything else on the page is untouched')
check(page.includes('AdminPagination'), 'pagination is still rendered')
check(page.includes('onPageSizeChange={(next) => setFilters({ limit: String(next) })}'), 'with its original handlers')
check(page.includes('<AdminSearch'), 'search remains')
check(page.includes('label="Destination"'), 'destination filter remains')
check(page.includes('label="Period"'), 'date period filter remains')
check(page.includes('More filters'), '"More filters" drawer remains')
/* Exactly one select was removed: the page had eight (owner, destination,
   period, date field, plus the four in the drawer) and now has seven. */
check((page.match(/<AdminFilterSelect/g) ?? []).length === 7, 'seven of the eight filter selects remain — only owner became cards', String((page.match(/<AdminFilterSelect/g) ?? []).length))
check(!/label="Owner"/.test(page), 'the redundant owner dropdown is gone from the bar')
check(page.includes("chips.push({ key: 'owner'"), 'the owner chip still appears when one is selected')
check(page.includes("clear: { owner: '' }"), 'and clearing it returns to all owners')
check(page.includes('resetFilters'), '"Clear all" still resets every filter')
check(page.includes('<AdminTable'), 'the table is unchanged')
check(page.includes('columnOrder'), 'column ordering is unchanged')

// ---------------------------------------------------------------------------
section('Brand and responsiveness')
check(/border-brand-500|bg-brand-600|text-brand-700/.test(cards), 'selected state uses the Xplore orange brand tokens')
check(!/blue-[0-9]/.test(cards), 'no blue accents were introduced')
check(cards.includes('overflow-x-auto'), 'the collapsed row scrolls rather than overflowing the page')
check(cards.includes('flex-wrap'), 'the expanded row wraps')
check(cards.includes('More owners'), 'every owner is reachable')
check(cards.includes('aria-pressed'), 'cards report their selected state to assistive tech')
check(cards.includes('aria-label="Filter by owner"'), 'the row is labelled')

console.log(`\n${failures === 0 ? `ALL ${checks} CHECKS PASSED` : `${failures} of ${checks} FAILED`}`)
process.exit(failures === 0 ? 0 : 1)
