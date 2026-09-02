/**
 * Verifies the Phase 3 hydration layer.
 *
 * ## How the server is stood in for
 *
 * `@/api/httpClient` is aliased to a fixture that implements the **real** Phase
 * 2 contract — the same `(updatedAt, _id)` cursor, the same
 * `entities[name].{records,deleted,nextCursor,hasMore}` payload inside the same
 * `{ data: { data } }` envelope, the same owner scoping, and the same **flat**
 * `cursorLeads` query parameters the server actually reads. Phase 2's own 66
 * checks prove the server produces that shape and `verify-sync-cursor.mjs`
 * proves it over real HTTP; these prove the client produces and consumes it
 * correctly, including when it fails.
 *
 * The alias is at the HTTP client rather than at the sync service on purpose:
 * the cursor bug lived in the transport, so a fixture above the transport could
 * not have seen it. See the note beside `FIXTURE_MODULE`.
 *
 * ## Safety
 *
 * No MongoDB connection. No network request. No production data. IndexedDB is
 * `fake-indexeddb`, held in this process's memory and gone when it exits.
 *
 *     node scripts/verify-hydration.mjs
 */

import 'fake-indexeddb/auto'

import { createServer } from 'vite'

let failures = 0
let checks = 0
const check = (ok, label, detail = '') => {
  checks += 1
  if (!ok) failures += 1
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`)
}
const section = (t) => console.log(`\n=== ${t} ===`)

// ---------------------------------------------------------------------------
// The fixture server, injected in place of the real transport.
// ---------------------------------------------------------------------------

/*
 * The fixture stands in for `@/api/httpClient`, NOT for `@/api/services/sync.service`.
 *
 * That distinction is the entire lesson of the cursor bug. While the fixture
 * replaced the sync service, the real transport never ran, so the suite could
 * not see that it was handing Axios a nested `params` object which Express 5
 * would refuse to reassemble. Everything above the HTTP boundary agreed with
 * itself and the feature was still broken end to end.
 *
 * Intercepting one layer lower means `fetchChanges` — including
 * `flattenCursors` — executes for real, and the assertions below inspect the
 * actual `params` object that would have gone on the wire.
 */
const FIXTURE_MODULE = 'virtual:fixture-http-client'

/** Mutable control surface the tests drive. */
const server_ = {
  /** entity -> array of records, in (updatedAt, _id) order. */
  data: { leads: [], contacts: [], companies: [] },
  /** entity -> tombstones to emit on the first page. */
  deletions: { leads: [], contacts: [], companies: [] },
  /** Set to an error object to make the next call reject. */
  failWith: null,
  /** Fail only on the Nth call (1-based). */
  failOnCall: null,
  /** Return a shape the client should reject. */
  malformed: false,
  calls: 0,
  /** Every set of params the client sent — used to prove no owner is sent. */
  received: [],
  /**
   * Called at the top of each request, before a response is built.
   *
   * Because `hydrate` awaits the request, everything the previous page did —
   * its writes AND its cursor — is durable by the time this runs. That makes it
   * a deterministic observation point, which `onProgress` is not: hydrate fires
   * that without awaiting it, so an async reader can race the next page.
   */
  beforeRespond: null,
}

const encodeCursor = (updatedAt, id) => Buffer.from(`${updatedAt}|${id}`, 'utf8').toString('base64url')
const decodeCursor = (c) => {
  const raw = Buffer.from(c, 'base64url').toString('utf8')
  const i = raw.lastIndexOf('|')
  return { updatedAt: raw.slice(0, i), id: raw.slice(i + 1) }
}

/** The real predicate: updatedAt > T, or equal and _id > lastId. */
const after = (row, position) => {
  if (!position) return true
  if (row.updatedAt > position.updatedAt) return true
  return row.updatedAt === position.updatedAt && row.id > position.id
}

const fixtureSource = `
export const httpClient = {
  get: (url, config = {}) => globalThis.__fixture.get(url, config),
}
export default httpClient
`

/** The parameter name the CLIENT is expected to use. Mirrors the server. */
const paramFor = (entity) => `cursor${entity[0].toUpperCase()}${entity.slice(1)}`

/**
 * Reads the flat wire parameters back into `{ leads, contacts, companies }`.
 *
 * The fixture deliberately understands ONLY the flat form. A regression to the
 * nested representation makes every cursor invisible here, exactly as it was
 * invisible to Express — so the pagination assertions below fail rather than
 * quietly passing against a shape the real server never sees.
 */
const unflatten = (params) =>
  Object.fromEntries(
    ['leads', 'contacts', 'companies']
      .map((entity) => [entity, params[paramFor(entity)]])
      .filter(([, value]) => typeof value === 'string' && value !== ''),
  )

globalThis.__fixture = {
  async get(url, config = {}) {
    const params = { ...(config.params ?? {}) }

    if (String(url).includes('/status')) {
      return { data: { success: true, message: 'Sync status.', data: {
        serverTime: new Date().toISOString(), entities: ['leads', 'contacts', 'companies'],
        maxLimit: 500, defaultLimit: 250, hasChanges: true,
      } } }
    }

    const cursors = unflatten(params)
    const entities = params.entities ? String(params.entities).split(',') : undefined
    const limit = Number(params.limit ?? 250)

    server_.calls += 1
    server_.received.push({ url, params, cursors: { ...cursors }, entities, limit })

    if (server_.beforeRespond) await server_.beforeRespond(server_.calls)

    if (server_.failWith && (server_.failOnCall === null || server_.failOnCall === server_.calls)) {
      const error = server_.failWith
      if (server_.failOnCall !== null) server_.failWith = null
      throw error
    }

    // Wrapped in the real API envelope, so the transport's own unwrapping
    // (`response.data?.data`) is exercised rather than assumed.
    if (server_.malformed) {
      return { data: { success: true, data: { entities: { leads: { records: 'not-an-array' } }, serverTime: '', hasMore: false } } }
    }

    const wanted = entities?.length ? entities : ['leads', 'contacts', 'companies']
    const out = {}

    for (const entity of wanted) {
      const cursor = cursors[entity] ?? null
      const position = cursor ? decodeCursor(cursor) : null
      const all = server_.data[entity] ?? []

      const eligible = all.filter((row) => after(row, position))
      const hasMore = eligible.length > limit
      const page = eligible.slice(0, limit)
      const last = page[page.length - 1]

      out[entity] = {
        entity,
        records: page,
        // Tombstones ride the first page only, as the real feed does from a
        // position at the beginning of time.
        deleted: cursor ? [] : (server_.deletions[entity] ?? []),
        nextCursor: last ? encodeCursor(last.updatedAt, last.id) : cursor,
        hasMore,
      }
    }

    const feed = { entities: out, serverTime: new Date().toISOString(), hasMore: Object.values(out).some((e) => e.hasMore) }
    return { data: { success: true, message: 'ok', data: feed, timestamp: new Date().toISOString() } }
  },
}

const vite = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
  plugins: [{
    name: 'fixture-http-client',
    enforce: 'pre',
    resolveId(id) {
      if (id === '@/api/httpClient' || id.endsWith('/api/httpClient')) {
        return FIXTURE_MODULE
      }
      return null
    },
    load(id) {
      return id === FIXTURE_MODULE ? fixtureSource : null
    },
  }],
})

const { hydrate, HYDRATION_RESULT, PAGE_SIZE, classifyError } =
  await vite.ssrLoadModule('/src/offline/sync/hydrate.js')
const {
  leadsRepository, contactsRepository, companiesRepository,
  identityRepository, syncMetaRepository, metaOf, META, metaKey, closeAll,
} = await vite.ssrLoadModule('/src/offline/index.js')

const REPO = { leads: leadsRepository, contacts: contactsRepository, companies: companiesRepository }

// ---------------------------------------------------------------------------
const ALICE = { id: 'alice00000000000000001', displayName: 'Alice', email: 'a@example.invalid', role: 'manager' }
const BOB = { id: 'bob0000000000000000002', displayName: 'Bob', email: 'b@example.invalid', role: 'manager' }

let seq = 0
const makeRecord = (entity, over = {}) => {
  seq += 1
  const stamp = new Date(Date.UTC(2026, 0, 1, 0, 0, 0, 0) + seq * 1000).toISOString()
  const base = {
    id: `${entity}-${String(seq).padStart(6, '0')}`,
    updatedAt: stamp,
    createdAt: stamp,
  }
  if (entity === 'leads') {
    return { ...base, reference: `XA${seq}`, stage: 'active', market: 'AU', city: 'Mumbai',
      contactPerson: `P${seq}`, travelDate: '2026-09-05T00:00:00.000Z',
      quoteDate: '2026-08-01T00:00:00.000Z', ...over }
  }
  if (entity === 'contacts') {
    // The real Contact DTO carries its OWN syncStatus (Outlook), which must survive.
    return { ...base, displayName: `C${seq}`, company: 'Test Travels',
      syncStatus: 'synced', lastSyncedAt: '2026-01-01T00:00:00.000Z', ...over }
  }
  return { ...base, companyName: `Co${seq}`, leadCount: 3, ...over }
}

const seed = (entity, n, over = {}) => {
  server_.data[entity] = Array.from({ length: n }, () => makeRecord(entity, over))
  return server_.data[entity]
}
const resetServer = () => {
  server_.data = { leads: [], contacts: [], companies: [] }
  server_.deletions = { leads: [], contacts: [], companies: [] }
  server_.failWith = null
  server_.failOnCall = null
  server_.malformed = false
  server_.calls = 0
  server_.received = []
  server_.beforeRespond = null
}

// ---------------------------------------------------------------------------
section('1-3. A NEW LOCAL DATABASE RECEIVES ALL THREE ENTITIES')

resetServer()
seed('leads', 30)
seed('contacts', 12)
seed('companies', 7)

const first = await hydrate({ user: ALICE })
check(first.result === HYDRATION_RESULT.COMPLETED, 'hydration completed', first.result)
check((await leadsRepository.count({ userId: ALICE.id })) === 30, '1. leads hydrated', String(await leadsRepository.count({ userId: ALICE.id })))
check((await contactsRepository.count({ userId: ALICE.id })) === 12, '2. contacts hydrated')
check((await companiesRepository.count({ userId: ALICE.id })) === 7, '3. companies hydrated')
check(first.written === 49, 'summary reports 49 written', String(first.written))

// ---------------------------------------------------------------------------
section('4-5. IDENTITY')

const identity = await identityRepository.get({ userId: ALICE.id })
check(identity?.userId === ALICE.id, '4. the authenticated user id is stored')
check(identity.displayName === 'Alice' && identity.role === 'manager', '   name and role stored')
check(Array.isArray(identity.permissions) && identity.permissions.length === 0,
  '   permissions empty — /auth/status sends none, so none is invented')

const identityJson = JSON.stringify(identity)
for (const secret of ['token', 'password', 'secret', 'cookie', 'session']) {
  check(!identityJson.toLowerCase().includes(secret), `5. no "${secret}" stored`)
}

// ---------------------------------------------------------------------------
section('6-7. PAGINATION AND CURSOR ORDER')

resetServer()
const bulk = seed('leads', 620)   // 3 pages at 250
seed('contacts', 0)
seed('companies', 0)

const paged = await hydrate({ user: BOB, entities: ['leads'] })
check(paged.result === HYDRATION_RESULT.COMPLETED, '6. multi-page hydration completed')
check(paged.entities.leads.pages === 3, `   3 pages at limit ${PAGE_SIZE}`, String(paged.entities.leads.pages))
check((await leadsRepository.count({ userId: BOB.id })) === 620, '   all 620 stored', String(await leadsRepository.count({ userId: BOB.id })))
check(server_.received.every((r) => r.limit === PAGE_SIZE), `   every request used limit=${PAGE_SIZE}`)

const savedCursor = await syncMetaRepository.get(metaKey(META.CURSOR, 'leads'), { userId: BOB.id })
const lastRecord = bulk[bulk.length - 1]
check(savedCursor === encodeCursor(lastRecord.updatedAt, lastRecord.id),
  '7. the stored cursor points at the last record written')

// ---------------------------------------------------------------------------
section('8. A MID-RUN FAILURE MUST NOT ADVANCE THE CURSOR PAST UNWRITTEN DATA')

resetServer()
seed('leads', 620)
server_.failWith = { status: 500, message: 'injected server error' }
server_.failOnCall = 2      // page 1 lands, page 2 fails

const partial = await hydrate({ user: { ...ALICE, id: 'partial-user-0000001' } })
const PID = 'partial-user-0000001'
check(partial.entities.leads.result === HYDRATION_RESULT.SERVER_ERROR, '8. the failure is reported', partial.entities.leads.result)
check(partial.entities.leads.pages === 1, '   only page 1 was persisted', String(partial.entities.leads.pages))
check((await leadsRepository.count({ userId: PID })) === 250, '   250 records on disk', String(await leadsRepository.count({ userId: PID })))

const partialCursor = await syncMetaRepository.get(metaKey(META.CURSOR, 'leads'), { userId: PID })
const record250 = server_.data.leads[249]
check(partialCursor === encodeCursor(record250.updatedAt, record250.id),
  '   the cursor names record 250, not record 500 — nothing is skipped')

console.log('\n  -- resuming completes the set, losing nothing --')
server_.failWith = null
server_.failOnCall = null
const resumed = await hydrate({ user: { ...ALICE, id: PID } })
check(resumed.entities.leads.result === HYDRATION_RESULT.COMPLETED, '   the resumed run completed')
check((await leadsRepository.count({ userId: PID })) === 620, '   all 620 present after resume', String(await leadsRepository.count({ userId: PID })))
check(resumed.entities.leads.pages === 2, '   it fetched only the 2 remaining pages', String(resumed.entities.leads.pages))

// ---------------------------------------------------------------------------
section('9-10. IDEMPOTENCE AND ID PRESERVATION')

resetServer()
const fixture = seed('leads', 40)
const U = 'idem-user-00000000001'

await hydrate({ user: { ...ALICE, id: U } })
const afterFirst = await leadsRepository.count({ userId: U })

// Re-run from scratch: clear the cursor so the same pages arrive again.
await syncMetaRepository.remove(metaKey(META.CURSOR, 'leads'), { userId: U })
await hydrate({ user: { ...ALICE, id: U } })
const afterSecond = await leadsRepository.count({ userId: U })

check(afterFirst === 40 && afterSecond === 40, '9. re-hydrating the same page created no duplicates',
  `${afterFirst} then ${afterSecond}`)

const stored = await leadsRepository.all({ userId: U })
const ids = stored.map((r) => r.id)
check(new Set(ids).size === ids.length, '   no duplicate server ids locally')
check(ids.every((id) => fixture.some((f) => f.id === id)), '10. every stored id is a server id')
check(!ids.some((id) => id.startsWith('local-') || id.startsWith('tmp-')), '   no replacement ids were generated')

// ---------------------------------------------------------------------------
section('11. BUSINESS FIELDS vs _sync METADATA')

resetServer()
seed('contacts', 3)
const M = 'meta-user-000000000001'
await hydrate({ user: { ...ALICE, id: M }, entities: ['contacts'] })

const contact = (await contactsRepository.all({ userId: M }))[0]
check(contact.syncStatus === 'synced', "11. the Contact DTO's OWN syncStatus survived")
check(contact.lastSyncedAt === '2026-01-01T00:00:00.000Z', "   the DTO's lastSyncedAt survived")
check(contact.displayName?.startsWith('C'), '   business fields intact')

const meta = metaOf(contact)
check(meta.status === 'synced', '   local status lives under _sync')
check(meta.owner === M, '   owner stamped locally (the API omits it)')
check(meta.serverUpdatedAt === contact.updatedAt, '   serverUpdatedAt captured')
check(meta.localVersion === 0, '   localVersion starts at 0 for a synced record')

// ---------------------------------------------------------------------------
section('12. OWNER ISOLATION')

resetServer()
seed('leads', 5)
const A = 'iso-alice-0000000001'
await hydrate({ user: { ...ALICE, id: A }, entities: ['leads'] })

resetServer()
seed('leads', 9)
const Bo = 'iso-bob-000000000001'
await hydrate({ user: { ...BOB, id: Bo }, entities: ['leads'] })

check((await leadsRepository.count({ userId: A })) === 5, "12. Alice's database holds her 5")
check((await leadsRepository.count({ userId: Bo })) === 9, "   Bob's database holds his 9")

const aliceIds = new Set((await leadsRepository.all({ userId: A })).map((r) => r.id))
const bobIds = (await leadsRepository.all({ userId: Bo })).map((r) => r.id)
check(bobIds.every((id) => !aliceIds.has(id)), "   no record appears in both databases")

console.log('\n  -- the client never asks for an owner --')
const everyParam = server_.received.flatMap((r) => [
  ...Object.keys(r), ...Object.keys(r.cursors ?? {}),
])
check(!everyParam.includes('owner'), '   no request carried an `owner` parameter')
const clientSource = await (await import('node:fs/promises'))
  .readFile(new URL('../src/api/services/sync.service.js', import.meta.url), 'utf8')
check(!/owner/i.test(clientSource.replace(/\/\*[\s\S]*?\*\//g, '')), '   the transport has no owner code at all')

// ---------------------------------------------------------------------------
section('13-14. AUTH ERRORS STOP THE RUN CLEANLY')

resetServer()
seed('leads', 100); seed('contacts', 100); seed('companies', 100)
server_.failWith = { status: 401, message: 'session expired' }

const unauth = await hydrate({ user: { ...ALICE, id: 'unauth-user-00000001' } })
check(unauth.result === HYDRATION_RESULT.UNAUTHENTICATED, '13. a 401 is reported as unauthenticated', unauth.result)
check(Object.keys(unauth.entities).length === 1, '   the run stopped after the first entity, not all three',
  String(Object.keys(unauth.entities).length))
check(server_.calls === 1, '   exactly one request was made — no retry storm', String(server_.calls))

resetServer()
seed('leads', 100)
server_.failWith = { status: 403, message: 'permission revoked' }
const forbidden = await hydrate({ user: { ...ALICE, id: 'forbidden-user-000001' } })
check(forbidden.result === HYDRATION_RESULT.FORBIDDEN, '14. a 403 is reported as forbidden', forbidden.result)
check(server_.calls === 1, '   and stops immediately', String(server_.calls))

console.log('\n  -- every failure class is distinguished, not collapsed into "offline" --')
const cases = [
  [{ isNetwork: true }, HYDRATION_RESULT.OFFLINE, 'network'],
  [{ status: 401 }, HYDRATION_RESULT.UNAUTHENTICATED, '401'],
  [{ status: 403 }, HYDRATION_RESULT.FORBIDDEN, '403'],
  [{ status: 429 }, HYDRATION_RESULT.RATE_LIMITED, '429'],
  [{ status: 500 }, HYDRATION_RESULT.SERVER_ERROR, '500'],
  [{ status: 503 }, HYDRATION_RESULT.SERVER_ERROR, '503'],
  [{ status: 422 }, HYDRATION_RESULT.MALFORMED, '422'],
]
for (const [error, expected, label] of cases) {
  check(classifyError(error).result === expected, `   ${label} -> ${expected}`)
}
check(classifyError({ isCanceled: true }).result === null, '   an abort is not an error')
check(classifyError({ status: 429 }).retryable === true, '   429 is marked retryable')
check(classifyError({ status: 401 }).retryable === false, '   401 is NOT retryable')

// ---------------------------------------------------------------------------
section('15. A NETWORK FAILURE IS NON-FATAL')

resetServer()
seed('leads', 20)
server_.failWith = { isNetwork: true, message: 'offline' }

let threw = null
let offlineRun
try { offlineRun = await hydrate({ user: { ...ALICE, id: 'net-user-00000000001' } }) } catch (e) { threw = e }
check(threw === null, '15. hydrate() did not throw', threw?.message ?? '')
check(offlineRun.result === HYDRATION_RESULT.OFFLINE, '   it returned an OFFLINE result')
check((await leadsRepository.count({ userId: 'net-user-00000000001' })) === 0, '   nothing partial was written')

// ---------------------------------------------------------------------------
section('16. AN INDEXEDDB WRITE FAILURE MUST NOT ADVANCE THE CURSOR')

resetServer()
seed('leads', 600)
const W = 'write-fail-user-00001'

const realPutMany = leadsRepository.putMany
let putCalls = 0
leadsRepository.putMany = async (...args) => {
  putCalls += 1
  if (putCalls === 2) throw new Error('injected: IndexedDB write failed')
  return realPutMany.apply(leadsRepository, args)
}

const writeFail = await hydrate({ user: { ...ALICE, id: W }, entities: ['leads'] })
leadsRepository.putMany = realPutMany

check(writeFail.entities.leads.result === HYDRATION_RESULT.WRITE_FAILED, '16. the write failure is reported', writeFail.entities.leads.result)
check((await leadsRepository.count({ userId: W })) === 250, '   only page 1 is on disk', String(await leadsRepository.count({ userId: W })))

const wCursor = await syncMetaRepository.get(metaKey(META.CURSOR, 'leads'), { userId: W })
const rec250 = server_.data.leads[249]
check(wCursor === encodeCursor(rec250.updatedAt, rec250.id),
  '   the cursor still names record 250 — the unwritten page will be refetched')

// ---------------------------------------------------------------------------
section('17. PAGINATION EVENTUALLY COMPLETES — COUNT PARITY')

resetServer()
seed('leads', 3630)
seed('contacts', 1693)
seed('companies', 1119)
const P = 'parity-user-000000001'

const parity = await hydrate({ user: { ...ALICE, id: P } })
check(parity.result === HYDRATION_RESULT.COMPLETED, '17. a production-sized hydration completed')

const counts = {
  leads: await leadsRepository.count({ userId: P }),
  contacts: await contactsRepository.count({ userId: P }),
  companies: await companiesRepository.count({ userId: P }),
}
check(counts.leads === 3630, `   leads: server 3630 = local ${counts.leads}`)
check(counts.contacts === 1693, `   contacts: server 1693 = local ${counts.contacts}`)
check(counts.companies === 1119, `   companies: server 1119 = local ${counts.companies}`)

const allLeadIds = (await leadsRepository.all({ userId: P })).map((r) => r.id)
check(new Set(allLeadIds).size === 3630, '   no duplicate ids across 15 pages')
console.log(`   pages: leads=${parity.entities.leads.pages} contacts=${parity.entities.contacts.pages} companies=${parity.entities.companies.pages}`)

// ---------------------------------------------------------------------------
section('18. UPSERT — AN UPDATED RECORD REPLACES, NOT DUPLICATES')

resetServer()
const rows = seed('leads', 4)
const U2 = 'upsert-user-000000001'
await hydrate({ user: { ...ALICE, id: U2 }, entities: ['leads'] })
check((await leadsRepository.count({ userId: U2 })) === 4, '18. 4 records stored')

// The server updates one of them and re-emits it after the stored cursor.
const updated = { ...rows[1], stage: 'confirmed', city: 'Delhi',
  updatedAt: new Date(Date.UTC(2027, 0, 1)).toISOString() }
server_.data.leads = [updated]

await hydrate({ user: { ...ALICE, id: U2 }, entities: ['leads'] })
check((await leadsRepository.count({ userId: U2 })) === 4, '   still 4 — the record was replaced, not added')
const merged = await leadsRepository.get(rows[1].id, { userId: U2 })
check(merged.stage === 'confirmed' && merged.city === 'Delhi', '   the new values are stored')
check(metaOf(merged).status === 'synced', '   it is marked synced, not pending')

// ---------------------------------------------------------------------------
section('19. TOMBSTONES')

resetServer()
const doomed = seed('leads', 3)
const T = 'tomb-user-00000000001'
await hydrate({ user: { ...ALICE, id: T }, entities: ['leads'] })

server_.data.leads = []
server_.deletions.leads = [{ entity: 'leads', id: doomed[0].id, deletedAt: new Date().toISOString(), purged: false }]
await syncMetaRepository.remove(metaKey(META.CURSOR, 'leads'), { userId: T })
await hydrate({ user: { ...ALICE, id: T }, entities: ['leads'] })

const tombstoned = await leadsRepository.get(doomed[0].id, { userId: T })
check(Boolean(tombstoned), '19. a tombstoned record is kept locally, not removed')
check(metaOf(tombstoned).deletedLocally === true, '   it is marked deletedLocally')
check(metaOf(tombstoned).status === 'pendingDelete', '   with status pendingDelete')
check((await leadsRepository.count({ userId: T })) === 3, '   the row count is unchanged — nothing was destroyed')

console.log('\n  -- a purge marks every cached record --')
server_.deletions.leads = [{ entity: 'leads', id: null, deletedAt: new Date().toISOString(), purged: true }]
await syncMetaRepository.remove(metaKey(META.CURSOR, 'leads'), { userId: T })
await hydrate({ user: { ...ALICE, id: T }, entities: ['leads'] })
const allAfterPurge = await leadsRepository.all({ userId: T })
check(allAfterPurge.every((r) => metaOf(r).deletedLocally === true), '   all 3 marked for deletion')
check(allAfterPurge.length === 3, '   and none destroyed')

// ---------------------------------------------------------------------------
section('20. MALFORMED RESPONSE, AND UNAVAILABLE INPUT')

resetServer()
server_.malformed = true
const bad = await hydrate({ user: { ...ALICE, id: 'malformed-user-000001' }, entities: ['leads'] })
check(bad.entities.leads.result === HYDRATION_RESULT.MALFORMED, '20. a malformed page is rejected', bad.entities.leads.result)

resetServer()
const noUser = await hydrate({ user: null })
check(noUser.result === HYDRATION_RESULT.UNAUTHENTICATED, '   hydrate with no user is refused, not crashed')
const noId = await hydrate({ user: { displayName: 'x' } })
check(noId.result === HYDRATION_RESULT.UNAUTHENTICATED, '   hydrate with no user id is refused')

// ---------------------------------------------------------------------------
section('21. THE WIRE FORMAT IS FLAT — the cursor bug, guarded')

resetServer()
seed('leads', 620)
seed('contacts', 0)
seed('companies', 0)

const WIRE_U = 'wire00000000000000001'
const wireRun = await hydrate({ user: { ...ALICE, id: WIRE_U }, entities: ['leads'] })

check(wireRun.result === HYDRATION_RESULT.COMPLETED, '21. hydration completed over the real transport')
check(server_.received.length === 3, '   exactly 3 requests were sent', String(server_.received.length))

const wireRequests = server_.received
check(wireRequests.every((r) => r.params.cursor === undefined),
  '   no request carried a nested `cursor` object')
check(!wireRequests.some((r) => Object.keys(r.params).some((k) => k.includes('['))),
  '   no request carried a bracketed key such as "cursor[leads]"')
check(wireRequests.slice(1).every((r) => typeof r.params.cursorLeads === 'string'),
  '   every request after the first carried a flat `cursorLeads`')
check(wireRequests[0].params.cursorLeads === undefined,
  '   the first request carried no cursor at all')

/*
 * The client and the server must agree on the parameter name. Both derive it
 * from the entity, so this compares the two derivations rather than a literal
 * either side could drift from.
 */
const nodeFs = await import('node:fs/promises')
const serverCtrlSrc = await nodeFs.readFile(
  new URL('../../backend/src/modules/sync/controllers/sync.controller.js', import.meta.url), 'utf8')
const clientTransportSrc = await nodeFs.readFile(
  new URL('../src/api/services/sync.service.js', import.meta.url), 'utf8')
const RULE = /cursor\$\{entity\[0\]\.toUpperCase\(\)\}\$\{entity\.slice\(1\)\}/
check(RULE.test(serverCtrlSrc), '   the server derives the name from the entity')
check(RULE.test(clientTransportSrc), '   the client derives it by the identical rule')
check(!/cursor\[|params:\s*\{\s*cursor\b/.test(clientTransportSrc.replace(/\/\*[\s\S]*?\*\//g, '')),
  '   the client has no nested-cursor code left')

// ---------------------------------------------------------------------------
section('22. PAGE 1 IS NOT REQUESTED REPEATEDLY')

const sentCursorList = wireRequests.map((r) => r.params.cursorLeads ?? null)
check(new Set(sentCursorList).size === 3, '22. all 3 requests used a different cursor',
  `${new Set(sentCursorList).size} distinct`)
check(sentCursorList[0] === null, '   request 1: no cursor')
check(sentCursorList[1] && sentCursorList[1] !== sentCursorList[0], '   request 2: the cursor from page 1')
check(sentCursorList[2] && sentCursorList[2] !== sentCursorList[1], '   request 3: the cursor from page 2')

const firstPageIds = new Set(server_.data.leads.slice(0, 250).map((r) => r.id))
check((await leadsRepository.count({ userId: WIRE_U })) === 620,
  '   620 records stored, not 250 re-fetched three times',
  String(await leadsRepository.count({ userId: WIRE_U })))
check(firstPageIds.size === 250, '   page 1 covered 250 distinct records')

// ---------------------------------------------------------------------------
section('23. CURSOR PROGRESSION IS PERSISTED PAGE BY PAGE')

resetServer()
const progRows = seed('leads', 620)
seed('contacts', 0)
seed('companies', 0)

const PROG_U = 'progress000000000001'
const snapshots = []

/*
 * Observed at the start of each request, so page N-1 is fully durable. The
 * final state is read after `hydrate` resolves.
 */
server_.beforeRespond = async () => {
  snapshots.push({
    cursor: await syncMetaRepository.get(metaKey(META.CURSOR, 'leads'), { userId: PROG_U }),
    stored: await leadsRepository.count({ userId: PROG_U }),
  })
}

await hydrate({ user: { ...ALICE, id: PROG_U }, entities: ['leads'] })
server_.beforeRespond = null

snapshots.push({
  cursor: await syncMetaRepository.get(metaKey(META.CURSOR, 'leads'), { userId: PROG_U }),
  stored: await leadsRepository.count({ userId: PROG_U }),
})

check(snapshots.length === 4, '23. three requests plus a final reading', String(snapshots.length))
check(snapshots.map((s) => s.stored).join(',') === '0,250,500,620',
  '   records land 0 → 250 → 500 → 620', snapshots.map((s) => s.stored).join(' → '))
check(snapshots[0].cursor === undefined || snapshots[0].cursor === null,
  '   no cursor exists before the first page')
check(snapshots[1].cursor === encodeCursor(progRows[249].updatedAt, progRows[249].id),
  '   after page 1 the stored cursor is the 250th record')
check(snapshots[2].cursor === encodeCursor(progRows[499].updatedAt, progRows[499].id),
  '   after page 2 it is the 500th')
check(snapshots[3].cursor === encodeCursor(progRows[619].updatedAt, progRows[619].id),
  '   after page 3 it is the 620th')
check(new Set(snapshots.slice(1).map((s) => s.cursor)).size === 3,
  '   the cursor advanced on every page, never repeating')

// ---------------------------------------------------------------------------
section('24. CRASH ON PAGE 2 — the cursor must stay at page 1')

resetServer()
const rows2 = seed('leads', 620)
seed('contacts', 0)
seed('companies', 0)

const R = 'retry00000000000001'
server_.failOnCall = 2
/*
 * The exact shape `httpClient` normalises a dropped connection to. Using the
 * real shape matters: `classifyError` keys off `isNetwork`, so an approximate
 * error would be filed as MALFORMED and the test would assert the wrong
 * recovery path.
 */
server_.failWith = Object.assign(new Error('connection lost'), {
  status: null, details: null, isNetwork: true, isCanceled: false,
})

const crashedRun = await hydrate({ user: { ...ALICE, id: R }, entities: ['leads'] })
check(crashedRun.entities.leads.result === HYDRATION_RESULT.OFFLINE,
  '24. the run stopped as OFFLINE, not as completion', crashedRun.entities.leads.result)
check((await leadsRepository.count({ userId: R })) === 250,
  '   only page 1 was written', String(await leadsRepository.count({ userId: R })))

const heldAtPageOne = await syncMetaRepository.get(metaKey(META.CURSOR, 'leads'), { userId: R })
check(heldAtPageOne === encodeCursor(rows2[249].updatedAt, rows2[249].id),
  '   the cursor is still page 1 — it never advanced past unwritten data')

server_.received = []
const resumedRun = await hydrate({ user: { ...ALICE, id: R }, entities: ['leads'] })

check(server_.received[0].params.cursorLeads === heldAtPageOne,
  '   the retry re-requested page 2 using the held cursor')
check(resumedRun.entities.leads.result === HYDRATION_RESULT.COMPLETED,
  '   the resumed run completed', resumedRun.entities.leads.result)
check((await leadsRepository.count({ userId: R })) === 620,
  '   all 620 present after recovery, with nothing lost or duplicated',
  String(await leadsRepository.count({ userId: R })))

const recoveredLeadIds = (await leadsRepository.all({ userId: R })).map((r) => r.id)
check(new Set(recoveredLeadIds).size === 620, '   no duplicates were introduced by the retry')
check(rows2.every((row) => recoveredLeadIds.includes(row.id)), '   no record was skipped across the failure')

// ---------------------------------------------------------------------------
await closeAll()
await vite.close()

console.log(`\n${failures === 0 ? `ALL ${checks} CHECKS PASSED` : `${failures} of ${checks} FAILED`}`)
process.exit(failures === 0 ? 0 : 1)
