/**
 * Saving a workbook the server generated.
 *
 * ## Why this is its own module
 *
 * The admin service's `get` unwraps the JSON envelope every other admin
 * endpoint returns, which a binary body does not have — so an export cannot go
 * through it.
 *
 * The CRM's own export does the same browser dance in
 * `api/services/lead.service.js`. That code is deliberately left alone: the
 * User Panel export is working and in use, and refactoring it to share this
 * helper would put a working feature at risk for no gain in correctness. The
 * duplication here is browser plumbing — blob, anchor, revoke — and not the
 * part that could make two export files disagree: the columns, the formatting
 * and the filters all live on the server, where both exports now share one
 * definition.
 */

import { httpClient } from '@/api/httpClient'

/** Drops empty values so an unset filter sends no parameter at all. */
function clean(params = {}) {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  )
}

/**
 * Requests a workbook and hands it to the browser as a download.
 *
 * @param {string} url     The endpoint to GET.
 * @param {object} params  Query parameters; empty values are dropped.
 * @param {{ signal?: AbortSignal }} [options]
 * @returns {Promise<{ filename: string, count: number, truncated: boolean }>}
 */
export async function downloadWorkbook(url, params = {}, { signal } = {}) {
  const response = await httpClient.get(url, {
    params: clean(params),
    signal,
    responseType: 'blob',
    // A register of tens of thousands of rows takes longer than a page read.
    timeout: 120_000,
  })

  // The server names the file; `Content-Disposition` is CORS-exposed for this.
  const disposition = response.headers['content-disposition'] ?? ''
  const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? 'leads.xlsx'

  const objectUrl = URL.createObjectURL(response.data)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = filename
  document.body.append(anchor)
  anchor.click()
  anchor.remove()

  // Released on the next tick; revoking immediately can cancel the download in
  // some browsers before it has started.
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)

  return {
    filename,
    count: Number(response.headers['x-export-count'] ?? 0),
    truncated: response.headers['x-export-truncated'] === 'true',
  }
}

export default { downloadWorkbook }
