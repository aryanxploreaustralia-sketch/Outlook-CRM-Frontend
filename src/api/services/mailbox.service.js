/**
 * Connected mailbox service.
 *
 * The transport boundary for the Account page's mailbox management and for the
 * Send From pickers on Compose and the campaign builder.
 *
 * Connecting is the one operation that cannot go through Axios, for exactly the
 * reason sign-in cannot: the browser has to perform a real top-level navigation
 * so it can follow the redirect to Microsoft, show the account chooser and the
 * consent screen, and come back. An XHR would be blocked by CORS at the
 * Microsoft domain and could not render the UI at all.
 */

import { ENDPOINTS } from '@/api/endpoints'
import { httpClient } from '@/api/httpClient'
import { env } from '@/config/env'

/**
 * Fetches every mailbox this workspace has connected.
 *
 * An empty list is a successful answer, not an error — a workspace that has
 * connected nothing yet is a normal state the Account page renders.
 *
 * @param {{ signal?: AbortSignal }} [options]
 * @returns {Promise<{ items: object[], defaultMailboxId: ?string, canSendMail: boolean, connectAvailable: boolean }>}
 */
export async function fetchMailboxes({ signal } = {}) {
  const response = await httpClient.get(ENDPOINTS.mailboxes.list, { signal })
  return response.data?.data ?? response.data
}

/**
 * Starts connecting an additional Microsoft mailbox.
 *
 * Requires an existing CRM session — this authorises a mailbox, it does not
 * sign anybody in. The server reads ownership from the flow record it writes
 * before redirecting, never from the callback's query string.
 *
 * @param {{ returnPath?: string }} [options]
 *   Path within this app to return to. Must be relative; the server rejects
 *   absolute URLs to prevent an open redirect.
 */
export function startMailboxConnect({ returnPath, mailboxId } = {}) {
  const url = new URL(`${env.apiBaseUrl}${ENDPOINTS.mailboxes.connect}`, window.location.origin)

  if (returnPath) {
    url.searchParams.set('returnPath', returnPath)
  }

  /**
   * Present only for a **reconnect**, naming the registry entry being repaired.
   *
   * The server re-resolves this against the caller's own mailboxes and then
   * requires the Microsoft account that comes back to match it, so signing in
   * with the wrong account is refused rather than quietly rewriting the entry
   * to point at a different mailbox.
   */
  if (mailboxId) {
    url.searchParams.set('mailboxId', mailboxId)
  }

  // `assign` rather than `replace`, so Back still works if the user abandons
  // the Microsoft consent screen.
  window.location.assign(url.toString())
}

/**
 * Makes one mailbox the workspace's default sender.
 *
 * The server refuses a mailbox that needs reconnecting, because the default is
 * what unattended mail resolves to.
 *
 * @param {string} id
 * @returns {Promise<object>}
 */
export async function setDefaultMailbox(id) {
  const response = await httpClient.patch(ENDPOINTS.mailboxes.setDefault(id))
  return response.data?.data ?? response.data
}

/**
 * Disconnects one mailbox.
 *
 * Ends future access only. Mail history, conversations, leads and campaigns are
 * all kept, and the CRM session is untouched.
 *
 * @param {string} id
 * @returns {Promise<object>}
 */
export async function disconnectMailbox(id) {
  const response = await httpClient.delete(ENDPOINTS.mailboxes.disconnect(id))
  return response.data?.data ?? response.data
}

export default {
  fetchMailboxes,
  startMailboxConnect,
  setDefaultMailbox,
  disconnectMailbox,
}
