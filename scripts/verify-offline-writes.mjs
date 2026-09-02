/**
 * Phase 5 — offline create and edit, the queue, and the processor.
 *
 * ## How the server is stood in for
 *
 * `@/api/httpClient` is aliased to a fixture, exactly as the Phase 3 hydration
 * suite does it, so the **real** API services and the **real** processor run.
 * That boundary is deliberate: the cursor bug in Phase 3 hid below a fixture
 * placed too high, and the thing most worth proving here — that every retry
 * carries the same `X-Client-Mutation-Id` — lives in the transport options.
 *
 * ## Safety
 *
 * No MongoDB connection. No network request. No production data. IndexedDB is
 * `fake-indexeddb`, held in this process's memory and gone when it exits.
 *
 *     npm run verify:offline-writes
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
// The fixture server.
// ---------------------------------------------------------------------------
const FIXTURE_MODULE = 'virtual:fixture-http-client'

const server_ = {
  /** Every request the client made, in order. */
  requests: [],
  /** Queue of scripted outcomes; an empty queue means "succeed". */
  script: [],
  /** Server-side record store, so a replayed create is observable. */
  created: [],
  seq: 0,
}

const resetServer = () => {
  server_.requests = []
  server_.script = []
  server_.created = []
  server_.seq = 0
}

/** A plausible server record. Timestamps and ids are the server's to state. */
const serverRecord = (entity, payload, id) => ({
  ...payload,
  id,
  ...(entity === 'leads' ? { reference: `XAMP${1000 + server_.seq}`, stage: payload.stage ?? 'active' } : {}),
  owner: 'server-decides',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: `2026-01-0${Math.min(9, server_.seq + 1)}T00:00:00.000Z`,
})

const fixtureSource = `
export const httpClient = {
  get: (url, config = {}) => globalThis.__fixture.request('GET', url, null, config),
  post: (url, body, config = {}) => globalThis.__fixture.request('POST', url, body, config),
  put: (url, body, config = {}) => globalThis.__fixture.request('PUT', url, body, config),
  delete: (url, config = {}) => globalThis.__fixture.request('DELETE', url, null, config),
}
export default httpClient
`

const err = (over) => Object.assign(new Error(over.message ?? 'failed'), {
  status: null, details: null, isNetwork: false, isCanceled: false, ...over,
})

globalThis.__fixture = {
  async request(method, url, body, config = {}) {
    const mutationId = config?.headers?.['X-Client-Mutation-Id'] ?? null
    server_.requests.push({ method, url, body, mutationId })

    const scripted = server_.script.shift()
    if (scripted) throw scripted

    server_.seq += 1

    const entity = url.includes('/contacts') ? 'contacts'
      : url.includes('/companies') ? 'companies' : 'leads'

    /*
     * The server's own idempotency, modelled: a create replayed with a known
     * mutation id returns the original record rather than making a second one.
     */
    const existing = server_.created.find((r) => r.mutationId === mutationId && mutationId)
    if (existing && method === 'POST') {
      return { data: { success: true, data: wrap(entity, existing.record) } }
    }

    if (method === 'POST') {
      const record = serverRecord(entity, body, `5f${String(server_.seq).padStart(22, '0')}`)
      server_.created.push({ mutationId, record })
      return { data: { success: true, data: wrap(entity, record) } }
    }

    // PUT — the id is in the URL.
    const id = url.split('/').pop()
    const record = serverRecord(entity, body, id)
    return { data: { success: true, data: wrap(entity, record) } }
  },
}

/** Mirrors each endpoint's real response nesting. */
function wrap(entity, record) {
  if (entity === 'leads') return { lead: record, company: null, contact: null, mail: { sent: false }, warnings: [] }
  if (entity === 'contacts') return { contact: record, possibleDuplicates: [] }
  return { company: record }
}

const vite = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
  plugins: [{
    name: 'fixture-http-client',
    enforce: 'pre',
    resolveId: (id) => (id === '@/api/httpClient' || id.endsWith('/api/httpClient')) ? FIXTURE_MODULE : null,
    load: (id) => (id === FIXTURE_MODULE ? fixtureSource : null),
  }],
})

const { createLocal, updateLocal } = await vite.ssrLoadModule('/src/offline/write/mutations.js')
const { drain, classify, DRAIN_RESULT, MAX_ATTEMPTS } = await vite.ssrLoadModule('/src/offline/write/processor.js')
const { isLocalId, isServerId, newLocalId } = await vite.ssrLoadModule('/src/offline/write/localId.js')
const { openDatabase, closeAll } = await vite.ssrLoadModule('/src/offline/db/database.js')
const { STORE, QUEUE_STATUS, OPERATION, SYNC_STATUS } = await vite.ssrLoadModule('/src/offline/db/schema.js')
const { readLocalLeads } = await vite.ssrLoadModule('/src/offline/read/localReads.js')

const U = 'phase5-user-000000001'
const queueOf = async (userId = U) => (await openDatabase(userId)).getAll(STORE.SYNC_QUEUE)
const recordsOf = async (store, userId = U) => (await openDatabase(userId)).getAll(store)
const clearAll = async (userId = U) => {
  const db = await openDatabase(userId)
  for (const store of [STORE.LEADS, STORE.CONTACTS, STORE.COMPANIES, STORE.SYNC_QUEUE]) {
    const tx = db.transaction(store, 'readwrite')
    await tx.store.clear()
    await tx.done
  }
}

// ---------------------------------------------------------------------------
section('1. OFFLINE CREATE — record and queue entry')

resetServer()
await clearAll()

const lead = await createLocal('leads', { contactPerson: 'Arun Kumar', market: 'AU', city: 'Mumbai' }, { userId: U })
check(isLocalId(lead.record.id), '1. a lead was created with a local id', lead.record.id)
check((await recordsOf(STORE.LEADS)).length === 1, '   one lead is cached')
check((await queueOf()).length === 1, '   exactly one queue entry was created')

const contact = await createLocal('contacts', { displayName: 'Bina Shah', primaryEmail: 'b@x.invalid' }, { userId: U })
check(isLocalId(contact.record.id), '2. a contact was created with a local id')
check((await recordsOf(STORE.CONTACTS)).length === 1, '   one contact is cached')
check((await queueOf()).length === 2, '   a second queue entry exists')

let refused = null
try { await createLocal('companies', { companyName: 'Ghost Ltd' }, { userId: U }) } catch (e) { refused = e }
check(Boolean(refused), '3. an offline company CREATE is refused, not stranded')
check(/no create endpoint/i.test(refused?.message ?? ''), '   with an explanation of why', refused?.message?.slice(0, 60))
check((await queueOf()).length === 2, '   and queued nothing')

// ---------------------------------------------------------------------------
section('2. LOCAL IDS')

const ids = new Set(Array.from({ length: 500 }, () => newLocalId()))
check(ids.size === 500, '4. 500 generated ids were all distinct', String(ids.size))
check([...ids].every((id) => isLocalId(id)), '   all carry the local prefix')
check([...ids].every((id) => !isServerId(id)), '   none can be mistaken for a MongoDB ObjectId')
check(isServerId('5f0000000000000000000001'), '   a real ObjectId is recognised as a server id')

// ---------------------------------------------------------------------------
section('3. OWNERSHIP CANNOT BE SPOOFED')

const spoof = await createLocal('leads', {
  contactPerson: 'Mallory', market: 'AU',
  owner: 'someone-else', ownerId: 'someone-else', userId: 'someone-else',
  role: 'owner', createdBy: 'someone-else',
}, { userId: U })

for (const field of ['owner', 'ownerId', 'userId', 'role', 'createdBy']) {
  check(spoof.record[field] === undefined, `5. "${field}" was stripped from the local record`)
  check(spoof.queued.payload[field] === undefined, `   and from the queued payload`)
}
check(spoof.record._sync.owner === U, '   the record is owned by the authenticated user', spoof.record._sync.owner)

// ---------------------------------------------------------------------------
section('4. ATOMICITY — record and queue entry, or neither')

await clearAll()
const before = (await queueOf()).length

let aborted = null
try {
  // A function cannot be structured-cloned, so the record `put` throws and the
  // whole transaction — including the queue write — must roll back.
  await createLocal('leads', { contactPerson: 'Boom', notEncodable: () => {} }, { userId: U })
} catch (e) { aborted = e }

check(Boolean(aborted), '6. an unwritable record threw rather than half-saving')
check((await queueOf()).length === before, '   no queue entry was left behind', String((await queueOf()).length))
check((await recordsOf(STORE.LEADS)).length === 0, '   and no record was left behind')

// ---------------------------------------------------------------------------
section('5. OFFLINE EDIT AND COALESCING')

await clearAll()
resetServer()

const created = await createLocal('leads', { contactPerson: 'Chetan Rao', market: 'AU', city: 'Pune' }, { userId: U })
const localId = created.record.id

await updateLocal('leads', localId, { city: 'Delhi' }, { userId: U })
await updateLocal('leads', localId, { handledBy: 'Asha' }, { userId: U })
await updateLocal('leads', localId, { city: 'Chennai' }, { userId: U })

const afterEdits = await queueOf()
check(afterEdits.length === 1, '7. CREATE + 3 edits coalesced into ONE queue entry', String(afterEdits.length))
check(afterEdits[0].operation === OPERATION.CREATE, '   and it is still a CREATE')
check(afterEdits[0].payload.city === 'Chennai', '   carrying the final city', afterEdits[0].payload.city)
check(afterEdits[0].payload.handledBy === 'Asha', '   and the field edited in between')
check(afterEdits[0].payload.contactPerson === 'Chetan Rao',
  '   fields never edited are still present — nothing was erased')

const cached = await (await openDatabase(U)).get(STORE.LEADS, localId)
check(cached.city === 'Chennai', '   the cached record shows the final state')
check(cached.market === 'AU', '   and keeps its untouched fields')
check(cached._sync.status === SYNC_STATUS.PENDING_CREATE, '   still pending a create')
check(cached._sync.localVersion === 4, '   local version advanced with each edit', String(cached._sync.localVersion))

// EDIT + EDIT on a server-backed record
await clearAll()
const db0 = await openDatabase(U)
await db0.put(STORE.LEADS, {
  id: '5f0000000000000000000009', contactPerson: 'Deepa', city: 'Mumbai', market: 'AU',
  updatedAt: '2026-01-01T00:00:00.000Z',
  _sync: { owner: U, status: SYNC_STATUS.SYNCED, serverUpdatedAt: '2026-01-01T00:00:00.000Z', localVersion: 0, deletedLocally: false, lastSyncedAt: null },
})

await updateLocal('leads', '5f0000000000000000000009', { city: 'Pune' }, { userId: U })
await updateLocal('leads', '5f0000000000000000000009', { handledBy: 'Ravi' }, { userId: U })

const edits = await queueOf()
check(edits.length === 1, '8. EDIT + EDIT coalesced into one UPDATE', String(edits.length))
check(edits[0].operation === OPERATION.UPDATE, '   operation is UPDATE')
check(edits[0].payload.city === 'Pune' && edits[0].payload.handledBy === 'Ravi',
  '   carrying the union of both edits')
check(edits[0].payload.contactPerson === undefined,
  '   and ONLY the edited fields — a partial payload for a partial-update API')
check(edits[0].baseUpdatedAt === '2026-01-01T00:00:00.000Z',
  '   the version the edit was based on is recorded for Phase 6', edits[0].baseUpdatedAt)

// ---------------------------------------------------------------------------
section('6. A NON-PENDING ENTRY IS NEVER COALESCED INTO')

await clearAll()
const c2 = await createLocal('leads', { contactPerson: 'Esha', market: 'AU' }, { userId: U })
const dbf = await openDatabase(U)
const only = (await queueOf())[0]
await dbf.put(STORE.SYNC_QUEUE, { ...only, status: QUEUE_STATUS.FAILED, lastError: 'rejected' })

await updateLocal('leads', c2.record.id, { city: 'Kochi' }, { userId: U })
const afterFailed = await queueOf()
check(afterFailed.length === 2, '9. a new entry was queued rather than merged into a failed one',
  String(afterFailed.length))
check(afterFailed.find((e) => e.status === QUEUE_STATUS.FAILED)?.lastError === 'rejected',
  '   the failed entry keeps its error — the record of what was rejected survives')

// ---------------------------------------------------------------------------
section('7. PERSISTENCE ACROSS A DATABASE REOPEN')

await clearAll()
await createLocal('leads', { contactPerson: 'Farid', market: 'NZ' }, { userId: U })
await closeAll()

const reopened = await queueOf()
check(reopened.length === 1, '10. the queue survived closing and reopening the database')
check(reopened[0].payload.contactPerson === 'Farid', '   with its payload intact')

// ---------------------------------------------------------------------------
section('8. SUCCESSFUL SYNC — reconciliation')

await clearAll()
resetServer()

const toSync = await createLocal('leads', { contactPerson: 'Gita Menon', market: 'AU' }, { userId: U })
const tempId = toSync.record.id
const opId = toSync.queued.opId

const run = await drain({ userId: U })
check(run.result === DRAIN_RESULT.COMPLETED, '11. the drain completed', run.result)
check(run.succeeded === 1, '   one mutation succeeded', String(run.succeeded))

const leadsNow = await recordsOf(STORE.LEADS)
check(leadsNow.length === 1, '   exactly one lead is cached — the local row was rekeyed, not duplicated',
  String(leadsNow.length))
check(isServerId(leadsNow[0].id), '   under the server id', leadsNow[0].id)
check(await (await openDatabase(U)).get(STORE.LEADS, tempId) === undefined,
  '   and the local id no longer resolves')

check(leadsNow[0].reference === 'XAMP1001', '   the server-allocated reference was adopted', leadsNow[0].reference)
check(leadsNow[0].createdAt === '2026-01-01T00:00:00.000Z', '   server createdAt adopted')
check(leadsNow[0]._sync.serverUpdatedAt === leadsNow[0].updatedAt, '   server updatedAt recorded in _sync')
check(leadsNow[0]._sync.status === SYNC_STATUS.SYNCED, '   the record is marked synced')
check(leadsNow[0]._sync.localVersion === 0, '   and its local version reset')

const doneEntry = (await queueOf()).find((e) => e.opId === opId)
check(doneEntry.status === QUEUE_STATUS.COMPLETED, '12. the queue entry is completed')
check(doneEntry.serverRecordId === leadsNow[0].id, '   and records the server id', doneEntry.serverRecordId)
check(server_.requests.length === 1, '   exactly one request was sent', String(server_.requests.length))
check(server_.requests[0].mutationId === opId,
  '   carrying the queue entry opId as the idempotency key')

const again = await drain({ userId: U })
check(again.result === DRAIN_RESULT.IDLE, '   a second drain has nothing to do', again.result)
check(server_.requests.length === 1, '   and sent no further request')

// ---------------------------------------------------------------------------
section('9. CREATE → EDIT DEPENDENCY AND ORDER')

await clearAll()
resetServer()

const dep = await createLocal('contacts', { displayName: 'Hari Iyer', primaryEmail: 'h@x.invalid' }, { userId: U })
const depLocalId = dep.record.id

// Force a separate UPDATE rather than a coalesce, by completing the CREATE's
// coalescing window: mark it processing, which is never coalesced into.
const dbd = await openDatabase(U)
const createEntry = (await queueOf())[0]
await dbd.put(STORE.SYNC_QUEUE, { ...createEntry, status: QUEUE_STATUS.PROCESSING })
await updateLocal('contacts', depLocalId, { displayName: 'Hari R Iyer' }, { userId: U })
await dbd.put(STORE.SYNC_QUEUE, { ...createEntry, status: QUEUE_STATUS.PENDING })

const both = await queueOf()
check(both.length === 2, '13. a CREATE and a separate UPDATE are queued', String(both.length))

const editEntry = both.find((e) => e.operation === OPERATION.UPDATE)
check(editEntry.recordId === depLocalId, '   the edit points at the local id')

const depRun = await drain({ userId: U })
check(depRun.succeeded >= 1, '14. the drain processed the create first')

const afterDep = await queueOf()
const createDone = afterDep.find((e) => e.operation === OPERATION.CREATE)
const editNow = afterDep.find((e) => e.operation === OPERATION.UPDATE)

check(createDone.status === QUEUE_STATUS.COMPLETED, '   the CREATE completed')
check(isServerId(editNow.recordId),
  '   the pending EDIT was repointed from the local id to the server id', editNow.recordId)

const finish = await drain({ userId: U })
check(finish.succeeded === 1, '15. the follow-up drain sent the edit', String(finish.succeeded))
const editSent = server_.requests.find((r) => r.method === 'PUT')
check(Boolean(editSent), '   an UPDATE request was sent')
check(!isLocalId(editSent.url.split('/').pop()),
  '   to a URL containing the server id, never a local one', editSent.url)

// ---------------------------------------------------------------------------
section('10. ERROR CLASSIFICATION')

check(classify(err({ isNetwork: true })).stop === true, '16. a network failure stops the drain')
check(classify(err({ status: 401 })).stop === true, '   401 stops the drain')
check(classify(err({ status: 401 })).retryable === false, '   and is not retryable')
check(classify(err({ status: 403 })).terminal === QUEUE_STATUS.FAILED, '   403 is terminal-failed')
check(classify(err({ status: 409 })).terminal === QUEUE_STATUS.CONFLICT, '   409 is a conflict')
check(classify(err({ status: 422 })).terminal === QUEUE_STATUS.FAILED, '   422 is terminal-failed')
check(classify(err({ status: 400 })).terminal === QUEUE_STATUS.FAILED, '   400 is terminal-failed')
check(classify(err({ status: 500 })).retryable === true, '   5xx is retryable')
check(classify(err({ status: 503 })).terminal === false, '   and not terminal')

// ---------------------------------------------------------------------------
section('11. FAILURE BEHAVIOUR — nothing is discarded')

const scenarios = [
  ['a network failure', err({ isNetwork: true }), QUEUE_STATUS.PENDING, DRAIN_RESULT.OFFLINE],
  ['401 unauthenticated', err({ status: 401 }), QUEUE_STATUS.PENDING, DRAIN_RESULT.UNAUTHENTICATED],
  ['403 forbidden', err({ status: 403 }), QUEUE_STATUS.FAILED, DRAIN_RESULT.COMPLETED],
  ['422 validation', err({ status: 422 }), QUEUE_STATUS.FAILED, DRAIN_RESULT.COMPLETED],
  ['400 bad request', err({ status: 400 }), QUEUE_STATUS.FAILED, DRAIN_RESULT.COMPLETED],
  ['409 conflict', err({ status: 409 }), QUEUE_STATUS.CONFLICT, DRAIN_RESULT.COMPLETED],
]

for (const [label, error, expectedStatus, expectedResult] of scenarios) {
  await clearAll()
  resetServer()
  await createLocal('leads', { contactPerson: `Case ${label}`, market: 'AU' }, { userId: U })
  server_.script = [error]

  const outcome = await drain({ userId: U })
  const entries = await queueOf()

  check(entries.length === 1, `17. ${label}: the mutation is still queued`, String(entries.length))
  check(entries[0].status === expectedStatus, `    status is ${expectedStatus}`, entries[0].status)
  check(outcome.result === expectedResult, `    drain reported ${expectedResult}`, outcome.result)
  check(entries[0].payload.contactPerson === `Case ${label}`, '    payload preserved intact')
  check((await recordsOf(STORE.LEADS)).length === 1, '    and the local record is still there')
}

// ---------------------------------------------------------------------------
section('12. 401 DOES NOT BURN RETRY BUDGET')

await clearAll()
resetServer()
await createLocal('leads', { contactPerson: 'Auth Case', market: 'AU' }, { userId: U })
server_.script = [err({ status: 401 })]
await drain({ userId: U })
const authEntry = (await queueOf())[0]
check(authEntry.retryCount === 0,
  '18. a 401 left the retry count untouched — signing back in resumes cleanly',
  String(authEntry.retryCount))

// ---------------------------------------------------------------------------
section('13. 5xx RETRIES, BOUNDED')

await clearAll()
resetServer()
await createLocal('leads', { contactPerson: 'Flaky', market: 'AU' }, { userId: U })

for (let i = 0; i < MAX_ATTEMPTS; i += 1) {
  server_.script = [err({ status: 503 })]
  await drain({ userId: U })
}

const exhausted = (await queueOf())[0]
check(exhausted.retryCount === MAX_ATTEMPTS, `19. it was retried ${MAX_ATTEMPTS} times`, String(exhausted.retryCount))
check(exhausted.status === QUEUE_STATUS.FAILED, '   then stopped rather than retrying forever', exhausted.status)
check(/gave up/.test(exhausted.lastError ?? ''), '   recording why', exhausted.lastError?.slice(0, 50))
check(exhausted.payload.contactPerson === 'Flaky', '   with the payload preserved for a person to resolve')

// ---------------------------------------------------------------------------
section('14. IDEMPOTENCY — a replayed create makes no duplicate')

await clearAll()
resetServer()

const dup = await createLocal('leads', { contactPerson: 'Replay Case', market: 'AU' }, { userId: U })
const stableId = dup.queued.opId

// First attempt: the server writes, but the response is lost in transit.
server_.script = [err({ status: 503 })]
await drain({ userId: U })

const firstKey = server_.requests[0].mutationId
check(firstKey === stableId, '20. the first attempt carried the mutation id', firstKey)

// Second attempt: same entry, same key.
await drain({ userId: U })
const secondKey = server_.requests[1].mutationId
check(secondKey === stableId, '21. the retry carried the SAME mutation id', secondKey)
check(firstKey === secondKey, '   stable across retries — this is what prevents duplicates')

check(server_.created.length === 1,
  '   the server created exactly one record across both attempts', String(server_.created.length))
check((await recordsOf(STORE.LEADS)).length === 1, '   and exactly one is cached locally')

// ---------------------------------------------------------------------------
section('15. NO CONCURRENT PROCESSORS')

await clearAll()
resetServer()
await createLocal('leads', { contactPerson: 'Race', market: 'AU' }, { userId: U })

const [r1, r2] = await Promise.all([drain({ userId: U }), drain({ userId: U })])
const outcomes = [r1.result, r2.result]
check(outcomes.includes(DRAIN_RESULT.BUSY),
  '22. a second concurrent drain was refused', outcomes.join(' / '))
check(server_.requests.length === 1, '   only one request was sent', String(server_.requests.length))

// ---------------------------------------------------------------------------
section('16. BOUNDED BATCHES')

await clearAll()
resetServer()
for (let i = 0; i < 8; i += 1) {
  await createLocal('leads', { contactPerson: `Bulk ${i}`, market: 'AU' }, { userId: U })
}
const limited = await drain({ userId: U, limit: 3 })
check(limited.attempted === 3, '23. the drain honoured its batch limit', String(limited.attempted))
check(server_.requests.length === 3, '   and sent only that many requests', String(server_.requests.length))
check((await queueOf()).filter((e) => e.status === QUEUE_STATUS.PENDING).length === 5,
  '   the rest are still pending')

// ---------------------------------------------------------------------------
section('17. OWNER ISOLATION')

const OTHER = 'phase5-other-00000001'
await clearAll(OTHER)
check((await queueOf(OTHER)).length === 0, "24. another user's queue is empty")
check((await recordsOf(STORE.LEADS, OTHER)).length === 0, "   and their record store is empty")

let noUser = null
try { await createLocal('leads', { contactPerson: 'X' }, {}) } catch (e) { noUser = e }
check(Boolean(noUser), '   a create with no user id is refused')

// ---------------------------------------------------------------------------
section('18. NO CREDENTIALS ARE STORED')

await clearAll()
await createLocal('leads', { contactPerson: 'Secrets', market: 'AU' }, { userId: U })
const dump = JSON.stringify([...(await queueOf()), ...(await recordsOf(STORE.LEADS))])
for (const secret of ['password', 'accessToken', 'refreshToken', 'clientSecret', 'sessionId', 'Authorization']) {
  check(!dump.includes(secret), `25. no "${secret}" anywhere in the queue or cache`)
}

// ---------------------------------------------------------------------------
section('19. PHASE 4 READS SEE PENDING RECORDS')

await clearAll()
resetServer()
await createLocal('leads', { contactPerson: 'Visible Offline', market: 'AU', city: 'Mumbai', stage: 'active' }, { userId: U })

const visible = await readLocalLeads({}, { userId: U })
check(visible.pagination.total === 1, '26. an offline-created lead is readable by the Phase 4 reader',
  String(visible.pagination.total))
check(visible.items[0].contactPerson === 'Visible Offline', '   with its values')
check(visible.items[0]._sync === undefined, '   and the _sync envelope still stripped')

// ---------------------------------------------------------------------------
section('20. DELETE IS NOT IMPLEMENTED')

const writeModule = await vite.ssrLoadModule('/src/offline/write/index.js')
check(typeof writeModule.deleteLocal !== 'function', '27. no deleteLocal is exported')
check(!Object.keys(writeModule).some((k) => /delete/i.test(k)),
  '   nothing delete-shaped is exposed at all', Object.keys(writeModule).join(', '))

const source = await (await import('node:fs/promises'))
  .readFile(new URL('../src/offline/write/processor.js', import.meta.url), 'utf8')
check(!/OPERATION\.DELETE/.test(source), '   and the processor has no DELETE sender')

// ---------------------------------------------------------------------------
await closeAll()
await vite.close()

console.log(`\n${failures === 0 ? `ALL ${checks} CHECKS PASSED` : `${failures} of ${checks} FAILED`}`)
process.exit(failures === 0 ? 0 : 1)
