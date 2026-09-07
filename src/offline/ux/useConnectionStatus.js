/**
 * One place that knows what to say about connectivity.
 *
 * ## It adds no listener and no timer
 *
 * This is the constraint the whole hook is shaped around. `useReadSource`
 * already owns the `online`/`offline` pair and `useSyncCoordinator` already owns
 * the sync trigger; adding a third subscription would be a second opinion about
 * the same fact, and the CRM has been bitten by duplicated triggers before —
 * Phase 7 exists because hydration and the queue each ran their own.
 *
 * So this composes what is already published. It takes the **already-mounted**
 * coordinator result as an argument rather than calling `useSyncCoordinator()`
 * itself, because calling it here would start a second coordinator with its own
 * `online` handler. `DashboardLayout` owns the one instance and passes it in.
 *
 * The only subscription this introduces is a single `useReadSource()`, which is
 * mounted nowhere else in the application. Mount this hook once, at the layout,
 * and pass the result down as a prop.
 *
 * ## No polling
 *
 * There is no interval here and no fetch. `lastSuccessfulSyncAt` is read from
 * IndexedDB once per sync-state change — a local read, never a request — so the
 * relative time re-renders when a sync finishes rather than on a timer.
 */

import { useEffect, useState } from 'react'

import { useReadSource } from '@/offline/read/useReadSource'
import { SYNC_META } from '@/offline/sync/coordinator'
import { syncMetaRepository } from '@/offline/repositories/syncMetaRepository'
import { isAvailable } from '@/offline/db/database'
import {
  CONNECTION_DETAIL,
  CONNECTION_LABEL,
  CONNECTION_UX,
  deriveConnectionUx,
} from '@/offline/ux/connectionState'

/**
 * @param {object}  queue     The result of the layout's single `useSyncCoordinator()`.
 * @param {?string} [userId]  Scopes the metadata read to the signed-in account.
 * @returns {{
 *   state: string, label: string, detail: string,
 *   isOffline: boolean, isSyncing: boolean,
 *   lastSuccessAt: ?string, lastError: ?string,
 *   pending: number, failed: number, conflict: number,
 *   sync: Function,
 * }}
 */
export function useConnectionStatus(queue = {}, userId = null) {
  const { isOffline } = useReadSource()

  /** `lastSuccessfulSyncAt`, read from the store the coordinator writes it to. */
  const [lastSuccessAt, setLastSuccessAt] = useState(null)

  /**
   * Re-read when the sync state changes, and only then.
   *
   * `queue.status` and `queue.lastSyncAt` both move when a run finishes, which
   * is precisely when the stored value can have changed. No interval is needed
   * to keep this fresh, and adding one would be a request-free but pointless
   * wake-up on every tick.
   */
  useEffect(() => {
    let cancelled = false

    if (!isAvailable()) return undefined

    syncMetaRepository
      .get(SYNC_META.LAST_SUCCESS_AT, { userId })
      .then((value) => {
        if (!cancelled) setLastSuccessAt(value ?? null)
      })
      // A metadata read failing is not worth surfacing: the panel simply says
      // "Not synced yet", which is the honest answer when we cannot tell.
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [queue.status, queue.lastSyncAt, userId])

  const state = deriveConnectionUx({
    isOffline,
    syncStatus: queue.status,
    hasSynced: Boolean(lastSuccessAt),
  })

  return {
    state,
    label: CONNECTION_LABEL[state],
    detail: CONNECTION_DETAIL[state],

    isOffline: state === CONNECTION_UX.OFFLINE,
    isSyncing: state === CONNECTION_UX.SYNCING,

    lastSuccessAt,
    lastError: queue.lastError ?? null,

    pending: queue.pending ?? 0,
    failed: queue.failed ?? 0,
    conflict: queue.conflict ?? 0,

    /** The existing coordinator's runner. Never a second implementation. */
    sync: queue.sync,
  }
}

export default useConnectionStatus
