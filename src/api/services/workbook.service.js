/**
 * Background workbook service.
 *
 * The transport boundary for queued imports. `lead.service`'s `syncWorkbook`
 * still exists and still runs the import inside the request — it is what the
 * preview uses, because a dry run writes nothing and returns in milliseconds.
 * This is for the real import, which may take minutes.
 */

import { ENDPOINTS } from '@/api/endpoints'
import { httpClient } from '@/api/httpClient'

/** Strips empty options so the server applies its own defaults. */
function clean(params = {}) {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== '' && value !== null && value !== undefined),
  )
}

/**
 * Queues a workbook and returns its job id.
 *
 * Resolves as soon as the file has been uploaded and accepted — not when the
 * import finishes. Poll `fetchWorkbookJob` for that.
 *
 * @returns {Promise<{ jobId: string, status: string, filename: string, queuedAt: string }>}
 */
export async function queueWorkbookSync(
  file,
  { sheet, mapping = null, sendMail = true, forceResend = false, templateId = null, signal, onUploadProgress } = {},
) {
  const response = await httpClient.post(ENDPOINTS.workbook.sync, file, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'X-Filename': file.name,
      'X-Import-Options': JSON.stringify(clean({ sheet, mapping, sendMail, forceResend, templateId })),
    },
    signal,
    onUploadProgress,
  })

  return response.data?.data ?? null
}

/** Live progress for one run. */
export async function fetchWorkbookJob(id, { signal } = {}) {
  const response = await httpClient.get(ENDPOINTS.workbook.job(id), { signal })
  return response.data?.data ?? null
}

/** Recent background runs. `active: true` narrows to queued and running. */
export async function fetchWorkbookJobs(params = {}, { signal } = {}) {
  const response = await httpClient.get(ENDPOINTS.workbook.jobs, { params: clean(params), signal })
  return response.data?.data?.items ?? []
}

/** Asks the worker to stop at the next batch boundary. */
export async function cancelWorkbookJob(id, { signal } = {}) {
  const response = await httpClient.post(ENDPOINTS.workbook.cancelJob(id), {}, { signal })
  return { job: response.data?.data ?? null, message: response.data?.message ?? null }
}

export default { queueWorkbookSync, fetchWorkbookJob, fetchWorkbookJobs, cancelWorkbookJob }
