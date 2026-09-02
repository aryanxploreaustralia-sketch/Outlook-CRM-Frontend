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
