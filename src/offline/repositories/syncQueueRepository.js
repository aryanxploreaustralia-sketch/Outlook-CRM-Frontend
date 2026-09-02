/**
 * The outbox — operations made offline, waiting to reach the server.
 *
 * **Nothing here sends anything.** This phase builds the structure; the engine
 * that drains it arrives later. What matters now is that the structure can be
 * drained *safely* when it does.
 *
 * ## `opId` is the idempotency key, and it is generated once
 *
 * The failure this exists for: a create is pushed, the server writes it, and
 * the response is lost to a dropped connection. The client cannot tell that
 * from "the server never received it", so it retries — and without a stable
 * key the retry creates a **second enquiry**.
 *
 * So `opId` is minted when the operation is *queued*, not when it is sent, and
 * every retry carries the same one. A server that has seen it returns the
 * original result instead of writing again. The id has to be born here, before
 * the first attempt, or it cannot do that job.
 *
 * ## Nothing is ever dropped silently
 *
 * A failed operation moves to `failed` and keeps its payload and its error. It
 * is not deleted, not retried into oblivion, and not quietly discarded on the
 * next sync. Removing it is an explicit act — `remove`, or `clearCompleted`.
 */

import { openDatabase } from '@/offline/db/database.js'
import { OPERATION, QUEUE_STATUS, STORE } from '@/offline/db/schema.js'

/**
 * A unique operation id.
 *
 * `crypto.randomUUID` where the browser has it — every current one does, over
 * HTTPS. The fallback is for an insecure origin, where `crypto` may be absent:
 * it is not cryptographically strong, and does not need to be. This value is a
 * deduplication key, never a secret and never a credential.
 */
export function newOperationId() {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
    }
  } catch {
    // Fall through.
  }

  return `op-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

const withStore = async (mode, run, userId) => {
  const db = await openDatabase(userId)
  const transaction = db.transaction(STORE.SYNC_QUEUE, mode)
  const result = await run(transaction.store)
  await transaction.done
  return result
}

export const syncQueueRepository = {
  storeName: STORE.SYNC_QUEUE,

  /**
   * Queues one operation.
   *
   * @param {object}  operation
   * @param {string}  operation.entity     'leads' | 'contacts' | 'companies'
   * @param {?string} operation.recordId   Server id, or the local id of a create.
   * @param {string}  operation.operation  CREATE | UPDATE | DELETE
   * @param {object}  operation.payload    What to send.
   * @returns {Promise<object>} The queued entry, `opId` included.
   */
  async enqueue({ entity, recordId = null, operation, payload = {} }, { userId = null } = {}) {
    if (!Object.values(OPERATION).includes(operation)) {
      throw new Error(`Unknown sync operation: ${operation}`)
    }

    const entry = {
      opId: newOperationId(),
      entity,
      recordId,
      operation,
      payload,
      createdAt: new Date().toISOString(),
      retryCount: 0,
      lastError: null,
      status: QUEUE_STATUS.PENDING,
    }

    await withStore('readwrite', (store) => store.add(entry), userId)
    return entry
  },

  async get(opId, { userId = null } = {}) {
    return withStore('readonly', (store) => store.get(opId), userId)
  },

  async all({ userId = null } = {}) {
    return withStore('readonly', (store) => store.getAll(), userId)
  },

  /** Everything at one status. */
  async byStatus(status, { userId = null } = {}) {
    return withStore('readonly', (store) => store.index('status').getAll(status), userId)
  },

  /**
   * Work waiting to be sent, oldest first.
   *
   * Order matters: an update to a record whose create has not landed yet would
   * be rejected, so the queue drains in the order the user made the changes.
   */
  async pending({ userId = null } = {}) {
    const entries = await this.byStatus(QUEUE_STATUS.PENDING, { userId })
    return entries.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  },

  /** Operations queued for one record — used to collapse repeated edits. */
  async byRecord(recordId, { userId = null } = {}) {
    return withStore('readonly', (store) => store.index('recordId').getAll(recordId), userId)
  },

  /** How many changes are waiting. The number the status UI will show. */
  async pendingCount({ userId = null } = {}) {
    return (await this.pending({ userId })).length
  },

  /** How many need a person to look at them. */
  async failedCount({ userId = null } = {}) {
    return (await this.byStatus(QUEUE_STATUS.FAILED, { userId })).length
  },

  /**
   * Moves an entry to a new status, optionally recording why.
   *
   * A move to `failed` increments `retryCount` — the count is of attempts that
   * failed, so a caller cannot forget to advance it and spin forever.
   *
   * @returns {Promise<?object>} The updated entry, or null if it is gone.
   */
  async setStatus(opId, status, { userId = null, error = null } = {}) {
    if (!Object.values(QUEUE_STATUS).includes(status)) {
      throw new Error(`Unknown queue status: ${status}`)
    }

    const db = await openDatabase(userId)
    const transaction = db.transaction(STORE.SYNC_QUEUE, 'readwrite')

    const entry = await transaction.store.get(opId)
    if (!entry) {
      await transaction.done
      return null
    }

    const updated = {
      ...entry,
      status,
      lastError: error ? String(error).slice(0, 500) : status === QUEUE_STATUS.FAILED ? entry.lastError : null,
      retryCount: status === QUEUE_STATUS.FAILED ? entry.retryCount + 1 : entry.retryCount,
    }

    await transaction.store.put(updated)
    await transaction.done
    return updated
  },

  /**
   * Removes one entry.
   *
   * For an operation the server has confirmed, or one the reader has explicitly
   * abandoned. Never called to tidy a failure away.
   */
  async remove(opId, { userId = null } = {}) {
    await withStore('readwrite', (store) => store.delete(opId), userId)
  },

  /**
   * Clears entries the server already confirmed.
   *
   * Deliberately narrow: only `completed`. Pending and failed work is the
   * reader's, and is never removed on its behalf.
   *
   * @returns {Promise<number>} How many were cleared.
   */
  async clearCompleted({ userId = null } = {}) {
    const done = await this.byStatus(QUEUE_STATUS.COMPLETED, { userId })
    if (done.length === 0) return 0

    const db = await openDatabase(userId)
    const transaction = db.transaction(STORE.SYNC_QUEUE, 'readwrite')
    await Promise.all(done.map((entry) => transaction.store.delete(entry.opId)))
    await transaction.done

    return done.length
  },
}

export default syncQueueRepository
