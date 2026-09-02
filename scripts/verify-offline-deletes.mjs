/**
 * Phase 6 — offline deletion, conflict preservation and tombstone reconciliation.
 *
 * ## How the server is stood in for
 *
 * `@/api/httpClient` is aliased, so the **real** API services, the **real**
 * queue processor and the **real** hydration layer all execute. The fixture
 * only decides what the network says back.
 *
 * ## What this is looking for
 *
 * The failures that would matter in production, stated as tests:
 *
 *  - a record deleted offline that quietly comes back;
 *  - an offline create that reaches the server anyway after the user changed
 *    their mind;
 *  - a queued edit silently discarded because somebody else deleted the record;
 *  - a conflict retried until it overwrites the other person's work.
 *
 * ## Safety
 *
 * No MongoDB connection. No network request. No production data. IndexedDB is
 * `fake-indexeddb`, held in this process's memory and gone when it exits.
 *
 *     npm run verify:offline-deletes
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
const FIXTURE_MODULE = 'virtual:fixture-http-client'

const server_ = { requests: [], script: [], deleted: [], changes: null, seq: 0 }
const resetServer = () => {
  server_.requests = []
  server_.script = []
  server_.deleted = []
  server_.changes = null
  server_.seq = 0
}

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

/** A 409 shaped exactly as the real server sends it. */
const conflict = (detail) => err({
  status: 409,
  message: 'This record changed after your copy was made.',
  details: { conflictType: 'staleVersion', serverDeleted: false, ...detail },
})

globalThis.__fixture = {
  async request(method, url, body, config = {}) {
    const headers = config?.headers ?? {}
    server_.requests.push({
      method, url, body,
      mutationId: headers['X-Client-Mutation-Id'] ?? null,
      version: headers['X-Expected-Updated-At'] ?? null,
    })

    const scripted = server_.script.shift()
    if (scripted) throw scripted

    server_.seq += 1

    if (url.includes('/sync/changes')) {
      return { data: { success: true, data: server_.changes ?? emptyFeed() } }
    }

    const entity = url.includes('/contacts') ? 'contacts'
      : url.includes('/companies') ? 'companies' : 'leads'

    if (method === 'DELETE') {
      const id = url.split('/').pop()
      server_.deleted.push({ entity, id })
      return { data: { success: true, data: { id, deleted: true } } }
    }

    const id = method === 'POST' ? `5f${String(server_.seq).padStart(22, '0')}` : url.split('/').pop()
    const record = {
      ...body, id, owner: 'server-decides',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: `2026-02-0${Math.min(9, server_.seq)}T00:00:00.000Z`,
    }
    const wrapped = entity === 'leads'
      ? { lead: record, company: null, contact: null, mail: { sent: false }, warnings: [] }
      : entity === 'contacts' ? { contact: record, possibleDuplicates: [] } : { company: record }

    return { data: { success: true, data: wrapped } }
  },
}

const emptyFeed = () => ({
  entities: {
    leads: { entity: 'leads', records: [], deleted: [], nextCursor: null, hasMore: false },
    contacts: { entity: 'contacts', records: [], deleted: [], nextCursor: null, hasMore: false },
    companies: { entity: 'companies', records: [], deleted: [], nextCursor: null, hasMore: false },
  },
  serverTime: new Date().toISOString(),
  hasMore: false,
})

/** A feed page carrying one tombstone for `entity`. */
const feedWithDeletion = (entity, id, purged = false) => {
  const feed = emptyFeed()
  feed.entities[entity].deleted = [{
    entity, id: purged ? null : id, deletedAt: new Date().toISOString(), purged,
  }]
  return feed
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

const { createLocal, updateLocal, deleteLocal } = await vite.ssrLoadModule('/src/offline/write/mutations.js')
const { drain, DRAIN_RESULT } = await vite.ssrLoadModule('/src/offline/write/processor.js')
const { isLocalId } = await vite.ssrLoadModule('/src/offline/write/localId.js')
const { openDatabase, closeAll } = await vite.ssrLoadModule('/src/offline/db/database.js')
const { STORE, QUEUE_STATUS, OPERATION, SYNC_STATUS } = await vite.ssrLoadModule('/src/offline/db/schema.js')
const { readLocalLeads, readLocalLead, readLocalContacts, readLocalCompanies, readLocalLeadFacets } =
  await vite.ssrLoadModule('/src/offline/read/localReads.js')
const { hydrate } = await vite.ssrLoadModule('/src/offline/sync/hydrate.js')

const U = 'phase6-user-000000001'
const USER = { id: U, displayName: 'Tester', email: 't@x.invalid', role: 'manager' }

const queueOf = async (userId = U) => (await openDatabase(userId)).getAll(STORE.SYNC_QUEUE)
const recordsOf = async (store, userId = U) => (await openDatabase(userId)).getAll(store)
const clearAll = async (userId = U) => {
  const db = await openDatabase(userId)
  for (const store of [STORE.LEADS, STORE.CONTACTS, STORE.COMPANIES, STORE.SYNC_QUEUE, STORE.SYNC_META]) {
    const tx = db.transaction(store, 'readwrite')
    await tx.store.clear()
    await tx.done
  }
}

/** Seeds a server-backed record, as hydration would have left it. */
const seedSynced = async (store, id, fields, updatedAt = '2026-01-01T00:00:00.000Z') => {
  const db = await openDatabase(U)
  await db.put(store, {
    ...fields, id, updatedAt,
    _sync: {
      owner: U, status: SYNC_STATUS.SYNCED, serverUpdatedAt: updatedAt,
      localVersion: 0, deletedLocally: false, lastSyncedAt: updatedAt,
    },
  })
  return id
}

// ---------------------------------------------------------------------------
section('1. OFFLINE DELETE — all three entities')

resetServer()
await clearAll()

await seedSynced(STORE.LEADS, '5f0000000000000000000001', { reference: 'DEL0001', contactPerson: 'Arun', market: 'AU', stage: 'active' })
await seedSynced(STORE.CONTACTS, '5f0000000000000000000002', { displayName: 'Bina Shah', primaryEmail: 'b@x.invalid' })
await seedSynced(STORE.COMPANIES, '5f0000000000000000000003', { companyName: 'Gamma Ltd' })

const dLead = await deleteLocal('leads', '5f0000000000000000000001', { userId: U })
const dContact = await deleteLocal('contacts', '5f0000000000000000000002', { userId: U })
const dCompany = await deleteLocal('companies', '5f0000000000000000000003', { userId: U })

check(dLead.cancelled === false, '1. a lead delete was queued rather than cancelled')
check(dContact.cancelled === false, '2. a contact delete was queued')
check(dCompany.cancelled === false, '3. a company delete was queued')

const queued = await queueOf()
check(queued.length === 3, '   three queue entries exist', String(queued.length))
check(queued.every((e) => e.operation === OPERATION.DELETE), '   all are DELETE operations')
check(queued.every((e) => e.baseUpdatedAt === '2026-01-01T00:00:00.000Z'),
  '4. each carries the version it was based on — the conflict check needs it')

check((await recordsOf(STORE.LEADS)).length === 1,
  '5. the local row is kept, not destroyed — the sync still needs it')
check((await recordsOf(STORE.LEADS))[0]._sync.deletedLocally === true, '   but tombstoned')
check((await recordsOf(STORE.LEADS))[0]._sync.status === SYNC_STATUS.PENDING_DELETE, '   as pendingDelete')

// ---------------------------------------------------------------------------
section('2. A LOCALLY DELETED RECORD DISAPPEARS FROM EVERY READ')

check((await readLocalLeads({}, { userId: U })).pagination.total === 0,
  '6. it is gone from the lead list', String((await readLocalLeads({}, { userId: U })).pagination.total))
check(await readLocalLead('5f0000000000000000000001', { userId: U }) === null,
  '7. and from the detail read')
check((await readLocalContacts({}, { userId: U })).pagination.total === 0, '8. contacts too')
check((await readLocalCompanies({}, { userId: U })).pagination.total === 0, '9. companies too')

const facets = await readLocalLeadFacets({ userId: U })
check(facets.cities.length === 0 && facets.markets.length === 0,
  '10. and it contributes nothing to facets or counts')

const searched = await readLocalLeads({ search: 'Arun' }, { userId: U })
check(searched.pagination.total === 0, '11. offline search cannot find it either')

// ---------------------------------------------------------------------------
section('3. THE DELETE REACHES THE SERVER WITH ITS VERSION')

const drained = await drain({ userId: U })
check(drained.result === DRAIN_RESULT.COMPLETED, '12. the drain completed', drained.result)
check(drained.succeeded === 3, '    all three deletes were accepted', String(drained.succeeded))
check(server_.deleted.length === 3, '    three DELETE requests were sent', String(server_.deleted.length))

const sentDelete = server_.requests.find((r) => r.method === 'DELETE')
check(sentDelete.version === '2026-01-01T00:00:00.000Z',
  '13. carrying X-Expected-Updated-At', sentDelete.version)
check(Boolean(sentDelete.mutationId), '    and an idempotency key')

const afterDrain = await queueOf()
check(afterDrain.every((e) => e.status === QUEUE_STATUS.COMPLETED), '14. every entry is completed')
check((await recordsOf(STORE.LEADS))[0]._sync.deletedLocally === true,
  '    and the local tombstone remains — the server agreed with it')

// ---------------------------------------------------------------------------
section('4. OFFLINE CREATE → DELETE cancels without touching the server')

resetServer()
await clearAll()

const made = await createLocal('leads', { contactPerson: 'Never Synced', market: 'AU' }, { userId: U })
check((await queueOf()).length === 1, '15. the create was queued')

const cancelled = await deleteLocal('leads', made.record.id, { userId: U })
check(cancelled.cancelled === true, '16. deleting it cancelled the create outright')
check((await queueOf()).length === 0, '17. no orphan queue entry remains', String((await queueOf()).length))
check((await recordsOf(STORE.LEADS)).length === 0, '18. and the local record is gone entirely',
  String((await recordsOf(STORE.LEADS)).length))

const nothingToDo = await drain({ userId: U })
check(nothingToDo.result === DRAIN_RESULT.IDLE, '19. the drain has nothing to send', nothingToDo.result)
check(server_.requests.length === 0,
  '20. NO request reached the server — the record never existed there', String(server_.requests.length))

// A new create afterwards must get a brand-new local id.
const remade = await createLocal('leads', { contactPerson: 'Second Attempt', market: 'AU' }, { userId: U })
check(remade.record.id !== made.record.id, '21. a later create gets a fresh local id — ids are never recycled')
check(isLocalId(remade.record.id), '    and it is still a local id')

// ---------------------------------------------------------------------------
section('5. OFFLINE EDIT → DELETE collapses to one DELETE')

resetServer()
await clearAll()
await seedSynced(STORE.LEADS, '5f0000000000000000000010', { reference: 'DEL0010', contactPerson: 'Chetan', market: 'AU', city: 'Pune' })

await updateLocal('leads', '5f0000000000000000000010', { city: 'Delhi' }, { userId: U })
check((await queueOf()).length === 1, '22. the edit was queued')
check((await queueOf())[0].operation === OPERATION.UPDATE, '    as an UPDATE')

await deleteLocal('leads', '5f0000000000000000000010', { userId: U })
const collapsed = await queueOf()
check(collapsed.length === 1, '23. still exactly one entry — the edit was replaced, not followed',
  String(collapsed.length))
check(collapsed[0].operation === OPERATION.DELETE, '24. and it is a DELETE', collapsed[0].operation)
check(collapsed[0].baseUpdatedAt === '2026-01-01T00:00:00.000Z',
  '25. carrying the version the user was actually looking at', collapsed[0].baseUpdatedAt)

await drain({ userId: U })
check(server_.requests.filter((r) => r.method === 'PUT').length === 0,
  '26. no stale edit was sent to the server', String(server_.requests.filter((r) => r.method === 'PUT').length))
check(server_.deleted.length === 1, '27. only the delete was sent')

// ---------------------------------------------------------------------------
section('6. A 409 BECOMES A CONFLICT, AND IS NEVER RETRIED')

resetServer()
await clearAll()
await seedSynced(STORE.LEADS, '5f0000000000000000000020', { reference: 'DEL0020', contactPerson: 'Deepa', market: 'AU' })

await updateLocal('leads', '5f0000000000000000000020', { city: 'Kochi' }, { userId: U })
server_.script = [conflict({
  entity: 'leads', id: '5f0000000000000000000020',
  expectedUpdatedAt: '2026-01-01T00:00:00.000Z',
  serverUpdatedAt: '2026-03-01T00:00:00.000Z',
})]

const conflicted = await drain({ userId: U })
check(conflicted.result === DRAIN_RESULT.COMPLETED, '28. the drain finished rather than stopping')

const conflictEntry = (await queueOf())[0]
check(conflictEntry.status === QUEUE_STATUS.CONFLICT, '29. the entry is marked conflict', conflictEntry.status)
check(conflictEntry.payload.city === 'Kochi', '30. the local change is preserved verbatim')
check(conflictEntry.httpStatus === 409, '31. the HTTP status is recorded', String(conflictEntry.httpStatus))
check(conflictEntry.conflict?.serverUpdatedAt === '2026-03-01T00:00:00.000Z',
  '32. and the server version the conflict reported', conflictEntry.conflict?.serverUpdatedAt)
check(conflictEntry.conflict?.baseUpdatedAt === '2026-01-01T00:00:00.000Z',
  '    alongside the version it was based on')
check(Boolean(conflictEntry.conflict?.detectedAt), '    and when it was detected')

// The critical property: a later drain must leave it alone.
resetServer()
const second = await drain({ userId: U })
check(second.result === DRAIN_RESULT.IDLE, '33. a later drain treats the queue as idle', second.result)
check(server_.requests.length === 0, '34. the conflict was NOT retried', String(server_.requests.length))
check((await queueOf())[0].status === QUEUE_STATUS.CONFLICT, '35. and it is still a conflict')
check((await queueOf())[0].payload.city === 'Kochi', '36. still recoverable')

// ---------------------------------------------------------------------------
section('7. REMOTE DELETION — no resurrection')

resetServer()
await clearAll()
await seedSynced(STORE.LEADS, '5f0000000000000000000030', { reference: 'DEL0030', contactPerson: 'Esha', market: 'AU' })

server_.changes = feedWithDeletion('leads', '5f0000000000000000000030')
await hydrate({ user: USER, entities: ['leads'] })

check((await recordsOf(STORE.LEADS))[0]._sync.deletedLocally === true,
  '37. a server tombstone tombstones the local record')
check((await readLocalLeads({}, { userId: U })).pagination.total === 0,
  '38. and it leaves the active dataset')

// Hydrating again with an empty feed must not bring it back.
resetServer()
server_.changes = emptyFeed()
await hydrate({ user: USER, entities: ['leads'] })
check((await recordsOf(STORE.LEADS))[0]._sync.deletedLocally === true,
  '39. a later sync does NOT resurrect it')
check((await readLocalLeads({}, { userId: U })).pagination.total === 0, '40. it stays gone')

// ---------------------------------------------------------------------------
section('8. REMOTE DELETION vs A PENDING LOCAL EDIT')

resetServer()
await clearAll()
await seedSynced(STORE.LEADS, '5f0000000000000000000040', { reference: 'DEL0040', contactPerson: 'Farid', market: 'AU' })

await updateLocal('leads', '5f0000000000000000000040', { city: 'Mysore' }, { userId: U })
check((await queueOf())[0].status === QUEUE_STATUS.PENDING, '41. an edit is queued and pending')

server_.changes = feedWithDeletion('leads', '5f0000000000000000000040')
await hydrate({ user: USER, entities: ['leads'] })

const orphaned = (await queueOf())[0]
check(orphaned.status === QUEUE_STATUS.CONFLICT,
  '42. the server deleting it turns the queued edit into a conflict', orphaned.status)
check(orphaned.payload.city === 'Mysore', '43. the edit is NOT silently discarded')
check(orphaned.conflict?.conflictType === 'deletedOnServer', '44. classified as deletedOnServer',
  orphaned.conflict?.conflictType)
check(orphaned.conflict?.serverDeleted === true, '45. recording that the server deleted it')

resetServer()
const noRetry = await drain({ userId: U })
check(server_.requests.length === 0, '46. and it is never pushed — no resurrection attempt',
  String(server_.requests.length))
check(noRetry.result === DRAIN_RESULT.IDLE, '    the drain is idle')

// ---------------------------------------------------------------------------
section('9. REMOTE DELETION vs A PENDING LOCAL DELETE — they agree')

resetServer()
await clearAll()
await seedSynced(STORE.LEADS, '5f0000000000000000000050', { reference: 'DEL0050', contactPerson: 'Gita', market: 'AU' })

await deleteLocal('leads', '5f0000000000000000000050', { userId: U })
check((await queueOf())[0].operation === OPERATION.DELETE, '47. a local delete is queued')

server_.changes = feedWithDeletion('leads', '5f0000000000000000000050')
await hydrate({ user: USER, entities: ['leads'] })

const agreed = (await queueOf())[0]
check(agreed.status === QUEUE_STATUS.COMPLETED,
  '48. both parties agree, so the mutation is completed rather than conflicted', agreed.status)

resetServer()
await drain({ userId: U })
check(server_.requests.length === 0,
  '49. no DELETE request was sent for a record already gone', String(server_.requests.length))
check((await readLocalLeads({}, { userId: U })).pagination.total === 0, '50. and it converged to deleted')

// ---------------------------------------------------------------------------
section('10. PURGE TOMBSTONES KEEP THEIR SEMANTICS')

resetServer()
await clearAll()
for (let i = 1; i <= 5; i += 1) {
  await seedSynced(STORE.LEADS, `5f000000000000000000006${i}`, { reference: `PUR000${i}`, contactPerson: `P${i}`, market: 'AU' })
}
check((await readLocalLeads({}, { userId: U })).pagination.total === 5, '51. five leads are cached')

server_.changes = feedWithDeletion('leads', null, true)
await hydrate({ user: USER, entities: ['leads'] })

check((await readLocalLeads({}, { userId: U })).pagination.total === 0,
  '52. one purge row cleared all five from the active dataset')
check((await recordsOf(STORE.LEADS)).length === 5,
  '53. every row is retained and tombstoned — nothing was destroyed',
  String((await recordsOf(STORE.LEADS)).length))
check((await recordsOf(STORE.LEADS)).every((r) => r._sync.deletedLocally === true), '    all tombstoned')
check((await queueOf()).length === 0,
  '54. and a purge produced no client mutations at all — it is still one feed row')

// ---------------------------------------------------------------------------
section('11. RESTART — deletions and the queue survive')

resetServer()
await clearAll()
await seedSynced(STORE.LEADS, '5f0000000000000000000070', { reference: 'DEL0070', contactPerson: 'Hari', market: 'AU' })
await deleteLocal('leads', '5f0000000000000000000070', { userId: U })
await closeAll()

check((await queueOf()).length === 1, '55. the delete mutation survived a database reopen')
check((await queueOf())[0].operation === OPERATION.DELETE, '    still a DELETE')
check((await recordsOf(STORE.LEADS))[0]._sync.deletedLocally === true, '56. and the tombstone survived')
check((await readLocalLeads({}, { userId: U })).pagination.total === 0, '57. it is still hidden from reads')

// ---------------------------------------------------------------------------
section('12. ORDERING — CREATE → EDIT → DELETE on a synced record')

resetServer()
await clearAll()
await seedSynced(STORE.LEADS, '5f0000000000000000000080', { reference: 'DEL0080', contactPerson: 'Iqbal', market: 'AU' })

await updateLocal('leads', '5f0000000000000000000080', { city: 'A' }, { userId: U })
await updateLocal('leads', '5f0000000000000000000080', { city: 'B' }, { userId: U })
await deleteLocal('leads', '5f0000000000000000000080', { userId: U })

const finalQueue = await queueOf()
check(finalQueue.length === 1, '58. two edits and a delete collapsed to one mutation', String(finalQueue.length))
check(finalQueue[0].operation === OPERATION.DELETE, '59. and it is the DELETE — the user’s final intent')

await drain({ userId: U })
check(server_.requests.length === 1, '60. exactly one request was sent', String(server_.requests.length))
check(server_.requests[0].method === 'DELETE', '    and it was the delete')

// ---------------------------------------------------------------------------
section('13. A PROCESSING ENTRY IS NEVER COALESCED INTO')

resetServer()
await clearAll()
await seedSynced(STORE.LEADS, '5f0000000000000000000090', { reference: 'DEL0090', contactPerson: 'Jaya', market: 'AU' })

await updateLocal('leads', '5f0000000000000000000090', { city: 'InFlight' }, { userId: U })
const db = await openDatabase(U)
const inFlight = (await queueOf())[0]
await db.put(STORE.SYNC_QUEUE, { ...inFlight, status: QUEUE_STATUS.PROCESSING })

await deleteLocal('leads', '5f0000000000000000000090', { userId: U })
const both = await queueOf()
check(both.length === 2, '61. a new DELETE was queued rather than mutating the in-flight entry',
  String(both.length))
check(both.find((e) => e.status === QUEUE_STATUS.PROCESSING)?.payload.city === 'InFlight',
  '62. the processing entry was left exactly as the processor left it')

// ---------------------------------------------------------------------------
section('14. SECURITY — ownership and credentials')

await clearAll()
await seedSynced(STORE.LEADS, '5f00000000000000000000a0', { reference: 'SEC0001', contactPerson: 'Secure', market: 'AU' })
await deleteLocal('leads', '5f00000000000000000000a0', { userId: U })

const dump = JSON.stringify([...(await queueOf()), ...(await recordsOf(STORE.LEADS))])
for (const secret of ['password', 'accessToken', 'refreshToken', 'clientSecret', 'sessionId', 'Authorization']) {
  check(!dump.includes(secret), `63. no "${secret}" is stored`)
}

const OTHER = 'phase6-other-00000001'
check((await recordsOf(STORE.LEADS, OTHER)).length === 0, "64. another user's database is untouched")
check((await queueOf(OTHER)).length === 0, "    and their queue is empty")

let refused = null
try { await deleteLocal('leads', '5f00000000000000000000a0', {}) } catch (e) { refused = e }
check(Boolean(refused), '65. a delete with no user id is refused')

let missing = null
try { await deleteLocal('leads', 'does-not-exist', { userId: U }) } catch (e) { missing = e }
check(Boolean(missing), '66. deleting an uncached record is refused rather than invented')

// ---------------------------------------------------------------------------
await closeAll()
await vite.close()

console.log(`\n${failures === 0 ? `ALL ${checks} CHECKS PASSED` : `${failures} of ${checks} FAILED`}`)
process.exit(failures === 0 ? 0 : 1)
