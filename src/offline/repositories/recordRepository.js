/**
 * The behaviour every cached-entity store shares.
 *
 * Leads, contacts and companies differ in their indexes and in nothing else:
 * all three cache a server DTO by `id`, carry the same metadata envelope, and
 * are read the same way. Writing that three times is how the three drift.
 *
 * ## What a stored record looks like
 *
 * The API's own shape, untouched, plus one reserved key:
 *
 *     { ...serverRecord, _sync: { owner, status, serverUpdatedAt, … } }
 *
 * The server's fields are never rewritten, renamed or trimmed — a later phase
 * hands them straight back to the existing UI, which expects exactly what the
 * API returns. See `schema.js` for why the metadata is namespaced.
 */

import { openDatabase } from '@/offline/db/database.js'
import { META_KEY, SYNC_STATUS, createMeta } from '@/offline/db/schema.js'

/** Reads the metadata envelope, tolerating a record written before it existed. */
export function metaOf(record) {
  return record?.[META_KEY] ?? createMeta()
}

/**
 * Wraps a server record for storage.
 *
 * @param {object}  record   The DTO exactly as the API returned it.
 * @param {object} [options]
 * @param {?string} [options.owner]  Stamped from the identity store — the API
 *   does not send `owner`, because every record it sends is already the
 *   caller's. See `schema.js`.
 * @param {string} [options.status]
 */
export function toStored(record, { owner = null, status = SYNC_STATUS.SYNCED, ...rest } = {}) {
  return {
    ...record,
    [META_KEY]: createMeta({
      owner,
      status,
      serverUpdatedAt: record?.updatedAt ?? null,
      lastSyncedAt: status === SYNC_STATUS.SYNCED ? new Date().toISOString() : null,
      ...rest,
    }),
  }
}

/**
 * Builds a repository over one object store.
 *
 * @param {string} storeName
 */
export function createRecordRepository(storeName) {
  const withStore = async (mode, run, userId) => {
    const db = await openDatabase(userId)
    const transaction = db.transaction(storeName, mode)
    const result = await run(transaction.store)
    await transaction.done
    return result
  }

  return {
    storeName,

    /** @returns {Promise<?object>} The stored record, metadata included. */
    async get(id, { userId = null } = {}) {
      return withStore('readonly', (store) => store.get(id), userId)
    },

    /** Every record in the store. Prefer `page` or an index for large sets. */
    async all({ userId = null } = {}) {
      return withStore('readonly', (store) => store.getAll(), userId)
    },

    async count({ userId = null } = {}) {
      return withStore('readonly', (store) => store.count(), userId)
    },

    /**
     * Writes one server record, marking it synced.
     *
     * @returns {Promise<object>} The stored shape, so a caller can assert on it.
     */
    async put(record, { userId = null, owner = null, status = SYNC_STATUS.SYNCED } = {}) {
      const stored = toStored(record, { owner, status })
      await withStore('readwrite', (store) => store.put(stored), userId)
      return stored
    },

    /**
     * Writes many records in **one** transaction.
     *
     * A sync page is hundreds of records; one transaction per record would be
     * hundreds of round trips through the IndexedDB event loop and would leave
     * a half-written page behind if the tab closed midway.
     *
     * @returns {Promise<number>} How many were written.
     */
    async putMany(records, { userId = null, owner = null, status = SYNC_STATUS.SYNCED } = {}) {
      if (!Array.isArray(records) || records.length === 0) return 0

      const db = await openDatabase(userId)
      const transaction = db.transaction(storeName, 'readwrite')

      await Promise.all(records.map((record) =>
        transaction.store.put(toStored(record, { owner, status })),
      ))
      await transaction.done

      return records.length
    },

    /**
     * Merges a partial change into a stored record.
     *
     * Reads and writes inside **one** transaction, so a concurrent write cannot
     * land between the two and be silently overwritten.
     *
     * `localVersion` increments on every local edit; `status` moves to
     * `pendingUpdate` unless the caller says otherwise (a sync confirmation
     * passes `synced`).
     *
     * @returns {Promise<?object>} The merged record, or null if it was absent.
     */
    async patch(id, changes, { userId = null, status = SYNC_STATUS.PENDING_UPDATE } = {}) {
      const db = await openDatabase(userId)
      const transaction = db.transaction(storeName, 'readwrite')

      const existing = await transaction.store.get(id)
      if (!existing) {
        await transaction.done
        return null
      }

      const meta = metaOf(existing)
      const merged = {
        ...existing,
        ...changes,
        id: existing.id,
        [META_KEY]: {
          ...meta,
          status,
          localVersion: meta.localVersion + 1,
        },
      }

      await transaction.store.put(merged)
      await transaction.done
      return merged
    },

    /**
     * Marks a record deleted **without removing it**.
     *
     * A tombstone, not a delete: the row stays until the server confirms the
     * deletion, because a record removed locally and then rejected by the
     * server is a record the reader has silently lost.
     *
     * @returns {Promise<?object>} The tombstoned record, or null if absent.
     */
    async markDeleted(id, { userId = null } = {}) {
      const db = await openDatabase(userId)
      const transaction = db.transaction(storeName, 'readwrite')

      const existing = await transaction.store.get(id)
      if (!existing) {
        await transaction.done
        return null
      }

      const meta = metaOf(existing)
      const tombstoned = {
        ...existing,
        [META_KEY]: {
          ...meta,
          status: SYNC_STATUS.PENDING_DELETE,
          deletedLocally: true,
          localVersion: meta.localVersion + 1,
        },
      }

      await transaction.store.put(tombstoned)
      await transaction.done
      return tombstoned
    },

    /**
     * Removes a row outright.
     *
     * Only for a deletion the **server has confirmed**, or for discarding a
     * local-only create that was never accepted. Ordinary deletion goes through
     * `markDeleted`.
     */
    async remove(id, { userId = null } = {}) {
      await withStore('readwrite', (store) => store.delete(id), userId)
    },

    /** Records matching one index value. */
    async byIndex(indexName, value, { userId = null } = {}) {
      return withStore('readonly', (store) => store.index(indexName).getAll(value), userId)
    },

    /** Records whose indexed value falls in a range. `IDBKeyRange` or null. */
    async byRange(indexName, range, { userId = null } = {}) {
      return withStore('readonly', (store) => store.index(indexName).getAll(range), userId)
    },

    /** Everything with unsent local work — pending anything, or conflicted. */
    async pending({ userId = null } = {}) {
      const all = await this.all({ userId })
      return all.filter((record) => metaOf(record).status !== SYNC_STATUS.SYNCED)
    },
  }
}

export default createRecordRepository
