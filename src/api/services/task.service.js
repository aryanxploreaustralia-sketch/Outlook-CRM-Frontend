/**
 * Tasks and goals transport (Phase 18).
 *
 * One service for both audiences. An employee and an administrator call the
 * same functions against the same endpoints; the server decides what comes back
 * and what each caller may do with it, and the client renders from the
 * `canUpdateStatus` / `canComment` flags on each task rather than re-deriving
 * them from a role it happens to know.
 *
 * Attachments use the raw-body upload the document centre established —
 * `express.raw` with the filename in a header. No multipart parser exists in
 * this product and one file does not justify introducing one.
 */

import { ENDPOINTS } from '@/api/endpoints'
import { httpClient } from '@/api/httpClient'

/** Strips empty values, so `?status=` never reaches Zod as an empty string. */
function clean(params = {}) {
  return Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== '' && value !== null && value !== undefined,
    ),
  )
}

/** Unwraps the standard envelope. Every endpoint answers `{ success, data }`. */
async function get(url, { params, signal } = {}) {
  const response = await httpClient.get(url, { params: clean(params), signal })
  return response.data?.data ?? null
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export function fetchTasks(params = {}, { signal } = {}) {
  return get(ENDPOINTS.tasks.list, { params, signal })
}

export function fetchTask(id, { signal } = {}) {
  return get(ENDPOINTS.tasks.detail(id), { signal })
}

/** The employee's own board: today, upcoming, goals, recently completed. */
export function fetchMyWorkspace({ signal } = {}) {
  return get(ENDPOINTS.tasks.workspace, { signal })
}

export function fetchTaskSummary({ user, signal } = {}) {
  return get(ENDPOINTS.tasks.summary, { params: { user }, signal })
}

/** One person's report, or the team's when `scope: 'team'`. */
export function fetchTaskReport({ user, scope, range = {}, signal } = {}) {
  return get(ENDPOINTS.tasks.report, { params: { user, scope, ...range }, signal })
}

/** The console's task widgets. Needs `analytics.view`. */
export function fetchTaskHighlights({ range = {}, signal } = {}) {
  return get(ENDPOINTS.tasks.highlights, { params: range, signal })
}

export async function createTask(input) {
  const response = await httpClient.post(ENDPOINTS.tasks.list, input)
  return response.data?.data ?? null
}

export async function updateTask(id, patch) {
  const response = await httpClient.patch(ENDPOINTS.tasks.detail(id), patch)
  return response.data?.data ?? null
}

export async function deleteTask(id) {
  const response = await httpClient.delete(ENDPOINTS.tasks.detail(id))
  return response.data?.data ?? null
}

export async function commentOnTask(id, body) {
  const response = await httpClient.post(ENDPOINTS.tasks.comments(id), { body })
  return response.data?.data ?? null
}

/** Uploads an attachment. Raw bytes, filename in a header. */
export async function attachToTask(id, file) {
  const response = await httpClient.post(ENDPOINTS.tasks.attachments(id), file, {
    headers: { 'Content-Type': 'application/octet-stream', 'x-filename': file.name },
  })

  return response.data?.data ?? null
}

/**
 * Where an attachment is served from.
 *
 * A URL rather than a fetch, so the browser handles the filename, the progress
 * and the PDF viewer — all of which would have to be rebuilt around a blob.
 */
export function taskAttachmentUrl(id, attachmentId, { download = false } = {}) {
  const base = httpClient.defaults.baseURL ?? ''
  return `${base}${ENDPOINTS.tasks.attachment(id, attachmentId)}${download ? '?download=1' : ''}`
}

// ---------------------------------------------------------------------------
// Goals
// ---------------------------------------------------------------------------

export function fetchGoals({ user, period, activeOnly = true, signal } = {}) {
  return get(ENDPOINTS.goals.list, {
    params: { user, period, activeOnly: activeOnly ? '1' : '0' },
    signal,
  })
}

export function fetchGoalSummary({ user, signal } = {}) {
  return get(ENDPOINTS.goals.summary, { params: { user }, signal })
}

export async function createGoal(input) {
  const response = await httpClient.post(ENDPOINTS.goals.list, input)
  return response.data?.data ?? null
}

export async function updateGoal(id, patch) {
  const response = await httpClient.patch(ENDPOINTS.goals.detail(id), patch)
  return response.data?.data ?? null
}

export async function deleteGoal(id) {
  const response = await httpClient.delete(ENDPOINTS.goals.detail(id))
  return response.data?.data ?? null
}

export default {
  attachToTask,
  commentOnTask,
  createGoal,
  createTask,
  deleteGoal,
  deleteTask,
  fetchGoalSummary,
  fetchGoals,
  fetchMyWorkspace,
  fetchTask,
  fetchTaskHighlights,
  fetchTaskReport,
  fetchTaskSummary,
  fetchTasks,
  taskAttachmentUrl,
  updateGoal,
  updateTask,
}
