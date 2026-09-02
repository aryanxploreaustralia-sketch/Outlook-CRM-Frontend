/**
 * The application's one connection to synchronisation.
 *
 * Mounted once, in the authenticated shell. It replaces the two independent
 * triggers this layer used to have — `useOfflineHydration`, which pulled once
 * per session, and `useSyncQueue`, which drained on its own `online` listener —
 * so a pull and a push can no longer overlap.
 *
 * ## What starts a sync, and what does not
 *
 * Three things: signing in, the browser reporting that connectivity returned,
 * and the tab becoming visible again after long enough to be worth checking.
 * Nothing else. In particular there is **no polling timer**: a loop that retried
 * every few seconds would hammer a server that is down and flatten a phone
 * battery on a train, and it would keep doing so whether or not anything had
 * changed.
 *
 * `navigator.onLine` turning true is treated as a hint that an attempt is now
 * worth making, never as proof the API is reachable — it is `true` on a captive
 * portal and behind a dead VPN. The attempt itself decides, and the coordinator
 * backs off when it fails.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

import { useAuth } from '@/hooks/useAuth'
import {
  SYNC_STATE,
  getSyncState,
  onSyncState,
  queueCounts,
  runSync,
} from '@/offline/sync/coordinator.js'

/**
 * How long the tab must have been away before returning to it triggers a sync.
 *
 * Without this, flicking between two tabs would fire a request each time. Two
 * minutes is long enough that ordinary tab-switching is silent and short enough
 * that coming back to a laptop after a meeting picks up the changes.
 */
const VISIBILITY_THROTTLE_MS = 2 * 60 * 1000

/** The master switch, so a live demo can be made completely inert. */
export const SYNC_ENABLED = true

/**
 * @param {{ enabled?: boolean }} [options]
 * @returns {{ status: string, pending: number, failed: number, conflict: number,
 *   isSyncing: boolean, lastError: ?object, sync: () => Promise<void>,
 *   refresh: () => Promise<void> }}
 */
export function useSyncCoordinator({ enabled = SYNC_ENABLED } = {}) {
  const auth = useAuth()
  const user = auth.user ?? null
  const userId = user?.id ? String(user.id) : null

  const [state, setState] = useState(() => getSyncState())
  const [counts, setCounts] = useState({ pending: 0, failed: 0, conflict: 0, processing: 0 })

  const mounted = useRef(true)
  const lastVisibleSync = useRef(0)
  /** Which user this hook has already started for, so a token refresh does not re-run. */
  const startedFor = useRef(null)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  useEffect(() => onSyncState((next) => {
    if (mounted.current) setState(next)
  }), [])

  const refresh = useCallback(async () => {
    if (!userId) return
    const next = await queueCounts(userId)
    if (mounted.current) setCounts(next)
  }, [userId])

  const run = useCallback(async (reason, { force = false } = {}) => {
    if (!enabled || !userId) return
    await runSync({ user, reason, force })
    await refresh()
  }, [enabled, userId, user, refresh])

  /** A deliberate, user-initiated sync. Ignores the backoff window. */
  const sync = useCallback(() => run('manual', { force: true }), [run])

  // --- startup ------------------------------------------------------------
  useEffect(() => {
    if (!enabled || !auth.isReady || !auth.authenticated || !userId) return
    if (startedFor.current === userId) return

    startedFor.current = userId
    run('startup')
  }, [enabled, auth.isReady, auth.authenticated, userId, run])

  // Keep the counts current for whoever is signed in, even before a sync runs.
  useEffect(() => { refresh() }, [refresh])

  // --- reconnect and tab focus -------------------------------------------
  useEffect(() => {
    if (!enabled || !userId) return undefined

    const onOnline = () => { run('online') }

    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      if (Date.now() - lastVisibleSync.current < VISIBILITY_THROTTLE_MS) return
      lastVisibleSync.current = Date.now()
      run('visible')
    }

    globalThis.addEventListener?.('online', onOnline)
    document.addEventListener?.('visibilitychange', onVisible)

    return () => {
      globalThis.removeEventListener?.('online', onOnline)
      document.removeEventListener?.('visibilitychange', onVisible)
    }
  }, [enabled, userId, run])

  return {
    status: state.status,
    isSyncing: state.status === SYNC_STATE.SYNCING,
    lastError: state.error,
    lastSyncAt: state.at,
    pending: counts.pending,
    failed: counts.failed,
    conflict: counts.conflict,
    sync,
    refresh,
  }
}

export default useSyncCoordinator
