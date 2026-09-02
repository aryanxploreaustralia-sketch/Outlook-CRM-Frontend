/**
 * Verifies the Phase 1 offline foundation.
 *
 * Runs the real modules — `schema.js`, `database.js` and every repository — on
 * an in-memory IndexedDB (`fake-indexeddb`), through Vite's SSR pipeline so the
 * `@/` aliases resolve exactly as they do in the browser.
 *
 * ## Safety
 *
 * No MongoDB connection. No network request. No production data of any kind.
 * The database this creates lives in this process's memory and is gone when it
 * exits — `fake-indexeddb` never touches the disk.
 *
 *     node scripts/verify-offline-db.mjs
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

const section = (title) => console.log(`\n=== ${title} ===`)

const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
})

const offline = await server.ssrLoadModule('/src/offline/index.js')

const {
  DATABASE_NAME, META_KEY, OPERATION, QUEUE_STATUS, SCHEMA_VERSION, STORE, STORES, SYNC_STATUS,
  closeAll, companiesRepository, contactsRepository, databaseName, describeDatabase,
  identityRepository, isAvailable, leadsRepository, metaOf, openDatabase,
  syncMetaRepository, syncQueueRepository,
} = offline

/** A test user id. Not a real account — this database is in memory. */
const USER = 'test-user-000000000001'
const opts = { userId: USER }

// ---------------------------------------------------------------------------
section('1. THE DATABASE OPENS')

check(isAvailable(), 'IndexedDB reports available')
const db = await openDatabase(USER)
check(Boolean(db), 'openDatabase resolved a connection')
check(db.name === `${DATABASE_NAME}:${USER}`, 'named per user', db.name)

// ---------------------------------------------------------------------------
section('2. EVERY EXPECTED OBJECT STORE EXISTS')

const described = await describeDatabase(USER)
const storeNames = described.stores.map((s) => s.name).sort()
const expected = Object.values(STORE).sort()

check(storeNames.length === 6, 'six stores created', storeNames.join(', '))
for (const name of expected) {
  check(storeNames.includes(name), `store "${name}" exists`)
}

// ---------------------------------------------------------------------------
section('3. EVERY EXPECTED INDEX EXISTS')

for (const definition of STORES) {
  const live = described.stores.find((s) => s.name === definition.name)
  check(live?.keyPath === definition.keyPath, `${definition.name} keyPath is "${definition.keyPath}"`, String(live?.keyPath))

  for (const index of definition.indexes) {
    const liveIndex = live?.indexes.find((i) => i.name === index.name)
    check(Boolean(liveIndex), `${definition.name}.${index.name} index exists`)
    check(liveIndex?.keyPath === index.keyPath,
      `${definition.name}.${index.name} points at "${index.keyPath}"`, String(liveIndex?.keyPath))
  }
}

console.log('\n  -- the collision this design exists to avoid --')
const contactsStore = described.stores.find((s) => s.name === STORE.CONTACTS)
const contactSyncIdx = contactsStore.indexes.find((i) => i.name === 'syncStatus')
check(contactSyncIdx.keyPath === `${META_KEY}.status`,
  'contacts.syncStatus indexes local metadata, NOT the Outlook field', contactSyncIdx.keyPath)

// ---------------------------------------------------------------------------
section('4-7. LEAD CRUD AGAINST THE LOCAL STORE')

/** A lead in the exact shape `Lead.toSummaryJSON()` returns. */
const lead = {
  id: 'aaaaaaaaaaaaaaaaaaaaaaa1',
  reference: 'XAMP9001',
  market: 'AU',
  contactPerson: 'Test Person',
  companyName: 'Test Travels',
  email: 'test@example.invalid',
  city: 'Mumbai',
  quoteDate: '2026-08-01T00:00:00.000Z',
  travelDate: '2026-12-15T00:00:00.000Z',
  travelDateText: null,
  paxText: '2A + 2C',
  adultCount: 2,
  childCount: 2,
  stage: 'active',
  stageLabel: 'Active',
  internalNotes: 'created by verify-offline-db',
  updatedAt: '2026-08-27T10:00:00.000Z',
  createdAt: '2026-08-01T10:00:00.000Z',
}

const stored = await leadsRepository.put(lead, { ...opts, owner: USER })
check(stored.id === lead.id, '4. insert: a lead was written')
check(stored.reference === 'XAMP9001', '   the API shape is preserved verbatim')
check(metaOf(stored).status === SYNC_STATUS.SYNCED, '   metadata defaults to synced')
check(metaOf(stored).owner === USER, '   owner stamped from the caller (API omits it)')
check(metaOf(stored).serverUpdatedAt === lead.updatedAt, '   serverUpdatedAt captured')

const readBack = await leadsRepository.get(lead.id, opts)
check(readBack?.reference === 'XAMP9001', '5. read: the lead came back')
check(readBack.stage === 'active' && readBack.paxText === '2A + 2C', '   every field intact')

const patched = await leadsRepository.patch(lead.id, { stage: 'confirmed' }, opts)
check(patched.stage === 'confirmed', '6. update: the change applied')
check(metaOf(patched).status === SYNC_STATUS.PENDING_UPDATE, '   marked pendingUpdate')
check(metaOf(patched).localVersion === 1, '   localVersion incremented')
check(patched.reference === 'XAMP9001', '   untouched fields survived the merge')

const tombstoned = await leadsRepository.markDeleted(lead.id, opts)
check(metaOf(tombstoned).deletedLocally === true, '7. delete: tombstoned, not removed')
check(metaOf(tombstoned).status === SYNC_STATUS.PENDING_DELETE, '   marked pendingDelete')
check(Boolean(await leadsRepository.get(lead.id, opts)), '   the row still exists locally')

await leadsRepository.remove(lead.id, opts)
check(!(await leadsRepository.get(lead.id, opts)), '   explicit remove() does delete it')

console.log('\n  -- indexes actually answer queries --')
await leadsRepository.putMany([
  { ...lead, id: 'idx1', stage: 'active', travelDate: '2026-09-05T00:00:00.000Z' },
  { ...lead, id: 'idx2', stage: 'closed', travelDate: '2026-09-20T00:00:00.000Z' },
  { ...lead, id: 'idx3', stage: 'active', travelDate: '2027-01-10T00:00:00.000Z' },
], { ...opts, owner: USER })

check((await leadsRepository.count(opts)) === 3, 'putMany wrote three in one transaction')
check((await leadsRepository.byStage('active', opts)).length === 2, 'byStage index returns 2 active')
check((await leadsRepository.byMarket('AU', opts)).length === 3, 'byMarket index returns 3')
const window_ = await leadsRepository.byTravelDateRange('2026-09-01', '2026-09-30', opts)
check(window_.length === 2, 'byTravelDateRange returns the 2 in September', String(window_.length))
check((await leadsRepository.byIndex('owner', USER, opts)).length === 3, 'owner index returns all 3')

// ---------------------------------------------------------------------------
section('8. SYNC QUEUE')

const op = await syncQueueRepository.enqueue({
  entity: STORE.LEADS,
  recordId: 'local-1',
  operation: OPERATION.CREATE,
  payload: { contactPerson: 'Queued Person' },
}, opts)

check(Boolean(op.opId), 'enqueue produced an opId (the idempotency key)', op.opId.slice(0, 12) + '…')
check(op.status === QUEUE_STATUS.PENDING, 'starts pending')
check(op.retryCount === 0, 'retryCount starts at 0')
check(op.lastError === null, 'lastError starts null')

const second = await syncQueueRepository.enqueue({
  entity: STORE.LEADS, recordId: 'local-2', operation: OPERATION.UPDATE, payload: {},
}, opts)
check(second.opId !== op.opId, 'each operation gets a distinct opId')

check((await syncQueueRepository.pendingCount(opts)) === 2, 'pendingCount is 2')
check((await syncQueueRepository.byRecord('local-1', opts)).length === 1, 'byRecord index works')

const failed = await syncQueueRepository.setStatus(op.opId, QUEUE_STATUS.FAILED, { ...opts, error: 'network' })
check(failed.status === QUEUE_STATUS.FAILED, 'setStatus moved it to failed')
check(failed.retryCount === 1, 'retryCount incremented on failure')
check(failed.lastError === 'network', 'the error was recorded')
check(Boolean(await syncQueueRepository.get(op.opId, opts)), 'a failed op is NOT discarded')

const completed = await syncQueueRepository.setStatus(second.opId, QUEUE_STATUS.COMPLETED, opts)
check(completed.status === QUEUE_STATUS.COMPLETED, 'an op can complete')
check((await syncQueueRepository.clearCompleted(opts)) === 1, 'clearCompleted removed only the completed one')
check((await syncQueueRepository.failedCount(opts)) === 1, 'the failed op survived clearCompleted')

let rejected = false
try {
  await syncQueueRepository.enqueue({ entity: 'leads', operation: 'DESTROY', payload: {} }, opts)
} catch { rejected = true }
check(rejected, 'an unknown operation is refused')

// ---------------------------------------------------------------------------
section('9. SYNC METADATA')

await syncMetaRepository.set('cursor', 'abc123', opts)
check((await syncMetaRepository.get('cursor', opts)) === 'abc123', 'set/get round trip')
check((await syncMetaRepository.get('missing', { ...opts, fallback: 'none' })) === 'none', 'fallback works')

await syncMetaRepository.setLastPull(STORE.LEADS, '2026-08-27T10:00:00.000Z', opts)
check((await syncMetaRepository.getLastPull(STORE.LEADS, opts)) === '2026-08-27T10:00:00.000Z',
  'per-entity lastPull round trip')

const allMeta = await syncMetaRepository.all(opts)
check(allMeta.cursor === 'abc123' && Boolean(allMeta['lastPull:leads']), 'all() returns a flat object')

// ---------------------------------------------------------------------------
section('10. IDENTITY — AND THAT IT REFUSES CREDENTIALS')

const identity = await identityRepository.save({
  userId: USER,
  displayName: 'Test User',
  email: 'test@example.invalid',
  role: 'manager',
  permissions: ['leads.view', 'leads.edit'],
  // Everything below must be dropped.
  accessToken: 'ya29.SHOULD-NOT-PERSIST',
  refreshToken: 'SHOULD-NOT-PERSIST',
  sessionId: 'SHOULD-NOT-PERSIST',
  password: 'SHOULD-NOT-PERSIST',
  clientSecret: 'SHOULD-NOT-PERSIST',
}, opts)

check(identity.userId === USER, 'identity saved')
check(identity.role === 'manager', 'role kept')
check(identity.permissions.length === 2, 'permissions kept')

const readIdentity = await identityRepository.get(opts)
const serialised = JSON.stringify(readIdentity)
for (const secret of ['accessToken', 'refreshToken', 'sessionId', 'password', 'clientSecret', 'SHOULD-NOT-PERSIST']) {
  check(!serialised.includes(secret), `"${secret}" was NOT stored`)
}

await identityRepository.clear(opts)
check((await identityRepository.get(opts)) === null, 'clear() removes the identity')
check((await leadsRepository.count(opts)) === 3, 'clear() left cached records untouched')
check((await syncQueueRepository.all(opts)).length === 1, 'clear() left queued work untouched')

// ---------------------------------------------------------------------------
section('11. SCHEMA VERSION')

check(described.version === SCHEMA_VERSION, `database is at version ${SCHEMA_VERSION}`, String(described.version))
check(SCHEMA_VERSION === 1, 'Phase 1 ships schema version 1')

// ---------------------------------------------------------------------------
section('12. THE DATABASE REOPENS WITH ITS DATA')

await closeAll()
const reopened = await openDatabase(USER)
check(reopened.version === SCHEMA_VERSION, 'reopened at the same version')
check((await leadsRepository.count(opts)) === 3, 'the three leads survived a close/reopen')
check((await syncQueueRepository.all(opts)).length === 1, 'the queued op survived')
check((await syncMetaRepository.get('cursor', opts)) === 'abc123', 'sync metadata survived')

console.log('\n  -- per-user isolation --')
const OTHER = 'test-user-000000000002'
await leadsRepository.put({ ...lead, id: 'other-1' }, { userId: OTHER, owner: OTHER })
check((await leadsRepository.count({ userId: OTHER })) === 1, "a second user's database holds only its own")
check((await leadsRepository.count(opts)) === 3, "the first user's database is unchanged")
check(databaseName(USER) !== databaseName(OTHER), 'the two use different database names')

// ---------------------------------------------------------------------------
section('13. NOTHING TOUCHES localStorage')

/*
 * The CRM uses localStorage for three UI preferences — sidebar collapsed,
 * column order, recent searches. The offline layer must not read or write it.
 */
const before = { 'oa.search.recent': '["mumbai"]', 'crm.leadColumns': '["reference"]' }
globalThis.localStorage = {
  _s: { ...before },
  getItem(k) { this._touched = true; return this._s[k] ?? null },
  setItem(k, v) { this._touched = true; this._s[k] = v },
  removeItem(k) { this._touched = true; delete this._s[k] },
  _touched: false,
}

await leadsRepository.put({ ...lead, id: 'ls-probe' }, { ...opts, owner: USER })
await syncQueueRepository.enqueue({ entity: 'leads', operation: OPERATION.CREATE, payload: {} }, opts)
await syncMetaRepository.set('probe', 1, opts)
await identityRepository.save({ userId: USER }, opts)

check(globalThis.localStorage._touched === false, 'the offline layer never touched localStorage')
check(globalThis.localStorage._s['oa.search.recent'] === before['oa.search.recent'], 'recent searches intact')
check(globalThis.localStorage._s['crm.leadColumns'] === before['crm.leadColumns'], 'column order intact')

// ---------------------------------------------------------------------------
section('EXTRA — CONTACTS AND COMPANIES')

await contactsRepository.put({
  id: 'c1', displayName: 'Jane', company: 'Test Travels',
  syncStatus: 'synced', lastSyncedAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-27T10:00:00.000Z',
}, { ...opts, owner: USER })

const contact = await contactsRepository.get('c1', opts)
check(contact.syncStatus === 'synced', "the Outlook field `syncStatus` survived intact")
check(contact.lastSyncedAt === '2026-08-01T00:00:00.000Z', 'the Outlook `lastSyncedAt` survived intact')
check(metaOf(contact).status === SYNC_STATUS.SYNCED, 'local status lives separately under _sync')
check((await contactsRepository.byCompany('Test Travels', opts)).length === 1, 'byCompany index works')

await companiesRepository.put({ id: 'co1', companyName: 'Test Travels', updatedAt: '2026-08-27T10:00:00.000Z' },
  { ...opts, owner: USER })
check((await companiesRepository.count(opts)) === 1, 'a company was cached')

console.log('\n  -- pending work is findable --')
await leadsRepository.patch('idx1', { stage: 'closed' }, opts)
const pendingRecords = await leadsRepository.pending(opts)
check(pendingRecords.length === 1, 'pending() finds the one edited record', String(pendingRecords.length))

// ---------------------------------------------------------------------------
await closeAll()
await server.close()

console.log(`\n${failures === 0 ? `ALL ${checks} CHECKS PASSED` : `${failures} of ${checks} FAILED`}`)
process.exit(failures === 0 ? 0 : 1)
