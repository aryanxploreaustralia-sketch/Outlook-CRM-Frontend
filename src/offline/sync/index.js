/**
 * The hydration layer's public surface.
 *
 * Phase 3 fills the local database from the server's change feed. Nothing yet
 * *reads* that cache — the CRM's online reads are untouched — so the whole of
 * this module is additive by construction.
 */

export {
  HYDRATION_ENTITIES,
  HYDRATION_RESULT,
  PAGE_SIZE,
  classifyError,
  hydrate,
} from '@/offline/sync/hydrate.js'

export { HYDRATION_ENABLED, useOfflineHydration } from '@/offline/sync/useOfflineHydration.js'

/**
 * Phase 7 — the coordinator.
 *
 * `useSyncCoordinator` is the only thing the application mounts. The two
 * earlier triggers are still exported below because the modules remain, but
 * the shell no longer mounts them: a second engine is exactly what Phase 7
 * exists to remove.
 */
export {
  BACKOFF_MS,
  STALE_PROCESSING_MS,
  SYNC_META,
  SYNC_STATE,
  getSyncState,
  isSyncing,
  nextAttempt,
  onSyncState,
  queueCounts,
  recoverStaleProcessing,
  resetCoordinator,
  runSync,
} from '@/offline/sync/coordinator.js'

export { SYNC_ENABLED, useSyncCoordinator } from '@/offline/sync/useSyncCoordinator.js'
export { partitionPulledRecords } from '@/offline/sync/reconcile.js'
