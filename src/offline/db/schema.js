/**
 * The local database's shape, declared once.
 *
 * Every store, every index and every migration step is described here rather
 * than spread across the repositories, so "what does version 3 look like?" has
 * one answer and the upgrade path can be read top to bottom.
 *
 * ## Nothing here talks to the network
 *
 * This module is pure data — no fetch, no axios, no API service. The sync
 * engine that arrives in a later phase consumes these definitions; it is not
 * described by them.
 *
 * ## Why local metadata is namespaced under `_sync`
 *
 * The Contact API already returns a field called **`syncStatus`** — the state
 * of that contact's *Outlook* synchronisation (`local`, `synced`, `pending`,
 * `conflict`, `deleted_remote`, `failed`). It also returns `lastSyncedAt`, for
 * the same purpose. Both are real business fields with real meaning, and both
 * are shown in the CRM's own UI.
 *
 * Writing offline bookkeeping to a top-level `syncStatus` would therefore
 * *overwrite a customer-visible value* the moment a contact was cached. So all
 * local metadata lives under a single reserved key, `_sync`, which no API shape
 * uses and which a future API field cannot collide with by accident.
 *
 * The index *names* below are still the plain ones — `syncStatus`, `updatedAt`
 * — because an index name and its key path are independent in IndexedDB. The
 * name is what callers ask for; the path is what keeps the record intact.
 */

/** The reserved key every piece of local bookkeeping hangs from. */
export const META_KEY = '_sync'

/**
 * Current schema version.
 *
 * Bumping this runs `MIGRATIONS` from the stored version upward. It never
 * deletes the database and never clears a store — see `database.js`.
 */
export const SCHEMA_VERSION = 1

/** Base name. The per-user suffix is applied by `databaseName()` below. */
export const DATABASE_NAME = 'xplore-australia-crm-local'

/**
 * One database per signed-in user.
 *
 * Two people sharing a machine must not share a cache: a manager's enquiries
 * are not the next person's to read, and "clear it on sign-out" is a promise
 * that breaks the moment a tab closes uncleanly. Separate databases make the
 * isolation structural rather than procedural.
 *
 * An absent id yields the bare name, which is the pre-identity state — useful
 * for a first paint before `/auth/status` has answered, and deliberately not
 * where records are written.
 *
 * @param {?string} userId
 */
export function databaseName(userId = null) {
  return userId ? `${DATABASE_NAME}:${userId}` : DATABASE_NAME
}

/** What a queued operation is trying to do. */
export const OPERATION = Object.freeze({
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
})

/** Where a queued operation has got to. */
export const QUEUE_STATUS = Object.freeze({
  PENDING: 'pending',
  PROCESSING: 'processing',
  FAILED: 'failed',
  COMPLETED: 'completed',
  /**
   * The server refused the push because the record had moved on (HTTP 409).
   *
   * Added in Phase 5 and deliberately distinct from `failed`: a failure may be
   * retried once its cause is fixed, whereas a conflict needs a person to
   * choose between two versions. Keeping them apart is what stops a conflict
   * being swept up by a retry that would overwrite somebody's work. Phase 6
   * resolves these; until then they sit here, preserved, and are never retried.
   */
  CONFLICT: 'conflict',
})

/**
 * A cached record's relationship to the server.
 *
 * `synced` means the server confirmed this exact version. The three `pending`
 * states mean an operation is queued for it. `conflict` means the server
 * refused a push because the record had moved on — both versions are kept and
 * neither is discarded.
 */
export const SYNC_STATUS = Object.freeze({
  SYNCED: 'synced',
  PENDING_CREATE: 'pendingCreate',
  PENDING_UPDATE: 'pendingUpdate',
  PENDING_DELETE: 'pendingDelete',
  CONFLICT: 'conflict',
})

/** Store names, so a typo is a module-load error rather than a silent miss. */
export const STORE = Object.freeze({
  LEADS: 'leads',
  CONTACTS: 'contacts',
  COMPANIES: 'companies',
  SYNC_QUEUE: 'syncQueue',
  SYNC_META: 'syncMeta',
  IDENTITY: 'identity',
})

/**
 * The stores, their keys and their indexes.
 *
 * `keyPath` values that begin with `_sync.` address the metadata envelope; the
 * rest address fields the API genuinely returns. Where the two would have
 * clashed the metadata moved, never the business field.
 *
 * ## `owner` is not in any API response
 *
 * `Lead`, `Contact` and `Company` all omit `owner` from their DTOs, and
 * deliberately: the CRM's list endpoints are owner-scoped, so every record a
 * client receives is by construction its own and the field would tell it
 * nothing. The repositories stamp `_sync.owner` from the identity store on
 * write, which is what makes the index meaningful — and what will let an
 * administrator's wider dataset stay separable from their own later.
 */
export const STORES = Object.freeze([
  {
    name: STORE.LEADS,
    keyPath: 'id',
    indexes: [
      { name: 'owner', keyPath: `${META_KEY}.owner` },
      { name: 'stage', keyPath: 'stage' },
      { name: 'market', keyPath: 'market' },
      { name: 'city', keyPath: 'city' },
      { name: 'travelDate', keyPath: 'travelDate' },
      { name: 'quoteDate', keyPath: 'quoteDate' },
      { name: 'updatedAt', keyPath: 'updatedAt' },
      // Named as callers expect; pathed away from the API's own `syncStatus`.
      { name: 'syncStatus', keyPath: `${META_KEY}.status` },
    ],
  },
  {
    name: STORE.CONTACTS,
    keyPath: 'id',
    indexes: [
      { name: 'owner', keyPath: `${META_KEY}.owner` },
      /*
       * The Contact DTO's `company` is the company *name*, a string — not a
       * reference to the Company store. Indexed as it arrives; a caller
       * grouping by company is grouping by what the CRM itself displays.
       */
      { name: 'company', keyPath: 'company' },
      { name: 'updatedAt', keyPath: 'updatedAt' },
      /*
       * NOT `syncStatus` at the top level. That name is taken by Outlook's own
       * per-contact sync state, which this must not shadow.
       */
      { name: 'syncStatus', keyPath: `${META_KEY}.status` },
    ],
  },
  {
    name: STORE.COMPANIES,
    keyPath: 'id',
    indexes: [
      { name: 'owner', keyPath: `${META_KEY}.owner` },
      { name: 'updatedAt', keyPath: 'updatedAt' },
      { name: 'syncStatus', keyPath: `${META_KEY}.status` },
    ],
  },
  {
    name: STORE.SYNC_QUEUE,
    keyPath: 'opId',
    indexes: [
      { name: 'entity', keyPath: 'entity' },
      { name: 'status', keyPath: 'status' },
      { name: 'createdAt', keyPath: 'createdAt' },
      /* Answers "is anything queued for this record?" without a full scan. */
      { name: 'recordId', keyPath: 'recordId' },
    ],
  },
  { name: STORE.SYNC_META, keyPath: 'key', indexes: [] },
  { name: STORE.IDENTITY, keyPath: 'key', indexes: [] },
])

/**
 * Version-by-version upgrade steps.
 *
 * Each entry runs when a database opens at a version below its key. Steps are
 * **additive only**: they create stores and indexes. None deletes a store, and
 * none clears one — an upgrade must never cost the reader their cached data or
 * their unsent work.
 *
 * Adding version 2 means adding a `2:` entry here and bumping
 * `SCHEMA_VERSION`. The version 1 step is left exactly as it was, because a
 * browser still on version 0 has to be able to walk the same path this one did.
 */
export const MIGRATIONS = Object.freeze({
  1: (db) => {
    for (const definition of STORES) {
      if (db.objectStoreNames.contains(definition.name)) continue

      const store = db.createObjectStore(definition.name, { keyPath: definition.keyPath })
      for (const index of definition.indexes) {
        store.createIndex(index.name, index.keyPath, { unique: false })
      }
    }
  },
})

/**
 * A fresh metadata envelope.
 *
 * `localVersion` counts edits made on this device. It increments on every local
 * write and is what a later phase compares against `serverUpdatedAt` to decide
 * whether a record has unsent changes.
 *
 * @param {object} [overrides]
 */
export function createMeta(overrides = {}) {
  return {
    owner: null,
    status: SYNC_STATUS.SYNCED,
    serverUpdatedAt: null,
    localVersion: 0,
    deletedLocally: false,
    lastSyncedAt: null,
    ...overrides,
  }
}

export default STORES
