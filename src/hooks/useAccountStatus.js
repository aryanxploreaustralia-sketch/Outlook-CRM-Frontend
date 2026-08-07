/**
 * Loads system, authentication and token-expiry status.
 *
 * Polls, because this is the one panel whose value decays: a database or Graph
 * outage that began after page load must become visible without a manual reload.
 *
 * The interval is 60 seconds rather than a few seconds. Each poll performs a live
 * Microsoft Graph call server-side, and a tighter loop would spend Graph
 * throttling budget for information nobody reads that often.
 */

import { useCallback } from 'react'

import { fetchAccountStatus } from '@/api/services/account.service'
import { useApiResource } from '@/hooks/useApiResource'

/** Default poll interval, in milliseconds. */
export const STATUS_POLL_INTERVAL_MS = 60_000

/**
 * @param {{ enabled?: boolean, probe?: boolean, pollIntervalMs?: number }} [options]
 */
export function useAccountStatus({
  enabled = true,
  probe = true,
  pollIntervalMs = STATUS_POLL_INTERVAL_MS,
} = {}) {
  const fetcher = useCallback(({ signal }) => fetchAccountStatus({ signal, probe }), [probe])

  const resource = useApiResource(fetcher, { enabled, pollIntervalMs })

  /**
   * Ordering matters here. `useApiResource` also exposes a `status` field holding
   * the request lifecycle ('loading' | 'success' | …), which collides with this
   * hook's payload name. The spread must come FIRST so the assignment below wins;
   * reversing them silently replaces the payload with the lifecycle string, and
   * every consumer then reads `undefined` off it.
   *
   * The lifecycle value is re-exposed as `requestStatus` so nothing is lost.
   */
  return {
    ...resource,
    /** The `/account/status` payload. */
    status: resource.data,
    /** Request lifecycle, renamed to avoid the collision above. */
    requestStatus: resource.status,
  }
}

export default useAccountStatus
