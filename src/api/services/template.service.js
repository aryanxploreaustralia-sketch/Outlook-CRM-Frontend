/**
 * Email templates service.
 *
 * The transport boundary for the template screens. Components and hooks call
 * these; nothing outside this folder touches Axios or knows a URL.
 */

import { ENDPOINTS } from '@/api/endpoints'
import { httpClient } from '@/api/httpClient'

/** Strips empty parameters so the server applies its own defaults. */
function clean(params = {}) {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== '' && value !== null && value !== undefined),
  )
}

/** @returns {Promise<{ items: object[], activeTemplate: ?string }>} */
export async function fetchTemplates(params = {}, { signal } = {}) {
  const response = await httpClient.get(ENDPOINTS.templates.list, { params: clean(params), signal })

  return {
    items: response.data?.data?.items ?? [],
    activeTemplate: response.data?.data?.activeTemplate ?? null,
  }
}

export async function fetchTemplate(id, { signal } = {}) {
  const response = await httpClient.get(ENDPOINTS.templates.detail(id), { signal })
  return response.data?.data?.template ?? null
}

/** The template the morning run would send. `hasActiveTemplate` may be false. */
export async function fetchActiveTemplate({ signal } = {}) {
  const response = await httpClient.get(ENDPOINTS.templates.active, { signal })
  return response.data?.data ?? { hasActiveTemplate: false, template: null }
}

export async function fetchTemplateVariables({ signal } = {}) {
  const response = await httpClient.get(ENDPOINTS.templates.variables, { signal })
  return response.data?.data?.variables ?? []
}

export async function createTemplate(payload, { signal } = {}) {
  const response = await httpClient.post(ENDPOINTS.templates.list, payload, { signal })
  return response.data?.data?.template ?? null
}

export async function updateTemplate(id, payload, { signal } = {}) {
  const response = await httpClient.put(ENDPOINTS.templates.detail(id), payload, { signal })
  return { template: response.data?.data?.template ?? null, message: response.data?.message ?? null }
}

export async function deleteTemplate(id, { signal } = {}) {
  const response = await httpClient.delete(ENDPOINTS.templates.detail(id), { signal })
  return response.data?.message ?? null
}

export async function duplicateTemplate(id, { signal } = {}) {
  const response = await httpClient.post(ENDPOINTS.templates.duplicate(id), {}, { signal })
  return response.data?.data?.template ?? null
}

/**
 * Lifecycle transitions.
 *
 * One function per transition rather than a `setStatus(status)`, because the
 * server treats them differently — activating stands the incumbent down, and
 * only these four are reachable from the UI.
 */
const transition = (endpoint) => async (id, { signal } = {}) => {
  const response = await httpClient.post(endpoint(id), {}, { signal })
  return {
    template: response.data?.data?.template ?? null,
    message: response.data?.message ?? null,
    stoppedAutomation: response.data?.data?.stoppedAutomation ?? false,
  }
}

export const activateTemplate = transition(ENDPOINTS.templates.activate)
export const deactivateTemplate = transition(ENDPOINTS.templates.deactivate)
export const archiveTemplate = transition(ENDPOINTS.templates.archive)
export const restoreTemplate = transition(ENDPOINTS.templates.restore)

/**
 * Renders a template against a real enquiry.
 *
 * Accepts unsaved `subject`/`bodyHtml`, so the editor previews what is on
 * screen rather than what was last saved.
 */
export async function previewTemplate(payload, { signal } = {}) {
  const response = await httpClient.post(ENDPOINTS.templates.preview, payload, { signal })
  return response.data?.data ?? null
}

/** Sends a test. Writes nothing to mail history and touches no enquiry. */
export async function sendTestEmail(payload, { signal } = {}) {
  const response = await httpClient.post(ENDPOINTS.templates.testEmail, payload, { signal })
  return { message: response.data?.message ?? null, data: response.data?.data ?? null }
}

export default {
  fetchTemplates,
  fetchTemplate,
  fetchActiveTemplate,
  fetchTemplateVariables,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  duplicateTemplate,
  activateTemplate,
  deactivateTemplate,
  archiveTemplate,
  restoreTemplate,
  previewTemplate,
  sendTestEmail,
}
