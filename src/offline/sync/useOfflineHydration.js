/**
 * Runs hydration once, after sign-in, without the application noticing.
 *
 * ## The whole integration, and why it is this small
 *
 * One hook, mounted once, rendering nothing. It waits for the existing
 * `useAuth` to report an authenticated user — the CRM's own mechanism, not a
 * second one — and then fills the local database in the background.
 *
 * It blocks no render, gates no route, and returns nothing the UI consumes.
 * Deleting the single line that mounts it removes the feature entirely, which
 * is the property that matters while the local database is not yet read from.
 *
 * ## Why it cannot break the CRM
 *
 * `hydrate` never rejects — every failure is a value in its summary. The
 * `.catch` below is belt and braces for a throw that would otherwise become an
 * unhandled rejection. Either way the online CRM is untouched: it does not
 * import this module and does not wait on it.
 */

import { useEffect, useRef } from 'react'

import { useAuth } from '@/hooks/useAuth'
import { hydrate } from '@/offline/sync/hydrate.js'

/**
 * The master switch.
 *
 * Phase 3 fills the cache and nothing reads it, so turning this off changes
 * nothing a user can see — which is exactly what makes it a safe thing to have
 * during a live demo or an incident.
 */
export const HYDRATION_ENABLED = true

/**
 * @param {{ enabled?: boolean }} [options]
 *   `enabled` lets a caller or a test suppress the run without unmounting.
 */
export function useOfflineHydration({ enabled = HYDRATION_ENABLED } = {}) {
  /**
   * Which user this hook has already hydrated for.
   *
   * A ref rather than state: changing it must not re-render, and the effect
   * below re-runs whenever auth resolves — without this, a background
   * `/auth/status` refresh would start a second hydration over the first.
   */
  const hydratedFor = useRef(null)

  const isReady = auth => auth.isReady && auth.authenticated && auth.user?.id
  const auth = useAuth()

  useEffect(() => {
    if (!enabled) return undefined
    if (!isReady(auth)) return undefined

    const userId = String(auth.user.id)
    if (hydratedFor.current === userId) return undefined

    hydratedFor.current = userId

    /*
     * Aborted on unmount, so a sign-out mid-hydration stops the request rather
     * than writing a page for a session that has ended.
     */
    const controller = new AbortController()

    hydrate({ user: auth.user, signal: controller.signal }).catch(() => {
      /*
       * Unreachable in practice — `hydrate` resolves on every path — and
       * swallowed on purpose regardless. A cache that failed to fill is not a
       * reason to surface anything to somebody using the CRM online.
       *
       * The failure reason is in the summary this deliberately discards; a
       * later phase surfaces it in the sync status UI.
       */
    })

    return () => controller.abort()
  }, [auth, enabled])
}

export default useOfflineHydration
