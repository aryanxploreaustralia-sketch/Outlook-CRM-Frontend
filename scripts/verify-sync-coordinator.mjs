/**
 * Phase 7 — the sync coordinator: reconnect, ordering, backoff, crash recovery
 * and the pull/push race.
 *
 * ## How the server is stood in for
 *
 * `@/api/httpClient` is aliased, so the **real** coordinator, the **real**
 * processor, the **real** hydration layer and the **real** API services all
 * execute. The fixture only decides what the network says back, and records
 * every request so ordering can be asserted rather than assumed.
 *
 * ## Safety
 *
 * No MongoDB connection. No network request. No production data. IndexedDB is
 * `fake-indexeddb`, held in this process's memory and gone when it exits.
 *
 *     npm run verify:sync-coordinator
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

const server_ = { requests: [], script: [], changes: null, deleted: [], seq: 0 }
const resetServer = () => {
  server_.requests = []
  server_.script = []
  server_.changes = null
  server_.deleted = []
  server_.seq = 0
}

const err = (over) => Object.assign(new Error(over.message ?? 'failed'), {
  status: null, details: null, isNetwork: false, isCanceled: false, ...over,
})

const emptyFeed = () => ({
  entities: {
    leads: { entity: 'leads', records: [], deleted: [], nextCursor: null, hasMore: false },
    contacts: { entity: 'contacts', records: [], deleted: [], nextCursor: null, hasMore: false },
    companies: { entity: 'companies', records: [], deleted: [], nextCursor: null, hasMore: false },
  },
  serverTime: new Date().toISOString(),
  hasMore: false,
})

const feedWith = (entity, records = [], deleted = []) => {
  const feed = emptyFeed()
  feed.entities[entity] = {
    entity, records, deleted,
    nextCursor: records.length ? `cursor-${entity}-${records.length}` : null,
    hasMore: false,
  }
  return feed
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

globalThis.__fixture = {
  async request(method, url, body, config = {}) {
    const headers = config?.headers ?? {}
    const kind = url.includes('/sync/changes') ? 'pull' : 'push'
    server_.requests.push({
      kind, method, url, body,
      mutationId: headers['X-Client-Mutation-Id'] ?? null,
      version: headers['X-Expected-Updated-At'] ?? null,
    })

    const scripted = server_.script.shift()
    if (scripted) throw scripted

    server_.seq += 1

    if (kind === 'pull') return { data: { success: true, data: server_.changes ?? emptyFeed() } }

    const entity = url.includes('/contacts') ? 'contacts'
      : url.includes('/companies') ? 'companies' : 'leads'

    if (method === 'DELETE') {
      const id = url.split('/').pop()
      server_.deleted.push(id)
      return { data: { success: true, data: { id, deleted: true } } }
    }

    const id = method === 'POST' ? `5f${String(server_.seq).padStart(22, '0')}` : url.split('/').pop()
    const record = {
      ...body, id, owner: 'server-decides',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: `2026-05-0${Math.min(9, server_.seq)}T00:00:00.000Z`,
    }
    const wrapped = entity === 'leads'
      ? { lead: record, company: null, contact: null, mail: { sent: false }, warnings: [] }
      : entity === 'contacts' ? { contact: record, possibleDuplicates: [] } : { company: record }

    return { data: { success: true, data: wrapped } }
  },
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

const coordinator = await vite.ssrLoadModule('/src/offline/sync/coordinator.js')
const {
  runSync, SYNC_STATE, SYNC_META, BACKOFF_MS, STALE_PROCESSING_MS,
  recoverStaleProcessing, resetCoordinator, nextAttempt, onSyncState,
} = coordinator
const { createLocal, updateLocal, deleteLocal } = await vite.ssrLoadModule('/src/offline/write/mutations.js')
const { openDatabase, closeAll } = await vite.ssrLoadModule('/src/offline/db/database.js')
const { STORE, QUEUE_STATUS, OPERATION, SYNC_STATUS } = await vite.ssrLoadModule('/src/offline/db/schema.js')
const { META, metaKey, syncMetaRepository } = await vite.ssrLoadModule('/src/offline/repositories/syncMetaRepository.js')
const { readLocalLeads } = await vite.ssrLoadModule('/src/offline/read/localReads.js')

const U = 'phase7-user-000000001'
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
  resetCoordinator()
}

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

/**
 * `navigator.onLine` is read by the coordinator; this controls it.
 *
 * Node exposes `navigator` as a getter-only property, so it is redefined rather
 * than assigned. That is the whole reason this helper exists instead of a plain
 * assignment at each call site.
 */
const setOnline = (value) => {
  Object.defineProperty(globalThis, 'navigator', {
    value: { onLine: value },
    configurable: true,
    writable: true,
  })
}
setOnline(true)

// ---------------------------------------------------------------------------
section('1. ORDER — push before pull')

resetServer()
await clearAll()
await createLocal('leads', { contactPerson: 'Order Case', market: 'AU' }, { userId: U })

const ordered = await runSync({ user: USER, reason: 'startup' })
check(ordered.ran === true, '1. the sync ran', String(ordered.ran))
check(ordered.status === SYNC_STATE.IDLE, '   and finished idle', ordered.status)

const kinds = server_.requests.map((r) => r.kind)
check(kinds[0] === 'push', '2. the FIRST request was the push — local work goes first', kinds.join(' → '))
check(kinds.includes('pull'), '   and a pull followed')
check(kinds.indexOf('push') < kinds.indexOf('pull'), '3. push strictly precedes pull')

// ---------------------------------------------------------------------------
section('2. ONE AT A TIME')

resetServer()
await clearAll()
await createLocal('leads', { contactPerson: 'Lock Case', market: 'AU' }, { userId: U })

const [a, b] = await Promise.all([
  runSync({ user: USER, reason: 'startup' }),
  runSync({ user: USER, reason: 'online' }),
])
const ran = [a, b].filter((r) => r.ran)
const busy = [a, b].filter((r) => r.busy)
check(ran.length === 1, '4. exactly one concurrent sync ran', String(ran.length))
check(busy.length === 1, '   the other was told it was busy', String(busy.length))
check(server_.requests.filter((r) => r.kind === 'push').length === 1,
  '5. only one push request was sent', String(server_.requests.filter((r) => r.kind === 'push').length))

// ---------------------------------------------------------------------------
section('3. OFFLINE — no network attempt at all')

resetServer()
await clearAll()
setOnline(false)
await createLocal('leads', { contactPerson: 'Offline Case', market: 'AU' }, { userId: U })

const offline = await runSync({ user: USER, reason: 'online' })
check(offline.ran === false, '6. a sync while certainly offline does not run', String(offline.ran))
check(offline.status === SYNC_STATE.OFFLINE, '   and reports offline', offline.status)
check(server_.requests.length === 0, '7. NO request was made', String(server_.requests.length))
check((await queueOf()).length === 1, '8. and the queued mutation is untouched')

setOnline(true)
const reconnected = await runSync({ user: USER, reason: 'online' })
check(reconnected.ran === true, '9. reconnecting runs the sync')
check(reconnected.push.succeeded === 1, '   and drains the queue', String(reconnected.push.succeeded))
check((await queueOf())[0].status === QUEUE_STATUS.COMPLETED, '10. the mutation completed')

// ---------------------------------------------------------------------------
section('4. THE PULL MUST NOT OVERWRITE AN UNSYNCED LOCAL EDIT')

resetServer()
await clearAll()
await seedSynced(STORE.LEADS, '5f0000000000000000000001',
  { reference: 'SY0001', contactPerson: 'Original', market: 'AU', city: 'Mumbai' })

await updateLocal('leads', '5f0000000000000000000001', { city: 'Local Edit' }, { userId: U })

/*
 * The push hits a 5xx. That is the realistic way a mutation is still pending
 * when the pull runs in the SAME cycle: a 5xx is retryable, so the entry stays
 * `pending` and the drain carries on rather than stopping the run. The pull
 * then arrives carrying the server's version of that very record.
 *
 * Before Phase 7 this overwrote the local row and the user's typing vanished
 * from the register while its mutation sat in the queue claiming to be pending.
 */
server_.script = [err({ status: 500 })]
server_.changes = feedWith('leads', [{
  id: '5f0000000000000000000001', reference: 'SY0001', contactPerson: 'Original',
  market: 'AU', city: 'Mumbai', isDeleted: false, updatedAt: '2026-01-01T00:00:00.000Z',
}])

await runSync({ user: USER, reason: 'online' })

check((await queueOf())[0].status === QUEUE_STATUS.PENDING,
  '11. the 5xx left the mutation pending and the run continued', (await queueOf())[0].status)

const guardedRecord = await (await openDatabase(U)).get(STORE.LEADS, '5f0000000000000000000001')
check(guardedRecord.city === 'Local Edit',
  '12. the local edit SURVIVED the pull — it was not overwritten', guardedRecord.city)
check((await queueOf())[0].status === QUEUE_STATUS.PENDING,
  '13. and it is still pending, not conflicted — the server had not moved')
check(guardedRecord._sync.serverUpdatedAt === '2026-01-01T00:00:00.000Z',
  '   the server version was recorded as metadata all the same')

// ---------------------------------------------------------------------------
section('5. SERVER CHANGE + LOCAL EDIT → conflict, detected on pull')

resetServer()
resetCoordinator()
server_.script = [err({ status: 500 })]
server_.changes = feedWith('leads', [{
  id: '5f0000000000000000000001', reference: 'SY0001', contactPerson: 'Somebody Else Edited',
  market: 'AU', city: 'Server City', isDeleted: false, updatedAt: '2026-04-01T00:00:00.000Z',
}])

const conflictRun = await runSync({ user: USER, reason: 'online' })

const conflicted = (await queueOf())[0]
check(conflicted.status === QUEUE_STATUS.CONFLICT,
  '14. the server moving under a queued edit raises a conflict', conflicted.status)
check(conflicted.payload.city === 'Local Edit', '15. the local change is preserved verbatim')
check(conflicted.conflict?.serverUpdatedAt === '2026-04-01T00:00:00.000Z',
  '16. recording the server version', conflicted.conflict?.serverUpdatedAt)
check(conflicted.conflict?.detectedBy === 'pull', '17. and that the pull detected it',
  conflicted.conflict?.detectedBy)
check(conflictRun.status === SYNC_STATE.CONFLICT,
  '   the run reported conflict rather than a clean idle', conflictRun.status)

const stillLocal = await (await openDatabase(U)).get(STORE.LEADS, '5f0000000000000000000001')
check(stillLocal.city === 'Local Edit',
  '18. the local record still shows the user’s value — nothing was silently adopted')

// ---------------------------------------------------------------------------
section('6. A CONFLICT IS NEVER DRAINED')

resetServer()
resetCoordinator()
server_.changes = feedWith('leads', [{
  id: '5f0000000000000000000001', reference: 'SY0001', contactPerson: 'Changed Again',
  market: 'AU', city: 'Server City 2', isDeleted: false, updatedAt: '2026-04-02T00:00:00.000Z',
}])
const afterConflict = await runSync({ user: USER, reason: 'manual', force: true })

check(afterConflict.status === SYNC_STATE.CONFLICT,
  '19. the sync still reports conflict', afterConflict.status)
check(server_.requests.filter((r) => r.kind === 'push').length === 0,
  '20. no push was attempted for the conflicted mutation',
  String(server_.requests.filter((r) => r.kind === 'push').length))
check((await queueOf())[0].status === QUEUE_STATUS.CONFLICT, '21. it is still a conflict')
check((await queueOf())[0].payload.city === 'Local Edit', '22. and still recoverable')
check((await (await openDatabase(U)).get(STORE.LEADS, '5f0000000000000000000001')).city === 'Local Edit',
  '   a second pull did not overwrite it either')

// ---------------------------------------------------------------------------
section('7. CURSORS ADVANCE ONLY AFTER A SUCCESSFUL WRITE')

resetServer()
await clearAll()

server_.changes = feedWith('leads', [{
  id: '5f0000000000000000000002', reference: 'SY0002', contactPerson: 'Cursor Case',
  market: 'AU', isDeleted: false, updatedAt: '2026-02-01T00:00:00.000Z',
}])
await runSync({ user: USER, reason: 'startup' })

const cursorAfter = await syncMetaRepository.get(metaKey(META.CURSOR, 'leads'), { userId: U })
check(cursorAfter === 'cursor-leads-1', '23. the cursor advanced after the write landed', String(cursorAfter))
check((await recordsOf(STORE.LEADS)).length === 1, '    and the record is stored')

// A failing pull must not move it.
resetServer()
resetCoordinator()
server_.script = [err({ status: 500 })]
await runSync({ user: USER, reason: 'manual', force: true })

const cursorStill = await syncMetaRepository.get(metaKey(META.CURSOR, 'leads'), { userId: U })
check(cursorStill === 'cursor-leads-1', '24. a failed pull left the cursor exactly where it was', String(cursorStill))

// ---------------------------------------------------------------------------
section('8. PARTIAL FAILURE PRESERVES SUCCESSFUL PROGRESS')

resetServer()
await clearAll()

/*
 * Leads succeed; contacts fail. Hydration walks the entities in order and
 * persists each cursor after its own writes, so the lead cursor must survive
 * the contact failure.
 */
server_.changes = feedWith('leads', [{
  id: '5f0000000000000000000003', reference: 'SY0003', contactPerson: 'Partial',
  market: 'AU', isDeleted: false, updatedAt: '2026-02-02T00:00:00.000Z',
}])
server_.script = [null, err({ status: 500 })].filter(Boolean)
// The first pull request (leads) succeeds, the second (contacts) throws.
server_.script = []
let pullCount = 0
const originalRequest = globalThis.__fixture.request
globalThis.__fixture.request = async function patched(method, url, body, config) {
  if (url.includes('/sync/changes')) {
    pullCount += 1
    if (pullCount === 2) throw err({ status: 500 })
  }
  return originalRequest.call(this, method, url, body, config)
}

const partial = await runSync({ user: USER, reason: 'startup' })
globalThis.__fixture.request = originalRequest

check(partial.status === SYNC_STATE.PARTIAL, '25. the sync reported partial', partial.status)
const leadCursor = await syncMetaRepository.get(metaKey(META.CURSOR, 'leads'), { userId: U })
check(leadCursor === 'cursor-leads-1', '26. the successful entity kept its cursor', String(leadCursor))
const contactCursor = await syncMetaRepository.get(metaKey(META.CURSOR, 'contacts'), { userId: U })
check(!contactCursor, '27. the failed entity has no cursor to resume from a bad page',
  String(contactCursor))
check((await recordsOf(STORE.LEADS)).length === 1, '28. and the lead that landed was kept')

// ---------------------------------------------------------------------------
section('9. BACKOFF IS BOUNDED AND RESETS ON SUCCESS')

resetServer()
await clearAll()

server_.script = [err({ isNetwork: true })]
await runSync({ user: USER, reason: 'online' })
const firstBackoff = nextAttempt()
check(firstBackoff > Date.now(), '29. a failure set a retry window')

const requestsAfterFailure = server_.requests.length
const deferred = await runSync({ user: USER, reason: 'online' })
check(deferred.ran === false && deferred.deferred === true,
  '30. an automatic retry inside the window is deferred, not attempted', String(deferred.deferred))
check(server_.requests.length === requestsAfterFailure,
  '31. no request storm — the deferred attempt made no request at all',
  `${requestsAfterFailure} → ${server_.requests.length}`)

const forced = await runSync({ user: USER, reason: 'manual', force: true })
check(forced.ran === true, '32. a manual sync ignores the backoff window')

check(nextAttempt() === 0, '33. success cleared the backoff', String(nextAttempt()))
check(BACKOFF_MS[BACKOFF_MS.length - 1] === 900_000,
  '34. the schedule is bounded and stops growing', `${BACKOFF_MS.join(', ')}`)

// ---------------------------------------------------------------------------
section('10. AUTH FAILURE STOPS WITHOUT DESTROYING ANYTHING')

resetServer()
await clearAll()
await seedSynced(STORE.LEADS, '5f0000000000000000000004', { reference: 'SY0004', contactPerson: 'Auth', market: 'AU' })
await createLocal('leads', { contactPerson: 'Queued Before Expiry', market: 'AU' }, { userId: U })

server_.script = [err({ status: 401 })]
const expired = await runSync({ user: USER, reason: 'startup' })

check(expired.status === SYNC_STATE.UNAUTHENTICATED, '35. a 401 stops the sync', expired.status)
check((await queueOf()).length === 1, '36. the queue was NOT cleared', String((await queueOf()).length))
check((await queueOf())[0].status === QUEUE_STATUS.PENDING, '37. and the mutation is still pending')
check((await queueOf())[0].retryCount === 0, '38. a 401 did not burn the retry budget')
check((await recordsOf(STORE.LEADS)).length === 2, '39. local CRM data was NOT deleted',
  String((await recordsOf(STORE.LEADS)).length))
check(server_.requests.filter((r) => r.kind === 'pull').length === 0,
  '40. and the pull was skipped — no pointless second failure')

// ---------------------------------------------------------------------------
section('11. CRASH RECOVERY — a stuck "processing" entry')

resetServer()
await clearAll()
await createLocal('leads', { contactPerson: 'Interrupted', market: 'AU' }, { userId: U })

const db = await openDatabase(U)
const stuck = (await queueOf())[0]

// Recent: another tab may genuinely be sending it.
await db.put(STORE.SYNC_QUEUE, {
  ...stuck, status: QUEUE_STATUS.PROCESSING, lastAttemptAt: new Date().toISOString(),
})
check(await recoverStaleProcessing({ userId: U }) === 0,
  '41. a RECENT processing entry is left alone — another tab may own it')
check((await queueOf())[0].status === QUEUE_STATUS.PROCESSING, '    still processing')

// Old: nothing can still be sending it.
await db.put(STORE.SYNC_QUEUE, {
  ...stuck,
  status: QUEUE_STATUS.PROCESSING,
  lastAttemptAt: new Date(Date.now() - STALE_PROCESSING_MS - 1000).toISOString(),
})
check(await recoverStaleProcessing({ userId: U }) === 1, '42. a STALE processing entry is recovered')

const recovered = (await queueOf())[0]
check(recovered.status === QUEUE_STATUS.PENDING, '43. it returned to pending', recovered.status)
check(recovered.retryCount === 0,
  '44. without charging it a failed attempt — it may well have succeeded server-side',
  String(recovered.retryCount))
check(recovered.payload.contactPerson === 'Interrupted', '45. with its payload intact')

// And a full sync performs the recovery itself.
await db.put(STORE.SYNC_QUEUE, {
  ...stuck,
  status: QUEUE_STATUS.PROCESSING,
  lastAttemptAt: new Date(Date.now() - STALE_PROCESSING_MS - 1000).toISOString(),
})
resetServer()
resetCoordinator()
const recoveringRun = await runSync({ user: USER, reason: 'startup' })
check(recoveringRun.recovered === 1, '46. a sync recovers stale entries before draining',
  String(recoveringRun.recovered))
check(recoveringRun.push.succeeded === 1, '47. and then sends the recovered mutation')

// ---------------------------------------------------------------------------
section('12. RESTART — queue and cursors survive')

resetServer()
await clearAll()
await seedSynced(STORE.LEADS, '5f0000000000000000000005', { reference: 'SY0005', contactPerson: 'Restart', market: 'AU' })

await createLocal('contacts', { displayName: 'Queued Create', primaryEmail: 'q@x.invalid' }, { userId: U })
await updateLocal('leads', '5f0000000000000000000005', { city: 'Edited' }, { userId: U })
await deleteLocal('leads', '5f0000000000000000000005', { userId: U })
await syncMetaRepository.set(metaKey(META.CURSOR, 'leads'), 'cursor-survives', { userId: U })

await closeAll()

const afterRestart = await queueOf()
check(afterRestart.length === 2, '48. the queue survived the restart', String(afterRestart.length))
check(afterRestart.some((e) => e.operation === OPERATION.CREATE), '49. the queued CREATE survived')
check(afterRestart.some((e) => e.operation === OPERATION.DELETE),
  '50. the EDIT→DELETE collapse survived as a DELETE')
check(await syncMetaRepository.get(metaKey(META.CURSOR, 'leads'), { userId: U }) === 'cursor-survives',
  '51. and the cursor survived')

resetServer()
resetCoordinator()
server_.changes = emptyFeed()
const resumed = await runSync({ user: USER, reason: 'startup' })
check(resumed.push.succeeded === 2, '52. both mutations were sent after the restart',
  String(resumed.push.succeeded))
check(server_.requests.some((r) => r.method === 'POST'), '   the create was posted')
check(server_.requests.some((r) => r.method === 'DELETE'), '   the delete was sent')

// ---------------------------------------------------------------------------
section('13. PERSISTED METADATA — and no credentials')

const lastSync = await syncMetaRepository.get(metaKey(SYNC_META.LAST_SYNC_AT), { userId: U })
const lastSuccess = await syncMetaRepository.get(metaKey(SYNC_META.LAST_SUCCESS_AT), { userId: U })
check(Boolean(lastSync), '53. lastSyncAt was persisted', String(lastSync))
check(Boolean(lastSuccess), '54. lastSuccessfulSyncAt was persisted', String(lastSuccess))

resetServer()
resetCoordinator()
server_.script = [err({ isNetwork: true })]
await runSync({ user: USER, reason: 'online' })
const lastError = await syncMetaRepository.get(metaKey(SYNC_META.LAST_ERROR), { userId: U })
check(Boolean(lastError?.message), '55. lastSyncError was persisted', lastError?.message)

const allMeta = JSON.stringify(await syncMetaRepository.all({ userId: U }))
for (const secret of ['password', 'accessToken', 'refreshToken', 'clientSecret', 'sessionId', 'Authorization']) {
  check(!allMeta.includes(secret), `56. no "${secret}" in the persisted metadata`)
}

// ---------------------------------------------------------------------------
section('14. TOMBSTONES STILL RECONCILE THROUGH THE COORDINATOR')

resetServer()
await clearAll()
await seedSynced(STORE.LEADS, '5f0000000000000000000006', { reference: 'SY0006', contactPerson: 'Tombstoned', market: 'AU' })

server_.changes = feedWith('leads', [], [{
  entity: 'leads', id: '5f0000000000000000000006', deletedAt: new Date().toISOString(), purged: false,
}])
await runSync({ user: USER, reason: 'startup' })

check((await readLocalLeads({}, { userId: U })).pagination.total === 0,
  '57. a hard-delete tombstone removed it from the active dataset')
check((await recordsOf(STORE.LEADS)).length === 1, '58. the row is retained, not destroyed')

// A purge, through the coordinator.
resetServer()
await clearAll()
for (let i = 1; i <= 3; i += 1) {
  await seedSynced(STORE.LEADS, `5f00000000000000000000${10 + i}`, { reference: `PU000${i}`, contactPerson: `P${i}`, market: 'AU' })
}
server_.changes = feedWith('leads', [], [{
  entity: 'leads', id: null, deletedAt: new Date().toISOString(), purged: true,
}])
await runSync({ user: USER, reason: 'startup' })

check((await readLocalLeads({}, { userId: U })).pagination.total === 0, '59. a purge cleared the active dataset')
check((await recordsOf(STORE.LEADS)).length === 3, '60. all three rows retained')
check((await queueOf()).length === 0, '61. and a purge produced no client mutations')

// ---------------------------------------------------------------------------
section('15. STATE IS OBSERVABLE')

const seen = []
const unsubscribe = onSyncState((s) => seen.push(s.status))

resetServer()
await clearAll()
resetCoordinator()
server_.changes = emptyFeed()
await runSync({ user: USER, reason: 'manual', force: true })
unsubscribe()

check(seen.includes(SYNC_STATE.SYNCING), '62. subscribers saw the syncing state', seen.join(' → '))
check(seen[seen.length - 1] === SYNC_STATE.IDLE, '63. and the final idle state')

const unauth = await runSync({ user: null, reason: 'startup' })
check(unauth.ran === false, '64. a sync with no user does not run')
check(unauth.status === SYNC_STATE.UNAUTHENTICATED, '   and says why', unauth.status)

// ---------------------------------------------------------------------------
section('16. OWNER ISOLATION')

const OTHER = 'phase7-other-00000001'
check((await queueOf(OTHER)).length === 0, "65. another user's queue is empty")
check((await recordsOf(STORE.LEADS, OTHER)).length === 0, "66. and their records are empty")

// ---------------------------------------------------------------------------
await closeAll()
await vite.close()

console.log(`\n${failures === 0 ? `ALL ${checks} CHECKS PASSED` : `${failures} of ${checks} FAILED`}`)
process.exit(failures === 0 ? 0 : 1)
