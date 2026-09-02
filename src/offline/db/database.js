/**
 * Opening and upgrading the local database.
 *
 * The only module that calls `idb`. Everything above it works through
 * repositories, so a change of local-storage engine is a change here and
 * nowhere else.
 *
 * ## Three things this deliberately never does
 *
 *  1. **`indexedDB.deleteDatabase`.** Not on upgrade, not on a version
 *     mismatch, not on a corrupt read. A cache can be rebuilt from the server;
 *     a queued edit that has not synced yet cannot be rebuilt from anywhere.
 *     Deleting the database to recover from a bug would destroy the one thing
 *     in it that is irreplaceable.
 *  2. **Clear a store.** For the same reason. `MIGRATIONS` are additive.
 *  3. **Throw on an unavailable IndexedDB.** Private browsing, a disabled
 *     store, an old browser — `isAvailable()` reports it and callers degrade.
 *     The CRM works online without any of this, and must keep doing so.
 */

import { openDB } from 'idb'

import { MIGRATIONS, SCHEMA_VERSION, databaseName } from '@/offline/db/schema.js'

/**
 * One open connection per database name.
 *
 * `openDB` is cheap to call repeatedly but each call yields a *separate*
 * connection, and a stray one left open blocks the next version upgrade
 * indefinitely. Caching the promise means one connection per user per tab.
 */
const connections = new Map()

/**
 * Whether IndexedDB can be used at all.
 *
 * Firefox in private mode exposes `window.indexedDB` and then refuses to open
 * it; Safari has historically done similar. So this answers the cheap question
 * — does the API exist — and `openDatabase` handles the expensive one by
 * failing softly.
 */
export function isAvailable() {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null
  } catch {
    return false
  }
}

/**
 * Opens the database for a user, upgrading it if the schema has moved on.
 *
 * @param {?string} userId Scopes the database. See `databaseName`.
 * @returns {Promise<import('idb').IDBPDatabase>}
 */
export function openDatabase(userId = null) {
  const name = databaseName(userId)

  const existing = connections.get(name)
  if (existing) return existing

  const connection = openDB(name, SCHEMA_VERSION, {
    /**
     * Runs inside the version-change transaction.
     *
     * Every step from the stored version up to the current one is applied in
     * order, so a browser that has been closed across three releases arrives
     * at the same shape as one upgrading a single version. A step that has
     * already run is skipped by its own `contains` guard rather than by
     * arithmetic here.
     */
    upgrade(db, oldVersion, newVersion, transaction) {
      for (let version = oldVersion + 1; version <= (newVersion ?? SCHEMA_VERSION); version += 1) {
        MIGRATIONS[version]?.(db, transaction)
      }
    },

    /**
     * Another tab is holding this database open at the old version.
     *
     * Nothing is forced. The upgrade waits, which is the correct outcome —
     * closing another tab's connection out from under it would fail whatever
     * that tab was in the middle of writing.
     */
    blocked() {
      // Intentionally silent: this resolves itself when the other tab closes.
    },

    /**
     * This connection is the one holding a *newer* version back.
     *
     * Closing it lets the other tab upgrade. The cached promise is dropped so
     * the next call opens fresh rather than handing out a dead connection.
     */
    blocking() {
      connections.delete(name)
      connection.then((db) => db.close()).catch(() => {})
    },

    /** The browser evicted the database, or the user cleared site data. */
    terminated() {
      connections.delete(name)
    },
  })

  connections.set(name, connection)

  /*
   * A failed open must not be cached as a permanent failure — a transient
   * refusal (private mode, storage pressure) should be retried on the next
   * call rather than poisoning every future one.
   */
  connection.catch(() => connections.delete(name))

  return connection
}

/**
 * Closes this tab's connection.
 *
 * For sign-out and for tests. The database and everything in it survives —
 * this closes a handle, it does not discard data.
 *
 * @param {?string} userId
 */
export async function closeDatabase(userId = null) {
  const name = databaseName(userId)
  const connection = connections.get(name)
  if (!connection) return

  connections.delete(name)

  try {
    ;(await connection).close()
  } catch {
    // Already closed or never opened. Either way there is nothing to release.
  }
}

/** Closes every connection this tab holds. */
export async function closeAll() {
  await Promise.all([...connections.keys()].map((name) => {
    const suffix = name.includes(':') ? name.slice(name.indexOf(':') + 1) : null
    return closeDatabase(suffix)
  }))
  connections.clear()
}

/**
 * The schema as the browser actually stored it.
 *
 * Reads the live store and index names rather than echoing `schema.js`, so a
 * verification against this proves what is on disk instead of restating an
 * intention.
 *
 * @param {?string} userId
 */
export async function describeDatabase(userId = null) {
  const db = await openDatabase(userId)

  const stores = [...db.objectStoreNames].map((storeName) => {
    const transaction = db.transaction(storeName, 'readonly')
    const store = transaction.objectStore(storeName)

    return {
      name: storeName,
      keyPath: store.keyPath,
      indexes: [...store.indexNames].map((indexName) => ({
        name: indexName,
        keyPath: store.index(indexName).keyPath,
      })),
    }
  })

  return { name: db.name, version: db.version, stores }
}

export default openDatabase
