/**
 * Whether an entity has ever been downloaded to this device.
 *
 * ## The distinction this exists to make
 *
 * An empty list means one of two entirely different things, and until now the
 * CRM rendered both identically. "No leads found" told a consultant opening the
 * installed app on a train that their register was empty, when in fact their
 * device had simply never downloaded it. One of those is a fact about the
 * business; the other is a fact about the device, and confusing them is the
 * worst kind of interface lie because it looks like data.
 *
 * ## No new bookkeeping
 *
 * Everything is read from metadata the sync layer already writes:
 * `lastPull:<entity>` and `lastStatus`. Nothing here records anything, and the
 * answer is `unknown` — meaning "keep your existing wording" — whenever the two
 * disagree or cannot be read. A guess presented as a fact is what this is
 * fixing, so it does not make one of its own.
 *
 * ## No polling and no request
 *
 * Two local IndexedDB reads on mount, repeated only when a synchronisation
 * finishes. `onSyncState` is the coordinator's existing module-level pub/sub —
 * subscribing costs nothing, opens no socket and adds no network listener.
 */

import { useEffect, useState } from 'react'

import { useAuth } from '@/hooks/useAuth'
import { isAvailable } from '@/offline/db/database'
import { META, syncMetaRepository } from '@/offline/repositories/syncMetaRepository'
import { onSyncState } from '@/offline/sync/coordinator'
import { deriveHydrationState } from '@/offline/ux/connectionState'

/**
 * @param {string} entity  'leads' | 'contacts' | 'companies' — as the sync layer names it.
 * @returns {{ hydration: string, hasDownloaded: boolean, neverDownloaded: boolean }}
 *   `hydration` is 'downloaded' | 'never-downloaded' | 'unknown'.
 */
export function useHydrationState(entity) {
  const auth = useAuth()
  // Derived exactly as `useSyncCoordinator` derives it, so both read the same
  // per-user database rather than two different ones.
  const userId = auth.user?.id ? String(auth.user.id) : null

  const [hydration, setHydration] = useState('unknown')

  /** Bumped when a sync finishes, to re-read what it may have changed. */
  const [revision, setRevision] = useState(0)

  useEffect(() => onSyncState(() => setRevision((n) => n + 1)), [])

  useEffect(() => {
    let cancelled = false

    /*
     * Signed out, or no local database at all. `unknown` keeps every caller on
     * its existing message, which is the correct behaviour when there is no
     * evidence either way.
     */
    if (!entity || !userId || !isAvailable()) {
      setHydration('unknown')
      return undefined
    }

    /*
     * The two keys are scoped differently, and it matters.
     *
     * `hydrate.js` writes `lastPull:<entity>` per entity (line 318) but
     * `lastStatus` globally, with no suffix (line 409). Reading the status with
     * an entity suffix would look up a key nothing ever writes, come back null,
     * and report every entity as never downloaded. So the pull is asked for by
     * entity and the status is not.
     */
    Promise.all([
      syncMetaRepository.getLastPull(entity, { userId }),
      syncMetaRepository.get(META.LAST_STATUS, { userId }),
    ])
      .then(([lastPull, lastStatus]) => {
        if (!cancelled) setHydration(deriveHydrationState({ lastPull, lastStatus }))
      })
      // A metadata read failing is not evidence of anything. Stay on `unknown`.
      .catch(() => {
        if (!cancelled) setHydration('unknown')
      })

    return () => {
      cancelled = true
    }
  }, [entity, userId, revision])

  return {
    hydration,
    hasDownloaded: hydration === 'downloaded',
    neverDownloaded: hydration === 'never-downloaded',
  }
}

export default useHydrationState
