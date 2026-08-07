/**
 * Provider service.
 *
 * The transport boundary for the provider pages and the dashboard status card.
 * Components and hooks call these; nothing outside this folder touches Axios or
 * knows a URL.
 */

import { ENDPOINTS } from '@/api/endpoints'
import { httpClient } from '@/api/httpClient'

/**
 * Fetches connection and sync state.
 *
 * @param {{ signal?: AbortSignal }} [options]
 * @returns {Promise<object>}
 */
export async function fetchProviderStatus({ mailboxId = null, signal } = {}) {
  const response = await httpClient.get(ENDPOINTS.provider.status, {
    params: mailboxId ? { mailboxId } : undefined,
    signal,
  })
  return response.data?.data ?? response.data
}

/** Live probe — makes a real round trip to the provider. */
export async function validateConnection({ mailboxId = null, signal } = {}) {
  const response = await httpClient.get(ENDPOINTS.provider.validate, {
    params: mailboxId ? { mailboxId } : undefined,
    signal,
  })
  return response.data?.data
}

/**
 * Fetches folders.
 *
 * @param {{ refresh?: boolean, signal?: AbortSignal }} [options]
 *   `refresh` re-reads them from the provider instead of serving the stored list.
 */
export async function fetchFolders({ mailboxId = null, refresh = false, signal } = {}) {
  const response = await httpClient.get(ENDPOINTS.provider.folders, {
    params: {
      ...(refresh ? { refresh: 'true' } : {}),
      ...(mailboxId ? { mailboxId } : {}),
    },
    signal,
  })
  return response.data?.data
}

/** Connects a mailbox. Idempotent — safe to call on an already-connected one. */
export async function connectProvider({ provider, signal } = {}) {
  const response = await httpClient.post(
    ENDPOINTS.provider.connect,
    provider ? { provider } : {},
    { signal },
  )
  return response.data?.data
}

/** Disconnects the mailbox. Synced messages are retained server-side. */
export async function disconnectProvider({ mailboxId = null, signal } = {}) {
  const response = await httpClient.post(
    ENDPOINTS.provider.disconnect,
    mailboxId ? { mailboxId } : {},
    { signal },
  )
  return response.data?.data
}

/**
 * Triggers a synchronisation.
 *
 * @param {{ folder?: string, mode?: string, signal?: AbortSignal }} [options]
 *   `folder` selects a per-folder endpoint; omitting it syncs everything.
 * @returns {Promise<object>} The completed run.
 */
export async function runSync({ folder = null, mode = 'incremental', mailboxId = null, signal } = {}) {
  const endpoint =
    {
      inbox: ENDPOINTS.provider.syncInbox,
      sent: ENDPOINTS.provider.syncSent,
      drafts: ENDPOINTS.provider.syncDrafts,
      archive: ENDPOINTS.provider.syncArchive,
    }[folder] ?? ENDPOINTS.provider.sync

  const response = await httpClient.post(
    endpoint,
    // The mailbox travels in the body beside the mode, so a sync can never be
    // dispatched without naming which mailbox it is for.
    { mode, ...(mailboxId ? { mailboxId } : {}) },
    {
      signal,
      // A sync makes many upstream calls and can legitimately outlast the
      // default client timeout, which would abort a run that is working.
      timeout: 120_000,
    },
  )

  return response.data?.data
}

/**
 * Fetches paginated run history.
 *
 * @returns {Promise<{ items: object[], meta: ?object }>}
 */
export async function fetchSyncHistory({
  page = 1,
  limit = 20,
  mailboxId = null,
  allMailboxes = false,
  signal,
} = {}) {
  const response = await httpClient.get(ENDPOINTS.provider.history, {
    params: {
      page,
      limit,
      ...(mailboxId && !allMailboxes ? { mailboxId } : {}),
      ...(allMailboxes ? { allMailboxes: 'true' } : {}),
    },
    signal,
  })

  return {
    items: response.data?.data ?? [],
    meta: response.data?.meta ?? null,
  }
}

export default {
  fetchProviderStatus,
  validateConnection,
  fetchFolders,
  connectProvider,
  disconnectProvider,
  runSync,
  fetchSyncHistory,
}
