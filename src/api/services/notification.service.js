/**
 * Notification service.
 *
 * The transport boundary for the bell. Every response carries the unread count
 * alongside the items, so the badge and the list are always consistent with one
 * another — they came from the same read.
 */

import { ENDPOINTS } from '@/api/endpoints'
import { httpClient } from '@/api/httpClient'

/**
 * The bell's contents.
 *
 * @returns {Promise<{ items: object[], unreadCount: number }>}
 */
export async function fetchNotifications({ limit = 20, unreadOnly = false, signal } = {}) {
  const response = await httpClient.get(ENDPOINTS.notifications.list, {
    params: { limit, unreadOnly },
    signal,
  })

  return {
    items: response.data?.data?.items ?? [],
    unreadCount: response.data?.data?.unreadCount ?? 0,
  }
}

/** Marks one seen. Returns the new unread count so the badge updates at once. */
export async function markNotificationRead(id, { signal } = {}) {
  const response = await httpClient.post(ENDPOINTS.notifications.markRead(id), {}, { signal })

  return {
    notification: response.data?.data?.notification ?? null,
    unreadCount: response.data?.data?.unreadCount ?? 0,
  }
}

/** Clears the badge. */
export async function markAllNotificationsRead({ signal } = {}) {
  const response = await httpClient.post(ENDPOINTS.notifications.markAllRead, {}, { signal })
  return { marked: response.data?.data?.marked ?? 0, unreadCount: 0 }
}

export default { fetchNotifications, markNotificationRead, markAllNotificationsRead }

/**
 * Dismisses one notification.
 *
 * The server removes it softly, so it cannot be re-created by the next sync —
 * a dismissal that a poller undoes looks to the reader like a broken button.
 */
export async function dismissNotification(id) {
  const response = await httpClient.delete(ENDPOINTS.notifications.dismiss(id))
  return response.data?.data ?? null
}
