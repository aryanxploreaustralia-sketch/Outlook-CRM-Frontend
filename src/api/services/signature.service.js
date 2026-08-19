/**
 * The signed-in user's email signature.
 *
 * Two calls against the existing profile module.
 *
 * The path is `/v1/profile`, not `/v1/account`. Both exist and they are
 * different routers — `/v1/account` is the Microsoft account and mailbox
 * surface. An earlier version of this file called `/v1/account/signature`,
 * which reached the wrong router and 404ed on every click.
 *
 * The stored HTML is sanitised on the server before it is written, so what
 * comes back here is already safe to insert into the editor.
 */

import { httpClient } from '@/api/httpClient'

/** Named once, so the two calls below cannot drift apart again. */
const SIGNATURE_URL = '/v1/profile/signature'

/** @returns {Promise<string>} the saved signature, or `''` when none is set. */
export async function fetchMySignature({ signal } = {}) {
  const response = await httpClient.get(SIGNATURE_URL, { signal })

  return response.data?.data?.signatureHtml ?? ''
}

/**
 * Replaces the signature. An empty string clears it, which is a legitimate
 * thing to save rather than an error.
 */
export async function saveMySignature(signatureHtml, { signal } = {}) {
  const response = await httpClient.put(SIGNATURE_URL, { signatureHtml }, { signal })

  return response.data?.data?.signatureHtml ?? ''
}

export default { fetchMySignature, saveMySignature }
