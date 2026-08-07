/**
 * Global search transport.
 *
 * Nothing here filters. The server returns only what the caller may read —
 * a source they lack is never queried — so the palette renders the response as
 * it arrives. Client-side filtering would be both redundant and a lie: it can
 * only hide what was already sent.
 */

import { ENDPOINTS } from '@/api/endpoints'
import { httpClient } from '@/api/httpClient'

/**
 * Runs a search.
 *
 * @param {{ q: string, limit?: number, only?: string[], signal?: AbortSignal }} options
 * @returns {Promise<{ term: string, groups: object[], total: number, skipped: string[] }>}
 */
export async function globalSearch({ q, limit, only, signal } = {}) {
  const response = await httpClient.get(ENDPOINTS.search.query, {
    params: { q, limit, ...(only?.length ? { only: only.join(',') } : {}) },
    signal,
  })

  return response.data?.data ?? { groups: [], total: 0, skipped: [] }
}

/** Which groups this caller's searches will cover. */
export async function fetchSearchSources({ signal } = {}) {
  const response = await httpClient.get(ENDPOINTS.search.sources, { signal })
  return response.data?.data ?? { sources: [] }
}

export default { fetchSearchSources, globalSearch }
