/**
 * The signed-in user's email signature.
 *
 * Two calls against the existing profile module, which is already mounted at
 * `/v1/account` — no new client, no new auth, and the endpoints only ever
 * address the caller's own record.
 *
 * The stored HTML is sanitised on the server before it is written, so what
 * comes back here is already safe to insert into the editor.
 */

import { httpClient } from '@/api/httpClient'

/** @returns {Promise<string>} the saved signature, or `''` when none is set. */
export async function fetchMySignature({ signal } = {}) {
  const response = await httpClient.get('/v1/account/signature', { signal })

  return response.data?.data?.signatureHtml ?? ''
}

/**
 * Replaces the signature. An empty string clears it, which is a legitimate
 * thing to save rather than an error.
 */
export async function saveMySignature(signatureHtml, { signal } = {}) {
  const response = await httpClient.put('/v1/account/signature', { signatureHtml }, { signal })

  return response.data?.data?.signatureHtml ?? ''
}

export default { fetchMySignature, saveMySignature }
