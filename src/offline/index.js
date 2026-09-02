/**
 * The offline foundation's public surface.
 *
 * ## Nothing imports this yet, and that is the point
 *
 * Phase 1 builds the local database and stops there. No page, hook or API
 * service references this module, so the CRM behaves today exactly as it did
 * before these files existed — the bundler does not even include them, because
 * nothing pulls them in.
 *
 * Phase 3 is where `useApiResource` starts writing through to these
 * repositories. Until then this is a foundation with no building on it, which
 * is the safest thing an unfinished feature can be.
 *
 * ## What lives here
 *
 *   db/database.js   opening, versioning, migrations — the only `idb` caller
 *   db/schema.js     stores, indexes, migration steps, status vocabularies
 *   repositories/    one per store, plus the shared record behaviour
 *
 * ## What deliberately does not
 *
 * No network code. No React. No sync engine. This layer knows how to keep
 * records on a disk and nothing whatever about where they came from.
 */

export {
  closeAll,
  closeDatabase,
  describeDatabase,
  isAvailable,
  openDatabase,
} from '@/offline/db/database.js'

export {
  DATABASE_NAME,
  META_KEY,
  MIGRATIONS,
  OPERATION,
  QUEUE_STATUS,
  SCHEMA_VERSION,
  STORE,
  STORES,
  SYNC_STATUS,
  createMeta,
  databaseName,
} from '@/offline/db/schema.js'

export { companiesRepository } from '@/offline/repositories/companiesRepository.js'
export { contactsRepository } from '@/offline/repositories/contactsRepository.js'
export { identityRepository } from '@/offline/repositories/identityRepository.js'
export { leadsRepository } from '@/offline/repositories/leadsRepository.js'
export { META, metaKey, syncMetaRepository } from '@/offline/repositories/syncMetaRepository.js'
export { createRecordRepository, metaOf, toStored } from '@/offline/repositories/recordRepository.js'
export { newOperationId, syncQueueRepository } from '@/offline/repositories/syncQueueRepository.js'

/**
 * Phase 3 — hydration.
 *
 * Re-exported here so `@/offline` remains the one door into this layer. Phase
 * 1's exports above are unchanged.
 */
export {
  HYDRATION_ENABLED,
  HYDRATION_ENTITIES,
  HYDRATION_RESULT,
  PAGE_SIZE,
  classifyError,
  hydrate,
  useOfflineHydration,
} from '@/offline/sync/index.js'
