/**
 * Phase 5 — the offline write surface.
 *
 *   localId.js     ids for records the server has not seen
 *   constants.js   the vocabulary the writer and the drainer share
 *   mutations.js   record + queue entry, written atomically
 *   processor.js   drains the queue through the CRM's own API services
 *   useSyncQueue.js the outbox as React state, and the only drain trigger
 *
 * DELETE is deliberately absent. It belongs to Phase 6, with tombstones and
 * conflict resolution, which have to be designed together.
 */

export { LOCAL_ID_PREFIX, isLocalId, isServerId, newLocalId } from '@/offline/write/localId.js'
export { CREATE_UNSUPPORTED, MUTATION_ID_HEADER, WRITABLE } from '@/offline/write/constants.js'
export { createLocal, updateLocal } from '@/offline/write/mutations.js'
export { BATCH_SIZE, DRAIN_RESULT, MAX_ATTEMPTS, classify, drain, isDraining } from '@/offline/write/processor.js'
export { useSyncQueue } from '@/offline/write/useSyncQueue.js'
