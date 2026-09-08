/**
 * Retrying a permanently-failed queue entry.
 *
 * Runs the real `syncQueueRepository` and the real `processor` against an
 * in-memory IndexedDB (`fake-indexeddb`) through Vite's SSR pipeline, so the
 * `@/` aliases resolve exactly as they do in the browser. Nothing here
 * reimplements the transition it is checking.
 *
 * The case that prompted this: a lead created offline whose five attempts all
 * met an unreachable server. The payload was never the problem, so the entry is
 * perfectly re-sendable — but nothing in the application could re-send it.
 *
 * ## Safety
 *
 * No MongoDB, no network, no production data. The database lives in this
 * process's memory and is gone when it exits.
 *
 *     node scripts/verify-retry-failed.mjs
 */

import 'fake-indexeddb/auto'

import { readFileSync } from 'node:fs'
import { createServer } from 'vite'

let failures = 0
let checks = 0

const check = (ok, label, detail = '') => {
  checks += 1
  if (!ok) failures += 1
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`)
}

const section = (title) => console.log(`\n=== ${title} ===`)
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
})

const { syncQueueRepository } = await server.ssrLoadModule(
  '/src/offline/repositories/syncQueueRepository.js',
)
const { QUEUE_STATUS, OPERATION, STORE } = await server.ssrLoadModule('/src/offline/db/schema.js')
const { openDatabase } = await server.ssrLoadModule('/src/offline/db/database.js')
const { createLocal } = await server.ssrLoadModule('/src/offline/write/mutations.js')
const { MAX_ATTEMPTS, classify } = await server.ssrLoadModule('/src/offline/write/processor.js')

const U = 'retry-user-000000000001'

/** Writes an entry straight to the store, bypassing the repository. */
const putEntry = async (entry) => {
  const db = await openDatabase(U)
  await db.put(STORE.SYNC_QUEUE, entry)
  return entry
}

const getEntry = async (opId) => {
  const db = await openDatabase(U)
  return db.get(STORE.SYNC_QUEUE, opId)
}

// ---------------------------------------------------------------------------
section('1. THE REAL CASE — A LEAD THAT GAVE UP AFTER FIVE ATTEMPTS')

// Created exactly as the page creates it, then failed exactly as the processor
// fails it: transport error, budget exhausted.
const created = await createLocal(
  'leads',
  { contactPerson: 'Arun Kumar', companyName: 'Sunrise Travel', city: 'Mumbai', market: 'AU', sendMail: true },
  { userId: U },
)
const localId = created.record.id
const opId = created.queued.opId

await putEntry({
  ...(await getEntry(opId)),
  status: QUEUE_STATUS.FAILED,
  retryCount: 5,
  httpStatus: null,
  lastError: 'Unable to reach the server. Please check that the API is running. (gave up after 5 attempts)',
  lastAttemptAt: new Date().toISOString(),
})

const before = await getEntry(opId)
check(before.status === QUEUE_STATUS.FAILED, 'the entry starts permanently failed')
check(before.retryCount === 5, 'with an exhausted retry budget', String(before.retryCount))
check(
  before.retryCount + 1 > MAX_ATTEMPTS,
  'which the processor would refuse before making a request — why a plain sync cannot help',
  `attempts ${before.retryCount + 1} vs MAX_ATTEMPTS ${MAX_ATTEMPTS}`,
)

section('2. FAILED → PENDING, AND THE BUDGET IS RESET')

const revived = await syncQueueRepository.retryFailed({ userId: U })
const after = await getEntry(opId)

check(revived.length === 1, 'exactly one entry was returned to the queue')
check(after.status === QUEUE_STATUS.PENDING, 'its status is now pending')
check(after.retryCount === 0, 'and the retry budget is reset, so the next drain really tries')
check(after.retryCount + 1 <= MAX_ATTEMPTS, 'the processor will now attempt it rather than refuse it')
check(after.lastError === null, 'the stale error text is cleared')
check(after.httpStatus === null, 'as is the stale HTTP status')

section('3. NOTHING ELSE ABOUT THE ENTRY MOVED')

check(after.opId === before.opId, 'the opId — the idempotency key — is unchanged')
check(after.recordId === localId, 'the recordId still points at the local lead')
check(JSON.stringify(after.payload) === JSON.stringify(before.payload), 'the payload is byte-identical')
check(after.payload.contactPerson === 'Arun Kumar', 'including the data the user typed')
check(after.payload.sendMail === true, 'and the queued introduction email')
check(after.entity === 'leads' && after.operation === OPERATION.CREATE, 'entity and operation are untouched')
check(after.createdAt === before.createdAt, 'the original creation time is preserved')
check(after.ownerId === before.ownerId, 'and the owner')

section('4. THE LOCAL LEAD RECORD IS UNTOUCHED')

const db = await openDatabase(U)
const record = await db.get(STORE.LEADS, localId)

check(Boolean(record), 'the lead is still in the local store')
check(record.contactPerson === 'Arun Kumar', 'with its data intact')
check(record.companyName === 'Sunrise Travel', 'every field, not just the first')
check(record.id === localId, 'under the same local id')
check(
  record._sync?.status === 'pendingCreate',
  'and still marked pendingCreate — the retry does not pretend it synced',
  String(record._sync?.status),
)

section('5. CONFLICTS ARE NEVER SWEPT UP')

const conflicted = await createLocal('leads', { contactPerson: 'Priya Nair' }, { userId: U })
await putEntry({
  ...(await getEntry(conflicted.queued.opId)),
  status: QUEUE_STATUS.CONFLICT,
  retryCount: 2,
  conflict: { detectedAt: new Date().toISOString(), baseUpdatedAt: null },
})

const secondRevival = await syncQueueRepository.retryFailed({ userId: U })
const stillConflicted = await getEntry(conflicted.queued.opId)

check(secondRevival.length === 0, 'a retry with nothing failed revives nothing')
check(stillConflicted.status === QUEUE_STATUS.CONFLICT, 'the conflict is still a conflict')
check(stillConflicted.retryCount === 2, 'its retry count was not reset')
check(Boolean(stillConflicted.conflict), 'and the server’s account of the disagreement is preserved')

section('6. ONLY FAILED ENTRIES ARE ELIGIBLE')

const pendingOne = await createLocal('leads', { contactPerson: 'Ravi Shah' }, { userId: U })
const pendingBefore = await getEntry(pendingOne.queued.opId)

await syncQueueRepository.retryFailed({ userId: U })
const pendingAfter = await getEntry(pendingOne.queued.opId)

check(pendingAfter.status === QUEUE_STATUS.PENDING, 'an already-pending entry stays pending')
check(
  pendingAfter.retryCount === pendingBefore.retryCount,
  'and its retry count is not reset out from under a drain in progress',
)

// A named entry that is not failed must also be refused.
await putEntry({ ...(await getEntry(opId)), status: QUEUE_STATUS.COMPLETED })
const completedRevival = await syncQueueRepository.retryFailed({ opId, userId: U })
check(completedRevival.length === 0, 'naming a completed entry revives nothing')
check((await getEntry(opId)).status === QUEUE_STATUS.COMPLETED, 'and leaves it completed')

section('7. A SECOND FAILURE IS CLASSIFIED BY THE EXISTING RULES')

// The retry is not special: whatever happens next goes through `classify`,
// exactly as a first attempt would.
check(classify({ isNetwork: true }).retryable === true, 'a transport failure stays retryable')
check(classify({ status: 400 }).terminal === QUEUE_STATUS.FAILED, 'a 400 is terminal FAILED, as before')
check(classify({ status: 422 }).terminal === QUEUE_STATUS.FAILED, 'and a 422')
check(classify({ status: 409 }).terminal === QUEUE_STATUS.CONFLICT, 'a 409 is still CONFLICT, not FAILED')
check(classify({ status: 503 }).retryable === true, 'a 5xx is still retryable')
check(
  classify({ status: 401 }).stop === true,
  'a 401 still stops the drain rather than burning the budget',
)
check(MAX_ATTEMPTS === 5, 'MAX_ATTEMPTS is unchanged, so a retry cannot loop indefinitely')

section('8. NO AUTOMATIC RETRY WAS INTRODUCED')

const hookSource = read('src/offline/sync/useSyncCoordinator.js')
const coordinatorSource = read('src/offline/sync/coordinator.js')
const processorSource = read('src/offline/write/processor.js')

const stripped = (body) =>
  body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

check(
  stripped(processorSource).includes('entry.status === QUEUE_STATUS.PENDING'),
  'drain() still selects pending only — an ordinary sync cannot see a failure',
)
check(
  !stripped(coordinatorSource).includes('retryFailed'),
  'runSync knows nothing about retrying failures',
)

const hook = stripped(hookSource)
check(hook.includes('retryFailed'), 'the hook exposes the action')
check(
  !/useEffect\([^)]*retryFailed/s.test(hook),
  'and no effect calls it — it is reachable from a click and nowhere else',
)
check(
  !/addEventListener\([^)]*retryFailed/s.test(hook),
  'nor any event listener',
)
check(!hook.includes('setInterval'), 'no interval was added')

const notice = read('src/components/common/PendingSyncNotice.jsx')
check(notice.includes('Try again'), 'the attention state now offers a control')
check(
  notice.includes('failed > 0 && typeof onRetryFailed'),
  'offered only when something is genuinely retryable, never for a conflict alone',
)

await server.close()

console.log(`\n${failures === 0 ? `ALL ${checks} CHECKS PASSED` : `${failures} of ${checks} FAILED`}`)
process.exit(failures === 0 ? 0 : 1)
