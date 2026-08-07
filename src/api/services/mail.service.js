/**
 * Mail service.
 *
 * The transport boundary for everything the compose screen and history view
 * need. Components and hooks call these functions; nothing outside this folder
 * touches Axios or knows a URL.
 *
 * `fileToAttachment` lives here too, because turning a `File` into the base64
 * shape the API expects is part of the transport contract — not something a
 * component should have to know.
 */

import { ENDPOINTS } from '@/api/endpoints'
import { httpClient } from '@/api/httpClient'

/**
 * Reads a browser `File` into the attachment shape the API accepts.
 *
 * `readAsDataURL` is used rather than `readAsArrayBuffer` + manual base64
 * because the browser does the encoding natively. Encoding a multi-megabyte
 * buffer in JavaScript would block the main thread and freeze the UI mid-compose.
 *
 * The `data:<mime>;base64,` prefix is stripped server-side as well, so a client
 * that forgets is still handled — this just avoids sending the redundant bytes.
 *
 * @param {File} file
 * @returns {Promise<{ name: string, contentType: string, contentBytes: string, size: number }>}
 */
export function fileToAttachment(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onerror = () => reject(new Error(`Could not read “${file.name}”.`))

    reader.onload = () => {
      const result = String(reader.result ?? '')
      const separator = result.indexOf(',')

      if (separator === -1) {
        reject(new Error(`Could not read “${file.name}”.`))
        return
      }

      resolve({
        name: file.name,
        contentType: file.type || 'application/octet-stream',
        contentBytes: result.slice(separator + 1),
        // Kept for the UI's own size display; the server recomputes it from the
        // payload rather than trusting this value.
        size: file.size,
      })
    }

    reader.readAsDataURL(file)
  })
}

/**
 * Sends a message.
 *
 * @param {object} payload `{ to, cc, bcc, subject, html, text, attachments }`
 * @param {{ signal?: AbortSignal }} [options]
 * @returns {Promise<object>} The persisted mail record.
 */
export async function sendMail(payload, { signal } = {}) {
  const response = await httpClient.post(ENDPOINTS.mail.send, payload, { signal })
  return response.data?.data?.mail ?? response.data?.data
}

/**
 * Saves a draft.
 *
 * @param {object} payload Same shape as `sendMail`; every field may be empty.
 * @param {{ signal?: AbortSignal }} [options]
 * @returns {Promise<object>}
 */
export async function saveDraft(payload, { signal } = {}) {
  const response = await httpClient.post(ENDPOINTS.mail.draft, payload, { signal })
  return response.data?.data?.mail ?? response.data?.data
}

/**
 * Fetches a page of history.
 *
 * Returns the envelope's `meta` alongside the items, because pagination controls
 * need the total and the page flags.
 *
 * @param {{ page?: number, limit?: number, status?: string, search?: string }} [params]
 * @param {{ signal?: AbortSignal }} [options]
 * @returns {Promise<{ items: object[], meta: object, limits: object }>}
 */
export async function fetchMailHistory(params = {}, { signal } = {}) {
  // Empty values are stripped so the request URL stays clean and the server
  // applies its own defaults rather than parsing `status=`.
  const query = Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== '' && value != null),
  )

  const response = await httpClient.get(ENDPOINTS.mail.history, { params: query, signal })

  return {
    items: response.data?.data?.items ?? [],
    limits: response.data?.data?.limits ?? null,
    meta: response.data?.meta ?? null,
  }
}

/**
 * Fetches one message in full.
 *
 * @param {string} id
 * @param {{ signal?: AbortSignal }} [options]
 * @returns {Promise<object>}
 */
export async function fetchMailById(id, { signal } = {}) {
  const response = await httpClient.get(ENDPOINTS.mail.detail(id), { signal })
  return response.data?.data?.mail ?? response.data?.data
}

/**
 * Deletes a record from history.
 *
 * @param {string} id
 * @param {{ signal?: AbortSignal }} [options]
 * @returns {Promise<{ id: string, removedFromMailbox: boolean }>}
 */
export async function deleteMail(id, { signal } = {}) {
  const response = await httpClient.delete(ENDPOINTS.mail.detail(id), { signal })
  return response.data?.data
}

export default {
  fileToAttachment,
  sendMail,
  saveDraft,
  fetchMailHistory,
  fetchMailById,
  deleteMail,
}
