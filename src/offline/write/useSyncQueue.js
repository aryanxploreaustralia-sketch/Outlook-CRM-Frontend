/**
 * The outbox, as React state — and the only thing that starts a drain.
 *
 * ## Why connectivity is proved, never assumed
 *
 * `navigator.onLine` going `true` is a hint that an interface came back, not
 * evidence the API is reachable: it is `true` on a captive portal, behind a
 * dead VPN, and on wifi that resolves DNS and nothing else. So the `online`
 * event does not mean "sync now succeeds" — it means "an attempt is now worth
 * making". The attempt itself is the proof, and if it fails on the network the
 * processor stops and leaves everything queued.
 *
 * ## Why there is no polling loop
 *
 * A timer that retried every few seconds would hammer a server that is down and
 * flatten a phone battery on a train. A drain happens when something changed:
 * the browser reported connectivity, the user asked, or a mutation was just
 * queued. Anything more belongs to Phase 7's background sync.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

import { QUEUE_STATUS, STORE } from '@/offline/db/schema.js'
import { openDatabase } from '@/offline/db/database.js'
import { useAuth } from '@/hooks/useAuth'
import { DRAIN_RESULT, drain } from '@/offline/write/processor.js'

/** A quiet period after a failed drain, so a flapping connection cannot spin. */
const COOLDOWN_MS = 30_000

/** Counts the queue by status, tolerating an unavailable database. */
async function summarise(userId) {
  const empty = { pending: 0, failed: 0, conflict: 0, total: 0 }
  if (!userId) return empty

  try {
    const db = await openDatabase(userId)
    const entries = await db.getAll(STORE.SYNC_QUEUE)

    return {
      pending: entries.filter((e) => e.status === QUEUE_STATUS.PENDING).length,
      failed: entries.filter((e) => e.status === QUEUE_STATUS.FAILED).length,
      conflict: entries.filter((e) => e.status === QUEUE_STATUS.CONFLICT).length,
      total: entries.length,
    }
  } catch {
    // IndexedDB unavailable (private mode, storage disabled). The CRM online is
    // unaffected, and a status badge is never worth breaking a page over.
    return empty
  }
}

/**
 * @returns {{ pending: number, failed: number, conflict: number, total: number,
 *   isSyncing: boolean, lastResult: ?string, sync: () => Promise<void>,
 *   refresh: () => Promise<void> }}
 */
export function useSyncQueue() {
  const userId = useAuth().user?.id ?? null

  const [counts, setCounts] = useState({ pending: 0, failed: 0, conflict: 0, total: 0 })
  const [isSyncing, setIsSyncing] = useState(false)
  const [lastResult, setLastResult] = useState(null)

  /** When a drain may next be attempted automatically. */
  const nextAttemptAt = useRef(0)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const refresh = useCallback(async () => {
    const next = await summarise(userId)
    if (mounted.current) setCounts(next)
  }, [userId])

  const run = useCallback(async ({ manual = false } = {}) => {
    if (!userId) return
    if (!manual && Date.now() < nextAttemptAt.current) return

    setIsSyncing(true)
    try {
      const summary = await drain({ userId })

      if (mounted.current) setLastResult(summary.result)

      /*
       * Back off only when the network or the session is the problem. A
       * validation failure does not stop the *next* mutation from succeeding,
       * so it must not gate the queue.
       */
      if (summary.result === DRAIN_RESULT.OFFLINE || summary.result === DRAIN_RESULT.UNAUTHENTICATED) {
        nextAttemptAt.current = Date.now() + COOLDOWN_MS
      } else {
        nextAttemptAt.current = 0
      }
    } finally {
      if (mounted.current) setIsSyncing(false)
      await refresh()
    }
  }, [userId, refresh])

  const sync = useCallback(() => run({ manual: true }), [run])

  // Initial count, and whenever the signed-in user changes.
  useEffect(() => { refresh() }, [refresh])

  useEffect(() => {
    if (!userId) return undefined

    const onOnline = () => { run({ manual: false }) }
    globalThis.addEventListener?.('online', onOnline)

    /*
     * One attempt on mount, for the common case: the browser was closed with
     * work queued and reopened on a working connection, so no `online` event
     * will ever fire.
     */
    run({ manual: false })

    return () => globalThis.removeEventListener?.('online', onOnline)
  }, [userId, run])

  return { ...counts, isSyncing, lastResult, sync, refresh }
}

export default useSyncQueue
