/**
 * Campaigns service.
 *
 * The transport boundary for the campaign pages. Components and hooks call
 * these; nothing outside this folder touches Axios or knows a URL.
 */

import { ENDPOINTS } from '@/api/endpoints'
import { httpClient } from '@/api/httpClient'

/** Strips empty parameters so the server applies its own defaults. */
function clean(params = {}) {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => {
      if (value === '' || value === null || value === undefined) return false
      if (Array.isArray(value) && value.length === 0) return false
      return true
    }),
  )
}

/** @returns {Promise<{ items: object[], meta: ?object }>} */
export async function fetchCampaigns(params = {}, { signal } = {}) {
  const response = await httpClient.get(ENDPOINTS.campaigns.list, { params: clean(params), signal })

  return {
    items: response.data?.data?.items ?? [],
    meta: response.data?.meta ?? null,
  }
}

export async function fetchCampaign(id, { signal } = {}) {
  const response = await httpClient.get(ENDPOINTS.campaigns.detail(id), { signal })
  return response.data?.data?.campaign ?? null
}

export async function createCampaign(payload, { signal } = {}) {
  const response = await httpClient.post(ENDPOINTS.campaigns.list, payload, { signal })
  return response.data?.data?.campaign ?? null
}

export async function updateCampaign(id, payload, { signal } = {}) {
  const response = await httpClient.put(ENDPOINTS.campaigns.detail(id), payload, { signal })
  return response.data?.data?.campaign ?? null
}

/** Re-resolves the audience after the contact list has changed underneath it. */
export async function rebuildAudience(id, { signal } = {}) {
  const response = await httpClient.post(ENDPOINTS.campaigns.audience(id), {}, { signal })
  return response.data?.data ?? null
}

/**
 * Renders the first few recipients.
 *
 * The builder's proof that personalisation resolves — it also reports any
 * variable the server cannot fill, which is what blocks launch.
 */
export async function previewCampaign(id, { limit = 3, signal } = {}) {
  const response = await httpClient.get(ENDPOINTS.campaigns.preview(id), {
    params: { limit },
    signal,
  })
  return response.data?.data ?? null
}

export async function launchCampaign(id, { scheduledFor = null, signal } = {}) {
  const response = await httpClient.post(
    ENDPOINTS.campaigns.launch(id),
    clean({ scheduledFor }),
    { signal },
  )
  return response.data?.data?.campaign ?? null
}

/**
 * Drains one or more batches.
 *
 * Returns the throttle verdict alongside the counts, so the caller can tell a
 * rate-limited campaign from a finished one — they otherwise both look like
 * "nothing sent".
 */
export async function sendCampaign(id, { maxBatches = 1, signal } = {}) {
  const response = await httpClient.post(ENDPOINTS.campaigns.send(id), { maxBatches }, { signal })
  return response.data?.data ?? null
}

/** @param {'pause'|'resume'|'cancel'|'archive'} action */
export async function controlCampaign(id, action, { signal } = {}) {
  const response = await httpClient.post(ENDPOINTS.campaigns.control(id), { action }, { signal })
  return response.data?.data?.campaign ?? null
}

export async function cloneCampaign(id, { name = null, signal } = {}) {
  const response = await httpClient.post(ENDPOINTS.campaigns.clone(id), clean({ name }), { signal })
  return response.data?.data?.campaign ?? null
}

export async function fetchRecipients(id, params = {}, { signal } = {}) {
  const response = await httpClient.get(ENDPOINTS.campaigns.recipients(id), {
    params: clean(params),
    signal,
  })

  return {
    items: response.data?.data?.items ?? [],
    meta: response.data?.meta ?? null,
  }
}

export async function fetchEvents(id, params = {}, { signal } = {}) {
  const response = await httpClient.get(ENDPOINTS.campaigns.events(id), {
    params: clean(params),
    signal,
  })

  return {
    items: response.data?.data?.items ?? [],
    meta: response.data?.meta ?? null,
  }
}

export async function fetchCampaignAnalytics(id, { signal } = {}) {
  const response = await httpClient.get(ENDPOINTS.campaigns.campaignAnalytics(id), { signal })
  return response.data?.data ?? null
}

/** Cross-campaign totals. Drives the analytics page and the dashboard card. */
export async function fetchOverallAnalytics({ signal } = {}) {
  const response = await httpClient.get(ENDPOINTS.campaigns.analytics, { signal })
  return response.data?.data ?? null
}

/**
 * Mailboxes this account can send from, with rotation health.
 *
 * Campaign-scoped rather than provider-scoped: the health counters come from
 * the send queue, which the provider module has no view of.
 */
export async function fetchSendingMailboxes({ signal } = {}) {
  const response = await httpClient.get(ENDPOINTS.campaigns.mailboxes, { signal })
  return response.data?.data?.items ?? []
}

export async function fetchTemplates(params = {}, { signal } = {}) {
  const response = await httpClient.get(ENDPOINTS.campaigns.templates, {
    params: clean(params),
    signal,
  })
  return response.data?.data?.items ?? []
}

export async function createTemplate(payload, { signal } = {}) {
  const response = await httpClient.post(ENDPOINTS.campaigns.templates, payload, { signal })
  return response.data?.data ?? null
}

export async function deleteTemplate(id, { signal } = {}) {
  const response = await httpClient.delete(ENDPOINTS.campaigns.template(id), { signal })
  return response.data?.data ?? null
}

export async function fetchSequences({ signal } = {}) {
  const response = await httpClient.get(ENDPOINTS.campaigns.sequences, { signal })
  return response.data?.data?.items ?? []
}

export async function createSequence(payload, { signal } = {}) {
  const response = await httpClient.post(ENDPOINTS.campaigns.sequences, payload, { signal })
  return response.data?.data?.sequence ?? null
}

export default {
  fetchCampaigns,
  fetchCampaign,
  createCampaign,
  updateCampaign,
  rebuildAudience,
  previewCampaign,
  launchCampaign,
  sendCampaign,
  controlCampaign,
  cloneCampaign,
  fetchRecipients,
  fetchEvents,
  fetchCampaignAnalytics,
  fetchOverallAnalytics,
  fetchSendingMailboxes,
  fetchTemplates,
  createTemplate,
  deleteTemplate,
  fetchSequences,
  createSequence,
}
