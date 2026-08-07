/**
 * Loads the dashboard payload.
 *
 * Thin by design — the fetch/abort/stale-response machinery lives in
 * `useApiResource`, so this hook only declares *what* to fetch.
 */

import { useCallback } from 'react'

import { fetchDashboard } from '@/api/services/dashboard.service'
import { useApiResource } from '@/hooks/useApiResource'

/**
 * @param {{ enabled?: boolean }} [options]
 *   `enabled` lets a caller defer the request until authentication is confirmed,
 *   which avoids a guaranteed 401 on first paint.
 */
export function useDashboard({ enabled = true } = {}) {
  // Memoised so `useApiResource`'s effect does not re-run on every render.
  const fetcher = useCallback(({ signal }) => fetchDashboard({ signal }), [])

  const resource = useApiResource(fetcher, { enabled })

  // Spread first, then the named alias — so a future field added to
  // `useApiResource` can never silently overwrite the payload.
  return {
    ...resource,
    /** The `/dashboard` payload. */
    dashboard: resource.data,
  }
}

export default useDashboard
