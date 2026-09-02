/**
 * Sync bookkeeping — cursors, watermarks, last-run times.
 *
 * A plain key/value store. Nothing here drives synchronisation yet; it is where
 * the engine will keep the small amount of state it needs between runs.
 *
 * The keys are named rather than free-form so a typo is a module-load error
 * instead of a silently absent cursor that makes every sync a full one.
 */

import { openDatabase } from '@/offline/db/database.js'
import { STORE } from '@/offline/db/schema.js'

/** The bookkeeping the sync engine will keep. */
export const META = Object.freeze({
  /** ISO time of the last successful pull, per entity: `lastPull:leads`. */
  LAST_PULL: 'lastPull',
  /** Opaque server cursor for the next incremental page. */
  CURSOR: 'cursor',
  /** Set when the server says an incremental pull is no longer safe. */
  FULL_RESYNC_REQUIRED: 'fullResyncRequired',
  /** Outcome of the last attempt: 'ok' | 'failed' | 'never'. */
  LAST_STATUS: 'lastStatus',
  /** Schema version the data was written under, for local diagnostics. */
  DATA_VERSION: 'dataVersion',
})

/** `lastPull:leads` from ('lastPull', 'leads'). */
export const metaKey = (name, entity = null) => (entity ? `${name}:${entity}` : name)

const withStore = async (mode, run, userId) => {
  const db = await openDatabase(userId)
  const transaction = db.transaction(STORE.SYNC_META, mode)
  const result = await run(transaction.store)
  await transaction.done
  return result
}

export const syncMetaRepository = {
  storeName: STORE.SYNC_META,

  /** @returns {Promise<*>} The stored value, or `fallback` when unset. */
  async get(key, { userId = null, fallback = null } = {}) {
    const row = await withStore('readonly', (store) => store.get(key), userId)
    return row ? row.value : fallback
  },

  /** Writes a value, stamping when it was written. */
  async set(key, value, { userId = null } = {}) {
    const row = { key, value, updatedAt: new Date().toISOString() }
    await withStore('readwrite', (store) => store.put(row), userId)
    return row
  },

  /** Everything, as a plain object. For diagnostics and the sync status view. */
  async all({ userId = null } = {}) {
    const rows = await withStore('readonly', (store) => store.getAll(), userId)
    return Object.fromEntries(rows.map((row) => [row.key, row.value]))
  },

  /** Removes one key. Never removes the store. */
  async remove(key, { userId = null } = {}) {
    await withStore('readwrite', (store) => store.delete(key), userId)
  },

  /** Convenience: when did this entity last pull successfully? */
  getLastPull(entity, options = {}) {
    return this.get(metaKey(META.LAST_PULL, entity), options)
  },

  setLastPull(entity, isoTime, options = {}) {
    return this.set(metaKey(META.LAST_PULL, entity), isoTime, options)
  },
}

export default syncMetaRepository
