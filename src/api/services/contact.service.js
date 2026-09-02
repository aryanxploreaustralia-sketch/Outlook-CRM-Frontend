/**
 * Contacts service.
 *
 * The transport boundary for the contacts pages and the dashboard widget.
 * Components and hooks call these; nothing outside this folder touches Axios or
 * knows a URL.
 */

import { ENDPOINTS } from '@/api/endpoints'
import { httpClient } from '@/api/httpClient'

/**
 * Fetches a page of contacts.
 *
 * Empty parameters are stripped so the request URL stays clean and the server
 * applies its own defaults rather than parsing `filter=`.
 *
 * @returns {Promise<{ items: object[], facets: object, meta: object }>}
 */
export async function fetchContacts(params = {}, { signal } = {}) {
  const query = Object.fromEntries(
    Object.entries(params).filter(([, value]) => {
      if (value === '' || value === null || value === undefined) return false
      if (Array.isArray(value) && value.length === 0) return false
      return true
    }),
  )

  const response = await httpClient.get(ENDPOINTS.contacts.list, { params: query, signal })

  return {
    items: response.data?.data?.items ?? [],
    facets: response.data?.data?.facets ?? { companies: [], countries: [], tags: [] },
    meta: response.data?.meta ?? null,
  }
}

/** @returns {Promise<{ contact: object, groups: object[] }>} */
export async function fetchContact(id, { signal } = {}) {
  const response = await httpClient.get(ENDPOINTS.contacts.detail(id), { signal })
  return response.data?.data
}

export async function createContact(payload, { signal, headers } = {}) {
  const response = await httpClient.post(ENDPOINTS.contacts.list, payload, { signal, headers })
  return response.data?.data
}

export async function updateContact(id, payload, { signal, headers } = {}) {
  const response = await httpClient.put(ENDPOINTS.contacts.detail(id), payload, { signal, headers })
  return response.data?.data?.contact
}

export async function deleteContact(id, { signal } = {}) {
  const response = await httpClient.delete(ENDPOINTS.contacts.detail(id), { signal })
  return response.data?.data
}

export async function restoreContact(id, { signal } = {}) {
  const response = await httpClient.post(ENDPOINTS.contacts.restore(id), {}, { signal })
  return response.data?.data?.contact
}

/**
 * Applies one action to many contacts.
 *
 * @param {{ ids: string[], action: string, value?: string }} payload
 */
export async function bulkAction(payload, { signal } = {}) {
  const response = await httpClient.post(ENDPOINTS.contacts.bulk, payload, { signal })
  return response.data?.data
}

export async function mergeContacts(keepId, { absorbId, strategy }, { signal } = {}) {
  const response = await httpClient.post(
    ENDPOINTS.contacts.merge(keepId),
    { absorbId, strategy },
    { signal },
  )
  return response.data?.data
}

export async function fetchStatistics({ signal } = {}) {
  const response = await httpClient.get(ENDPOINTS.contacts.statistics, { signal })
  return response.data?.data
}

export async function fetchDuplicates({ signal } = {}) {
  const response = await httpClient.get(ENDPOINTS.contacts.duplicates, { signal })
  return response.data?.data?.clusters ?? []
}

/** Triggers a contact synchronisation. */
export async function syncContacts({ mode = 'incremental', signal } = {}) {
  const response = await httpClient.post(
    ENDPOINTS.contacts.sync,
    { mode },
    // A sync makes many upstream calls and can outlast the default timeout,
    // which would abort a run that is working perfectly.
    { signal, timeout: 120_000 },
  )
  return response.data?.data
}

/**
 * Reads a browser `File` to base64 for import.
 *
 * `readAsDataURL` is used because the browser does the encoding natively;
 * encoding a large buffer in JavaScript would block the main thread.
 */
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error(`Could not read “${file.name}”.`))
    reader.onload = () => {
      const result = String(reader.result ?? '')
      const separator = result.indexOf(',')
      if (separator === -1) reject(new Error(`Could not read “${file.name}”.`))
      else resolve(result.slice(separator + 1))
    }
    reader.readAsDataURL(file)
  })
}

/** Infers the transfer format from a filename. */
export function formatFromFilename(name) {
  const extension = String(name ?? '').split('.').pop()?.toLowerCase()
  return ['csv', 'vcf', 'xlsx', 'json'].includes(extension) ? extension : 'csv'
}

export async function importContacts({ content, format, mode, defaultTags = [] }, { signal } = {}) {
  const response = await httpClient.post(
    ENDPOINTS.contacts.import,
    { content, format, mode, defaultTags, encoding: 'base64' },
    { signal, timeout: 180_000 },
  )
  return response.data?.data
}

/**
 * Exports contacts and triggers a browser download.
 *
 * Requests a blob because the response is a file, not the JSON envelope — the
 * endpoint streams it directly so the client can save it without decoding.
 */
export async function exportContacts(payload, { signal } = {}) {
  const response = await httpClient.post(ENDPOINTS.contacts.export, payload, {
    signal,
    responseType: 'blob',
    timeout: 120_000,
  })

  // The server names the file; Content-Disposition is exposed via CORS for this.
  const disposition = response.headers['content-disposition'] ?? ''
  const match = /filename="([^"]+)"/.exec(disposition)
  const filename = match?.[1] ?? `contacts.${payload.format ?? 'csv'}`

  const url = URL.createObjectURL(response.data)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.append(anchor)
  anchor.click()
  anchor.remove()

  // Released on the next tick; revoking immediately can cancel the download in
  // some browsers before it has started.
  setTimeout(() => URL.revokeObjectURL(url), 1000)

  return { filename }
}

// --- Groups ----------------------------------------------------------------

export async function fetchGroups(params = {}, { signal } = {}) {
  const response = await httpClient.get(ENDPOINTS.contactGroups.list, { params, signal })
  return { items: response.data?.data?.items ?? [], meta: response.data?.meta ?? null }
}

export async function fetchGroup(id, { signal } = {}) {
  const response = await httpClient.get(ENDPOINTS.contactGroups.detail(id), { signal })
  return response.data?.data
}

export async function createGroup(payload, { signal } = {}) {
  const response = await httpClient.post(ENDPOINTS.contactGroups.list, payload, { signal })
  return response.data?.data?.group
}

export async function updateGroup(id, payload, { signal } = {}) {
  const response = await httpClient.put(ENDPOINTS.contactGroups.detail(id), payload, { signal })
  return response.data?.data?.group
}

export async function deleteGroup(id, { signal } = {}) {
  const response = await httpClient.delete(ENDPOINTS.contactGroups.detail(id), { signal })
  return response.data?.data
}

export async function addGroupMembers(id, contactIds, { signal } = {}) {
  const response = await httpClient.post(
    ENDPOINTS.contactGroups.members(id),
    { contactIds },
    { signal },
  )
  return response.data?.data?.group
}

export async function removeGroupMembers(id, contactIds, { signal } = {}) {
  const response = await httpClient.delete(ENDPOINTS.contactGroups.members(id), {
    data: { contactIds },
    signal,
  })
  return response.data?.data?.group
}

export default {
  fetchContacts,
  fetchContact,
  createContact,
  updateContact,
  deleteContact,
  restoreContact,
  bulkAction,
  mergeContacts,
  fetchStatistics,
  fetchDuplicates,
  syncContacts,
  importContacts,
  exportContacts,
  fileToBase64,
  formatFromFilename,
  fetchGroups,
  fetchGroup,
  createGroup,
  updateGroup,
  deleteGroup,
  addGroupMembers,
  removeGroupMembers,
}
