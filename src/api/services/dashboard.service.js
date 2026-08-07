/**
 * Dashboard service.
 *
 * The transport boundary for dashboard data. Components and hooks call these
 * functions; nothing outside this folder touches Axios or knows a URL.
 */

import { ENDPOINTS } from '@/api/endpoints'
import { httpClient } from '@/api/httpClient'

/**
 * Fetches the dashboard payload.
 *
 * @param {{ signal?: AbortSignal }} [options]
 *   `signal` lets a hook abandon an in-flight request when it unmounts or when a
 *   newer request supersedes this one.
 * @returns {Promise<object>} The unwrapped `data` from the API envelope.
 */
export async function fetchDashboard({ signal } = {}) {
  const response = await httpClient.get(ENDPOINTS.dashboard.overview, { signal })
  return response.data?.data ?? response.data
}

export default { fetchDashboard }
