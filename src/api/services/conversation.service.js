/**
 * Lead correspondence service.
 *
 * The transport boundary for the conversation panel on the enquiry screen.
 * Components call these; nothing outside this folder touches Axios or knows a
 * URL.
 */

import { ENDPOINTS } from '@/api/endpoints'
import { httpClient } from '@/api/httpClient'

/**
 * Everything the enquiry screen shows about correspondence.
 *
 * One request rather than four: the messages, the activity timeline, the
 * attachments and the tasks all describe the same enquiry and are rendered
 * together, so fetching them separately would only introduce a render pass
 * where half the panel has data.
 *
 * @returns {Promise<?{ lead, messages: object[], timeline: object[], conversations: object[], attachments: object[], tasks: object[] }>}
 */
export async function fetchLeadConversation(leadId, { signal } = {}) {
  const response = await httpClient.get(ENDPOINTS.conversations.leadTimeline(leadId), { signal })
  return response.data?.data ?? null
}

/**
 * Reads the inbox now.
 *
 * The same endpoint the background worker's logic runs through, so what this
 * returns is exactly what the automatic sync would have done.
 */
export async function syncReplies({ full = false, signal } = {}) {
  const response = await httpClient.post(ENDPOINTS.conversations.sync, { full }, { signal })

  return {
    ...(response.data?.data ?? {}),
    message: response.data?.message ?? null,
  }
}

export default { fetchLeadConversation, syncReplies }
