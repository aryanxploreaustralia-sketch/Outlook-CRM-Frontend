/**
 * Account service.
 *
 * The transport boundary for account and status data.
 */

import { ENDPOINTS } from '@/api/endpoints'
import { httpClient } from '@/api/httpClient'

/**
 * Fetches the account profile, Microsoft account, role and provider.
 *
 * @param {{ signal?: AbortSignal }} [options]
 * @returns {Promise<object>}
 */
export async function fetchAccount({ signal } = {}) {
  const response = await httpClient.get(ENDPOINTS.account.profile, { signal })
  return response.data?.data ?? response.data
}

/**
 * Fetches system, authentication and token-expiry status.
 *
 * @param {{ signal?: AbortSignal, probe?: boolean }} [options]
 *   `probe` defaults to true, which makes the server perform a live Microsoft
 *   Graph call. Pass false for a frequent poll that should not spend Graph
 *   throttling budget.
 * @returns {Promise<object>}
 */
export async function fetchAccountStatus({ signal, probe = true } = {}) {
  const response = await httpClient.get(ENDPOINTS.account.status, {
    signal,
    params: probe ? undefined : { probe: 'false' },
  })
  return response.data?.data ?? response.data
}

export default { fetchAccount, fetchAccountStatus }
