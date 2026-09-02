/**
 * Phase 4 — proves the offline register agrees with the online one.
 *
 * ## What is actually compared
 *
 * Not a fixture against a fixture. For every filter combination below this
 * script runs:
 *
 *   the REAL server  — `lead.service.js#listLeads` against a real MongoDB
 *   the REAL client  — `offline/read/localReads.js` against a real IndexedDB,
 *                      populated through the REAL Phase 2 sync feed
 *
 * and asserts the two return the same records, in the same order, with the same
 * pagination. A cache that quietly disagrees with the server is worse than no
 * cache — the numbers look authoritative and are wrong — so the disagreement
 * has to be what the test is looking for.
 *
 * The seeded data is chosen to break naive implementations: mixed-case cities,
 * null dates, absent emails, soft-deleted rows, same-value ties, and a
 * `campaignEligible` request that intersects an explicit stage.
 *
 * ## Safety
 *
 * MongoDB: connects with an explicit `dbName` of `test_phase4_read_parity` and
 * refuses to run unless the live connection carries that suffix. Production is
 * never opened; the isolated database is dropped at the end.
 *
 * IndexedDB: `fake-indexeddb`, in this process's memory, gone when it exits.
 *
 *     npm run verify:offline-reads
 */

import 'fake-indexeddb/auto'

import { createServer } from 'vite'

// Backend modules resolve their own dependencies from `backend/node_modules`.
const BACKEND = new URL('../../backend/src/', import.meta.url).href
const { config } = await import(`${BACKEND}config/index.js`)
const mongoose = (await import(`${BACKEND}../node_modules/mongoose/index.js`)).default

const SUFFIX = '_phase4_read_parity'
const TEST_DB = `test${SUFFIX}`

await mongoose.connect(config.database.uri, { ...config.database.options, dbName: TEST_DB })
if (!mongoose.connection.name.endsWith(SUFFIX)) {
  await mongoose.disconnect()
  throw new Error(`Refusing to run: expected an isolated database, got "${mongoose.connection.name}".`)
}
console.log(`Isolated database: ${mongoose.connection.name}\n`)

const { Lead } = await import(`${BACKEND}models/lead.model.js`)
const { Contact } = await import(`${BACKEND}models/contact.model.js`)
const { Company } = await import(`${BACKEND}models/company.model.js`)
const leadService = await import(`${BACKEND}modules/leads/services/lead.service.js`)
const contactRepo = await import(`${BACKEND}modules/contacts/repositories/contact.repository.js`)
const sync = await import(`${BACKEND}modules/sync/services/sync.service.js`)

let failures = 0
let checks = 0
const check = (ok, label, detail = '') => {
  checks += 1
  if (!ok) failures += 1
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`)
}
const section = (t) => console.log(`\n=== ${t} ===`)

// ---------------------------------------------------------------------------
// The real frontend modules, loaded through Vite so their `@/` aliases resolve.
// Nothing is stubbed: this is the code that ships.
// ---------------------------------------------------------------------------
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })

const {
  readLocalLeads, readLocalLead, readLocalContacts, readLocalCompanies,
  hasLocalData, readLocalLeadFacets,
} = await vite.ssrLoadModule('/src/offline/read/localReads.js')
const { withLocalFallback } = await vite.ssrLoadModule('/src/offline/read/withLocalFallback.js')
const { READ_SOURCE, resolveSource, isTransportFailure, SERVED_BY } =
  await vite.ssrLoadModule('/src/offline/read/source.js')
const { leadsRepository, contactsRepository, companiesRepository } =
  await vite.ssrLoadModule('/src/offline/index.js')

const OWNER = new mongoose.Types.ObjectId()
const USER = String(OWNER)

// ---------------------------------------------------------------------------
section('SETUP — seeding data designed to break a naive reader')

const day = (iso) => new Date(`${iso}T00:00:00.000Z`)

/*
 * Cities differ in case on purpose: the server matches them with an anchored
 * case-insensitive regex, so a `===` in the local reader would drop rows.
 * Quote dates repeat so the sort has genuine ties, and several are null so the
 * "missing sorts first" rule is actually exercised.
 */
const LEADS = [
  { reference: 'XAMP1001', city: 'Mumbai',    market: 'AU', handledBy: 'Asha',  stage: 'active',      email: 'a@x.invalid', quoteDate: day('2026-01-10'), travelDate: day('2026-03-05'), contactPerson: 'Arun Kumar',  companyName: 'Alpha Travels' },
  { reference: 'XAMP1002', city: 'mumbai',    market: 'AU', handledBy: 'asha',  stage: 'inactive',   email: 'b@x.invalid', quoteDate: day('2026-01-10'), travelDate: day('2026-03-15'), contactPerson: 'Bina Shah',   companyName: 'Beta Tours' },
  { reference: 'XAMP1003', city: 'MUMBAI',    market: 'NZ', handledBy: 'Ravi',  stage: 'confirmed',  email: '',            quoteDate: day('2026-02-01'), travelDate: null,              contactPerson: 'Chetan Rao',  companyName: 'Gamma Holidays' },
  { reference: 'XAMP1004', city: 'Delhi',     market: 'AU', handledBy: 'Ravi',  stage: 'closed',     email: 'd@x.invalid', quoteDate: null,              travelDate: day('2026-04-20'), contactPerson: 'Deepa Nair',  companyName: 'Alpha Travels' },
  { reference: 'XAMP1005', city: 'Delhi',     market: 'AU', handledBy: 'Asha',  stage: 'active',      email: 'e@x.invalid', quoteDate: day('2026-02-15'), travelDate: day('2026-03-31'), contactPerson: 'Esha Patel',  companyName: 'Delta Voyages', doNotContact: true },
  { reference: 'XAMP1006', city: '',          market: 'NZ', handledBy: '',      stage: 'query',      email: null,          quoteDate: day('2025-12-31'), travelDate: day('2026-12-01'), contactPerson: 'Farid Khan',  companyName: 'Epsilon Trips' },
  { reference: 'XAMP1007', city: 'Pune',      market: 'AU', handledBy: 'Asha',  stage: 'inactive',   email: 'g@x.invalid', quoteDate: day('2026-02-15'), travelDate: day('2026-03-05'), contactPerson: 'Gita Menon',  companyName: 'Alpha Travels' },
  { reference: 'XAMP1008', city: 'Pune',      market: 'AU', handledBy: 'Ravi',  stage: 'active',      email: 'h@x.invalid', quoteDate: day('2026-03-01'), travelDate: null,              contactPerson: 'Hari Iyer',   companyName: 'Beta Tours' },
]

await Lead.insertMany(LEADS.map((row) => ({ owner: OWNER, ...row })))

/** One soft-deleted lead: it travels in the sync feed and must not be listed. */
const deleted = await Lead.create({
  owner: OWNER, reference: 'XAMP9999', market: 'AU', contactPerson: 'Zara Deleted',
  companyName: 'Ghost Ltd', city: 'Mumbai', stage: 'active', isDeleted: true,
})

await Contact.insertMany([
  { owner: OWNER, displayName: 'Arun Kumar',  primaryEmail: 'arun@x.invalid',  company: 'Alpha Travels', country: 'India',     favorite: true,  source: 'crm',     tags: ['vip', 'agent'] },
  { owner: OWNER, displayName: 'Bina Shah',   primaryEmail: 'bina@x.invalid',  company: 'beta tours',    country: 'india',     favorite: false, source: 'outlook', tags: ['agent'] },
  { owner: OWNER, displayName: 'Chetan Rao',  primaryEmail: 'chetan@x.invalid', company: 'Gamma Holidays', country: 'Australia', favorite: true,  source: 'import',  tags: [] },
])

await Company.insertMany([
  { owner: OWNER, companyName: 'Alpha Travels',  matchKey: 'alphatravels',  country: 'India',     city: 'Mumbai', leadCount: 3 },
  { owner: OWNER, companyName: 'Beta Tours',     matchKey: 'betatours',     country: 'India',     city: 'Pune',   leadCount: 2 },
  { owner: OWNER, companyName: 'Gamma Holidays', matchKey: 'gammaholidays', country: 'Australia', city: 'Sydney', leadCount: 1 },
])

check(await Lead.countDocuments({ owner: OWNER }) === 9, '9 leads seeded (one soft-deleted)')
check(await Contact.countDocuments({ owner: OWNER }) === 3, '3 contacts seeded')
check(await Company.countDocuments({ owner: OWNER }) === 3, '3 companies seeded')

// ---------------------------------------------------------------------------
section('HYDRATION — the cache is filled through the real Phase 2 feed')

/*
 * Deliberately not `Lead.find(...)`: the point is to populate the cache the way
 * the application actually does, so the DTO the reader sees is the DTO the feed
 * produces — including the `isDeleted` flag Phase 4 needed added to it.
 */
/*
 * JSON round-tripped, because that is what the HTTP boundary does.
 *
 * Two reasons it matters beyond making `structuredClone` work: Mongoose array
 * types become plain arrays, and every Date becomes an ISO string — which is
 * exactly the shape the browser receives, and therefore the shape the date
 * windows and sorts in `predicates.js` have to cope with. Handing the reader
 * live Date objects would test a case that never occurs in production.
 */
const feed = JSON.parse(JSON.stringify(await sync.buildChangeFeed({ owner: OWNER, limit: 500 })))
const REPOS = { leads: leadsRepository, contacts: contactsRepository, companies: companiesRepository }

for (const [entity, page] of Object.entries(feed.entities)) {
  await REPOS[entity].putMany(page.records, { userId: USER, owner: USER })
}

check(await leadsRepository.count({ userId: USER }) === 9,
  'all 9 leads cached, deleted one included', String(await leadsRepository.count({ userId: USER })))
check(feed.entities.leads.records.some((r) => r.isDeleted === true),
  'the feed carries the soft-delete flag the reader needs')
check(await hasLocalData('leads', { userId: USER }) === true, 'hasLocalData reports a usable cache')

// ---------------------------------------------------------------------------
// Parity harness
// ---------------------------------------------------------------------------

const ids = (result) => result.items.map((row) => String(row.id ?? row._id))

const { SORTS, DEFAULT_SORT } = await vite.ssrLoadModule('/src/offline/read/predicates.js')

/**
 * The sort-key values a result is ordered by, normalised for comparison.
 *
 * ## Why the comparison is not simply "same ids in the same order"
 *
 * MongoDB does not define the order of documents that tie on every sort key.
 * Eight leads inserted by one `insertMany` share a `createdAt` millisecond, and
 * three share a `companyName`; asking the server for `sort=created` twice may
 * legitimately return them differently. The local reader breaks such ties by
 * `id` so that paging is stable, which is a deliberate improvement and would
 * fail a naive id-sequence assertion for reasons that are not defects.
 *
 * So the assertion is split into the two things that must genuinely hold:
 *
 *   1. both stacks selected the same SET of records, and
 *   2. both ordered them identically BY THE SORT KEY.
 *
 * Together those are strictly stronger than an id-sequence check on unique
 * keys, and correct on tied ones — a record ordered into the wrong position
 * still fails, because its key value appears in the wrong place.
 */
const sortKeys = (rows, entity, sort) => {
  const spec = SORTS[entity][sort] ?? SORTS[entity][DEFAULT_SORT[entity]]
  return rows.map((row) => spec.map(([field]) => {
    const value = row[field]
    if (value === null || value === undefined || value === '') return null
    return value instanceof Date ? value.toISOString() : String(value)
  }))
}

/** Runs one query against both stacks and compares them. */
async function parity(label, params) {
  const server = await leadService.listLeads({ owner: OWNER, ...params })
  const local = await readLocalLeads(params, { userId: USER })

  const serverIds = server.items.map((row) => String(row._id))
  const localIds = ids(local)

  const sameSet = serverIds.length === localIds.length
    && [...serverIds].sort().join() === [...localIds].sort().join()
  check(sameSet, `${label} — same records`,
    sameSet ? `${serverIds.length} rows` : `server [${serverIds}] vs local [${localIds}]`)

  const sort = params.sort ?? DEFAULT_SORT.leads
  const serverKeys = JSON.stringify(sortKeys(server.items, 'leads', sort))
  const localKeys = JSON.stringify(sortKeys(local.items, 'leads', sort))
  const sameOrder = serverKeys === localKeys
  check(sameOrder, `${label} — same order by the sort key`,
    sameOrder ? '' : `server ${serverKeys} vs local ${localKeys}`)

  const samePage = server.pagination.total === local.pagination.total
    && server.pagination.totalPages === local.pagination.totalPages
    && server.pagination.hasNext === local.pagination.hasNext
    && server.pagination.hasPrevious === local.pagination.hasPrevious
  check(samePage, `${label} — same pagination`,
    samePage ? `total ${server.pagination.total}` :
      `server ${JSON.stringify(server.pagination)} vs local ${JSON.stringify(local.pagination)}`)
}

// ---------------------------------------------------------------------------
section('1. UNFILTERED — and the soft-deleted lead must not appear')

await parity('all leads', {})

const plain = await readLocalLeads({}, { userId: USER })
check(plain.pagination.total === 8, '   8 visible, not 9 — the deleted lead is excluded',
  String(plain.pagination.total))
check(!ids(plain).includes(String(deleted._id)), '   the deleted id is absent')

// ---------------------------------------------------------------------------
section('2. EXACT-MATCH FILTERS ARE CASE-INSENSITIVE')

await parity('city=Mumbai', { city: 'Mumbai' })
await parity('city=mumbai (lowercase)', { city: 'mumbai' })
await parity('city=MUMBAI (uppercase)', { city: 'MUMBAI' })
await parity('handledBy=asha', { handledBy: 'asha' })
await parity('market=AU', { market: 'AU' })

const cityRows = await readLocalLeads({ city: 'mumbai' }, { userId: USER })
check(cityRows.pagination.total === 3,
  '   all three case variants of Mumbai matched', String(cityRows.pagination.total))

// ---------------------------------------------------------------------------
section('3. STAGE, DO-NOT-CONTACT AND CAMPAIGN ELIGIBILITY')

await parity('stage=active', { stage: 'active' })
await parity('stage=inactive', { stage: 'inactive' })
await parity('campaignEligible', { campaignEligible: true })
await parity('campaignEligible + stage=closed (empty intersection)',
  { campaignEligible: true, stage: 'closed' })
await parity('campaignEligible + stage=active', { campaignEligible: true, stage: 'active' })

const audience = await readLocalLeads({ campaignEligible: true }, { userId: USER })
check(!ids(audience).includes(String((await Lead.findOne({ reference: 'XAMP1005' }))._id)),
  '   a doNotContact lead is excluded from the audience')
check(!ids(audience).includes(String((await Lead.findOne({ reference: 'XAMP1003' }))._id)),
  '   a lead with no email is excluded from the audience')

const booked = await readLocalLeads({ campaignEligible: true, stage: 'closed' }, { userId: USER })
check(booked.pagination.total === 0,
  '   eligibility intersects the stage rather than replacing it', String(booked.pagination.total))

// ---------------------------------------------------------------------------
section('4. DATE WINDOWS — UTC, both ends inclusive')

await parity('quoteFrom=2026-01-10', { quoteFrom: '2026-01-10' })
await parity('quoteTo=2026-01-10', { quoteTo: '2026-01-10' })
await parity('quote window', { quoteFrom: '2026-01-10', quoteTo: '2026-02-15' })
await parity('travel window', { travelFrom: '2026-03-01', travelTo: '2026-03-31' })
await parity('travelMonth=2026-03', { travelMonth: '2026-03' })
await parity('both windows at once', { quoteFrom: '2026-01-01', travelTo: '2026-03-31' })

const edge = await readLocalLeads({ quoteFrom: '2026-01-10', quoteTo: '2026-01-10' }, { userId: USER })
check(edge.pagination.total === 2, '   a single-day window includes that whole day',
  String(edge.pagination.total))

// ---------------------------------------------------------------------------
section('5. SEARCH — case-insensitive substring across five fields')

await parity('search=XAMP', { search: 'XAMP' })
await parity('search=1687-style fragment', { search: '100' })
await parity('search by person', { search: 'arun' })
await parity('search by company', { search: 'alpha' })
await parity('search by email', { search: 'g@x' })
await parity('search by city', { search: 'pun' })
await parity('search with no matches', { search: 'zzzznothing' })

// ---------------------------------------------------------------------------
section('6. SORTING — every option the API exposes')

for (const sort of ['-quote', 'quote', '-travel', 'travel', 'reference', '-reference', 'person', 'company', '-created', 'created']) {
  await parity(`sort=${sort}`, { sort })
}

const byQuote = await readLocalLeads({ sort: '-quote', limit: 50 }, { userId: USER })
const lastRow = byQuote.items[byQuote.items.length - 1]
check(lastRow.quoteDate === null || lastRow.quoteDate === undefined,
  '   descending by quote puts the undated enquiry last, as MongoDB does')

// ---------------------------------------------------------------------------
section('7. PAGINATION')

await parity('page 1, limit 3', { page: 1, limit: 3 })
await parity('page 2, limit 3', { page: 2, limit: 3 })
await parity('page 3, limit 3', { page: 3, limit: 3 })
await parity('a page beyond the end', { page: 9, limit: 3 })

const p1 = await readLocalLeads({ page: 1, limit: 3 }, { userId: USER })
const p2 = await readLocalLeads({ page: 2, limit: 3 }, { userId: USER })
const p3 = await readLocalLeads({ page: 3, limit: 3 }, { userId: USER })
const across = [...ids(p1), ...ids(p2), ...ids(p3)]
check(new Set(across).size === 8, '   three pages cover all 8 rows with no repeats',
  `${new Set(across).size} unique`)
check(p1.pagination.hasPrevious === false && p1.pagination.hasNext === true, '   page 1 flags')
check(p3.pagination.hasNext === false, '   the last page has no next')

// ---------------------------------------------------------------------------
section('8. COMBINED FILTERS')

await parity('city + stage', { city: 'mumbai', stage: 'active' })
await parity('market + handledBy + sort', { market: 'AU', handledBy: 'Asha', sort: 'reference' })
await parity('search + window + sort', { search: 'a', quoteFrom: '2026-01-01', sort: 'person' })
await parity('everything at once',
  { market: 'AU', city: 'Pune', sort: '-travel', page: 1, limit: 2, search: 'x' })

// ---------------------------------------------------------------------------
section('9. CONTACTS AND COMPANIES')

const serverContacts = await contactRepo.list({ owner: OWNER, sort: 'name' })
const localContacts = await readLocalContacts({ sort: 'name' }, { userId: USER })
check(serverContacts.items.length === localContacts.items.length,
  '9. contacts: same count', `${serverContacts.items.length} vs ${localContacts.items.length}`)
const serverContactIds = serverContacts.items.map((c) => String(c.id ?? c._id))
const localContactIds = ids(localContacts)
check([...serverContactIds].sort().join() === [...localContactIds].sort().join(),
  '   contacts: same records',
  `server [${serverContactIds}] vs local [${localContactIds}]`)
check(JSON.stringify(serverContacts.items.map((c) => c.displayName))
   === JSON.stringify(localContacts.items.map((c) => c.displayName)),
  '   contacts: same order by displayName',
  `server ${serverContacts.items.map((c) => c.displayName)} vs local ${localContacts.items.map((c) => c.displayName)}`)

const favourites = await readLocalContacts({ filter: 'favorites' }, { userId: USER })
check(favourites.pagination.total === 2, '   the favourites filter works locally',
  String(favourites.pagination.total))

const byCompany = await readLocalContacts({ company: 'BETA TOURS' }, { userId: USER })
check(byCompany.pagination.total === 1, '   contact company match is case-insensitive',
  String(byCompany.pagination.total))

const tagged = await readLocalContacts({ tags: ['vip', 'agent'] }, { userId: USER })
check(tagged.pagination.total === 1, '   tags use $all semantics, not $in',
  String(tagged.pagination.total))

const companies = await readLocalCompanies({ sort: 'name' }, { userId: USER })
check(companies.pagination.total === 3, '   3 companies readable locally',
  String(companies.pagination.total))
check(companies.items[0].companyName === 'Alpha Travels', '   sorted by name')

// ---------------------------------------------------------------------------
section('10. DETAIL READS')

const one = await Lead.findOne({ owner: OWNER, reference: 'XAMP1001' })
const localOne = await readLocalLead(String(one._id), { userId: USER })
check(localOne?.reference === 'XAMP1001', '10. a lead reads back by id',
  localOne ? '' : `id ${String(one._id)} not found in the cache`)
check(localOne?._sync === undefined, '   the _sync envelope is stripped before the UI sees it')
check(await readLocalLead(String(deleted._id), { userId: USER }) === null,
  '   a soft-deleted lead reads back as null, as the API 404s it')
check(await readLocalLead('nonexistent', { userId: USER }) === null, '   an unknown id is null')

// ---------------------------------------------------------------------------
section('11. LOCALLY TOMBSTONED RECORDS ARE HIDDEN')

const victim = await Lead.findOne({ owner: OWNER, reference: 'XAMP1008' })
await leadsRepository.markDeleted(String(victim._id), { userId: USER })

const afterTombstone = await readLocalLeads({}, { userId: USER })
check(afterTombstone.pagination.total === 7, '11. a tombstoned lead drops out of the list',
  String(afterTombstone.pagination.total))
check(await readLocalLead(String(victim._id), { userId: USER }) === null,
  '   and out of the detail read')
check(await leadsRepository.count({ userId: USER }) === 9,
  '   but the row is still stored — nothing was destroyed',
  String(await leadsRepository.count({ userId: USER })))

// Put it back, so the facet check below sees the full set.
await leadsRepository.patch(String(victim._id), {}, { userId: USER })
await leadsRepository.putMany(
  feed.entities.leads.records.filter((r) => String(r.id) === String(victim._id)),
  { userId: USER, owner: USER },
)

// ---------------------------------------------------------------------------
section('12. FACETS')

const facets = await readLocalLeadFacets({ userId: USER })
check(facets.cities.includes('Mumbai') && facets.cities.includes('Delhi'),
  '12. cities are derived from the cache')
check(!facets.cities.includes(''), '   blank values are not offered as options')
check(facets.markets.includes('AU') && facets.markets.includes('NZ'), '   markets are present')
check(facets.travelMonths.some((m) => m.month === '2026-03'),
  '   travel months are counted', JSON.stringify(facets.travelMonths.slice(0, 3)))

// ---------------------------------------------------------------------------
section('13. SOURCE SELECTION')

check(resolveSource(READ_SOURCE.ONLINE) === READ_SOURCE.ONLINE, '13. ONLINE stays online')
check(resolveSource(READ_SOURCE.LOCAL) === READ_SOURCE.LOCAL, '   LOCAL stays local')
check(resolveSource(READ_SOURCE.AUTO) === READ_SOURCE.ONLINE,
  '   AUTO prefers the network when nothing says otherwise')

check(isTransportFailure({ isNetwork: true }) === true, '   a dropped connection is a transport failure')
check(isTransportFailure({ status: 500 }) === false, '   a 500 is an answer, not a transport failure')
check(isTransportFailure({ status: 401 }) === false, '   nor is a 401')
check(isTransportFailure({ isCanceled: true }) === false, '   nor is an abort')

// ---------------------------------------------------------------------------
section('14. FALLBACK BEHAVIOUR')

const netError = Object.assign(new Error('offline'), { isNetwork: true, status: null })
const serverError = Object.assign(new Error('boom'), { isNetwork: false, status: 500 })
const authError = Object.assign(new Error('expired'), { isNetwork: false, status: 401 })

const online = () => readLocalLeads({}, { userId: USER }).then((r) => ({ ...r, marker: 'from-network' }))
const local = () => readLocalLeads({}, { userId: USER })
const hasLocal = () => hasLocalData('leads', { userId: USER })

const ok = await withLocalFallback({ online, local, hasLocal, preference: READ_SOURCE.AUTO })
check(ok.marker === 'from-network', '14. a working network is used')
check(ok.source === SERVED_BY.ONLINE, '   and tagged as online')

const fellBack = await withLocalFallback({
  online: () => Promise.reject(netError), local, hasLocal, preference: READ_SOURCE.AUTO,
})
check(fellBack.pagination.total === 8, '   a transport failure falls back to the cache')
check(fellBack.source === SERVED_BY.LOCAL, '   and is tagged as local')

let threw = null
try {
  await withLocalFallback({ online: () => Promise.reject(serverError), local, hasLocal, preference: READ_SOURCE.AUTO })
} catch (error) { threw = error }
check(threw === serverError, '   a 500 is surfaced, never masked with stale data')

threw = null
try {
  await withLocalFallback({ online: () => Promise.reject(authError), local, hasLocal, preference: READ_SOURCE.AUTO })
} catch (error) { threw = error }
check(threw === authError, '   an expired session is surfaced, not papered over')

threw = null
try {
  await withLocalFallback({
    online: () => Promise.reject(netError), local, preference: READ_SOURCE.AUTO,
    hasLocal: async () => false,
  })
} catch (error) { threw = error }
check(threw === netError,
  '   an empty cache raises the network error rather than showing an empty register')

let networkCalls = 0
const pinned = await withLocalFallback({
  online: () => { networkCalls += 1; return online() },
  local, hasLocal, preference: READ_SOURCE.LOCAL,
})
check(networkCalls === 0, '   LOCAL never touches the network')
check(pinned.source === SERVED_BY.LOCAL, '   and is served from the cache')

// ---------------------------------------------------------------------------
section('15. OWNER ISOLATION IS PRESERVED')

const OTHER = 'other-user-00000000001'
const otherRead = await readLocalLeads({}, { userId: OTHER })
check(otherRead.pagination.total === 0,
  "15. another user's database is empty — no records leaked", String(otherRead.pagination.total))

let refused = false
try { await readLocalLeads({}, {}) } catch { refused = true }
check(refused, '   a read with no user id is refused rather than guessed')

// ---------------------------------------------------------------------------
section('CLEANUP — isolated database only')
await vite.close()
await mongoose.connection.dropDatabase()
console.log(`  dropped ${TEST_DB}`)
await mongoose.disconnect()

console.log(`\n${failures === 0 ? `ALL ${checks} CHECKS PASSED` : `${failures} of ${checks} CHECKS FAILED`}`)
process.exit(failures === 0 ? 0 : 1)
