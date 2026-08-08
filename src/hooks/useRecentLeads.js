/**
 * The newest enquiries on the register.
 *
 * Thin by design — the fetch/abort/stale-response machinery lives in
 * `useApiResource`, so this hook only declares *what* to fetch.
 *
 * ## Why this is a separate request from the dashboard
 *
 * `GET /v1/dashboard` returns statistics, not records. Its `sales.recentLeads`
 * is a **count** of enquiries created in the last thirty days — a number — and
 * the payload carries no array of leads anywhere. Reading that field as a list
 * is what produced `e.slice is not a function` in production.
 *
 * So the list comes from the endpoint that actually serves records. No new API
 * was added: `GET /v1/leads` already returns `toSummaryJSON()` items and already
 * accepts `limit` and `sort`, and `-created` is one of its supported sort keys.
 *
 * Keeping it separate is also what isolates the failure. The dashboard's own
 * request and this one fail independently, so an unavailable register shows one
 * card's error state rather than replacing the whole page.
 */

import { useCallback } from 'react'

import { fetchLeads } from '@/api/services/lead.service'
import { useApiResource } from '@/hooks/useApiResource'

/** How many the dashboard card shows. */
export const RECENT_LEADS_LIMIT = 6

/**
 * @param {{ enabled?: boolean }} [options]
 *   `enabled` lets a caller defer the request until authentication is
 *   confirmed, which avoids a guaranteed 401 on first paint.
 * @returns {{ leads: Array<object>, isLoading: boolean, isInitialLoading: boolean,
 *             isError: boolean, error: ?object, refresh: Function }}
 *   `leads` is **always an array** — that is this hook's contract, and it is
 *   what lets `RecentLeadsCard` index into it without re-checking the type.
 */
export function useRecentLeads({ enabled = true } = {}) {
  // Memoised so `useApiResource`'s effect does not re-run on every render.
  const fetcher = useCallback(
    ({ signal }) => fetchLeads({ limit: RECENT_LEADS_LIMIT, sort: '-created' }, { signal }),
    [],
  )

  const resource = useApiResource(fetcher, { enabled })

  return {
    ...resource,
    /**
     * The rows, newest first.
     *
     * `fetchLeads` already defaults `items` to `[]`, so the only case this
     * coalesce covers is "no response yet" — before the first load resolves,
     * and after a failure. A consumer therefore never receives null, and the
     * distinction between "none" and "failed" is carried by `isError` rather
     * than by an ambiguous empty array.
     */
    leads: resource.data?.items ?? [],

    /**
     * True whenever there is nothing to show *yet*, which includes the window
     * before the request has been enabled.
     *
     * `isInitialLoading` alone is not enough. A caller that defers this hook
     * until another payload arrives leaves it `idle` — not loading, no data —
     * for the render between that payload landing and this effect firing. A
     * card keyed on `isInitialLoading` would show its empty state for that
     * frame, telling someone with two thousand enquiries that they have none.
     */
    isPending: resource.isIdle || resource.isInitialLoading,
  }
}

export default useRecentLeads
