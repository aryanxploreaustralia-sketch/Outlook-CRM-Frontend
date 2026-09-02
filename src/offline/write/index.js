/**
 * Phase 5 — the offline write surface.
 *
 *   localId.js     ids for records the server has not seen
 *   constants.js   the vocabulary the writer and the drainer share
 *   mutations.js   record + queue entry, written atomically
 *   processor.js   drains the queue through the CRM's own API services
 *   useSyncQueue.js the outbox as React state, and the only drain trigger
 *
 * Phase 6 added DELETE, optimistic concurrency and tombstone reconciliation.
 * Conflict *resolution* is still deliberately absent: this layer detects a
 * conflict and preserves both sides, and never picks a winner.
 */

export { LOCAL_ID_PREFIX, isLocalId, isServerId, newLocalId } from '@/offline/write/localId.js'
export { CREATE_UNSUPPORTED, EXPECTED_VERSION_HEADER, MUTATION_ID_HEADER, WRITABLE } from '@/offline/write/constants.js'
export { createLocal, deleteLocal, updateLocal } from '@/offline/write/mutations.js'
export { BATCH_SIZE, DRAIN_RESULT, MAX_ATTEMPTS, classify, drain, isDraining } from '@/offline/write/processor.js'
export { useSyncQueue } from '@/offline/write/useSyncQueue.js'
