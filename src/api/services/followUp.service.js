/**
 * Follow-ups: enquiries that were emailed and never answered.
 *
 * Two calls and no client-side rules. Which leads are eligible is decided by
 * the server — and decided again at send time against each lead's current
 * state — so nothing here filters, ranks or predicts. A copy of the eligibility
 * rules in the browser would be a second opinion that goes stale the moment a
 * customer replies.
 */

import { ENDPOINTS } from '@/api/endpoints'
import { httpClient } from '@/api/httpClient'

/** Drops empty values, so a cleared filter is absent rather than `?market=`. */
function clean(params = {}) {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== '' && value !== null && value !== undefined),
  )
}

/**
 * One page of the follow-up queue.
 *
 * @param {{
 *   search?: string, replyStatus?: string, followUpStatus?: string,
 *   market?: string, minWaitingDays?: number, from?: string, to?: string,
 *   page?: number, limit?: number,
 * }} [params]
 */
export async function fetchFollowUps(params = {}, { signal } = {}) {
  const response = await httpClient.get(ENDPOINTS.leads.followUp, {
    params: clean(params),
    signal,
  })

  return response.data?.data ?? null
}

/**
 * Sends the follow-up to the named enquiries.
 *
 * Resolves even when part of the batch did not go out: the response carries a
 * per-lead outcome, and the caller is expected to show it. A rejected promise
 * would mean "nothing happened", which is untrue the moment one message was
 * accepted by the provider.
 *
 * @param {{ leadIds: string[], subject: string, body: string }} payload
 */
export async function sendFollowUps(payload, { signal } = {}) {
  const response = await httpClient.post(ENDPOINTS.leads.followUpSend, payload, { signal })

  return response.data?.data ?? null
}

export default { fetchFollowUps, sendFollowUps }
