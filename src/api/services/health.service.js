/**
 * Health service.
 *
 * Thin wrapper around the platform health endpoint. Service modules own the
 * transport concern (which endpoint, which verb, response unwrapping) so React
 * components stay declarative and never import Axios directly.
 */

import { ENDPOINTS } from '@/api/endpoints'
import { httpClient } from '@/api/httpClient'

/**
 * Fetches API liveness and dependency status.
 *
 * @returns {Promise<object>} The `data` payload from the standard API envelope.
 */
export async function fetchHealth() {
  const response = await httpClient.get(ENDPOINTS.health.status)
  return response.data?.data ?? response.data
}

export default { fetchHealth }
