/**
 * Loads a page of mail history.
 *
 * Thin, like `useDashboard` — `useApiResource` owns the fetch/abort/stale-response
 * machinery, so this hook only declares what to fetch and exposes a `remove`
 * action the list needs.
 */

import { useCallback, useState } from 'react'

import { deleteMail, fetchMailHistory } from '@/api/services/mail.service'
import { useApiResource } from '@/hooks/useApiResource'

/**
 * @param {{ page?: number, limit?: number, status?: string, search?: string, enabled?: boolean }} [options]
 */
export function useMailHistory({
  page = 1,
  limit = 20,
  status = '',
  search = '',
  enabled = true,
} = {}) {
  const [deletingId, setDeletingId] = useState(null)

  // Depends on the query values, so changing a filter re-runs the request —
  // which is the intended behaviour, not an accidental re-fetch.
  const fetcher = useCallback(
    ({ signal }) => fetchMailHistory({ page, limit, status, search }, { signal }),
    [page, limit, status, search],
  )

  const resource = useApiResource(fetcher, { enabled })

  /**
   * Deletes a record, then refreshes the current page.
   *
   * Refreshing rather than splicing the item out locally: removing the last row
   * on a page would otherwise leave an empty list with stale pagination, and the
   * totals shown alongside would be wrong until the next load.
   */
  const remove = useCallback(
    async (id) => {
      setDeletingId(id)
      try {
        await deleteMail(id)
        await resource.refresh({ isBackground: true })
        return true
      } finally {
        setDeletingId(null)
      }
    },
    [resource],
  )

  return {
    ...resource,
    items: resource.data?.items ?? [],
    pagination: resource.data?.meta ?? null,
    limits: resource.data?.limits ?? null,
    remove,
    deletingId,
  }
}

export default useMailHistory
