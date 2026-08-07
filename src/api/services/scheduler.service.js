/**
 * Morning scheduler service.
 *
 * The transport boundary for the Settings screen and the dashboard card.
 * Components call these; nothing outside this folder touches Axios or knows a
 * URL.
 */

import { ENDPOINTS } from '@/api/endpoints'
import { httpClient } from '@/api/httpClient'

/** Strips empty parameters so the server applies its own defaults. */
function clean(params = {}) {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== '' && value !== null && value !== undefined),
  )
}

/**
 * The configuration, the last run, the next run and the recent history.
 *
 * One request rather than three, because the settings form and the status panel
 * are the same screen and must never disagree about whether the schedule is on.
 */
export async function fetchScheduler({ signal } = {}) {
  const response = await httpClient.get(ENDPOINTS.scheduler.settings, { signal })
  return response.data?.data ?? null
}

/**
 * Saves a partial change.
 *
 * Only the changed fields are sent: the endpoint patches, and posting the whole
 * form back would let a stale field silently undo somebody else's edit.
 *
 * @param {{ enabled?, runTime?, timezone?, sendMail?, maxRetries?, retryDelaySeconds? }} changes
 */
export async function updateScheduler(changes, { signal } = {}) {
  const response = await httpClient.patch(ENDPOINTS.scheduler.settings, clean(changes), { signal })

  return {
    settings: response.data?.data ?? null,
    message: response.data?.message ?? null,
  }
}

/**
 * Runs today's scheduler now.
 *
 * Resolves as soon as the decision has been made — which may be "queued", but
 * may equally be "there was no workbook" or "that file was already processed".
 * `queued` says which, and a queued run reports progress through the existing
 * workbook job endpoints.
 *
 * @returns {Promise<{ queued: boolean, status: string, importJob: ?string, run: ?object, message: string }>}
 */
export async function runSchedulerNow({ signal } = {}) {
  const response = await httpClient.post(ENDPOINTS.scheduler.run, {}, { signal })

  return {
    ...(response.data?.data ?? { queued: false, status: null, importJob: null, run: null }),
    message: response.data?.message ?? null,
  }
}

/** Every attempt, newest first. */
export async function fetchSchedulerRuns(params = {}, { signal } = {}) {
  const response = await httpClient.get(ENDPOINTS.scheduler.runs, { params: clean(params), signal })
  return response.data?.data?.items ?? []
}

/**
 * Reads the inbox now (Phase H4).
 *
 * Runs through the same worker the five-minute timer uses, so the result is
 * exactly what the automatic sync would have produced. Resolves once the sync
 * has finished — unlike the workbook run, a reply sync is seconds, not minutes.
 *
 * @returns {Promise<{ ok: boolean, status: string, created: number, matched: number, unmatched: number, message: string }>}
 */
export async function syncRepliesNow({ signal } = {}) {
  const response = await httpClient.post(ENDPOINTS.scheduler.replySyncRun, {}, { signal })

  return {
    ...(response.data?.data ?? { ok: false, status: null, created: 0, matched: 0, unmatched: 0 }),
    message: response.data?.message ?? null,
  }
}

export default {
  fetchScheduler,
  updateScheduler,
  runSchedulerNow,
  fetchSchedulerRuns,
  syncRepliesNow,
}
