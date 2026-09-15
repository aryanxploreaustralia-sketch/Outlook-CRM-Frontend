/**
 * The installed app's icon badge — the count on the CRM icon in the Windows
 * taskbar, the macOS dock or a ChromeOS shelf.
 *
 * Not the bell's red dot. That one is HTML inside the page; this one is drawn by
 * the operating system through the App Badging API, and only for an installed
 * PWA in a browser that implements it (Chromium on Windows, macOS and ChromeOS
 * today). Everywhere else the API is absent and this module does nothing.
 *
 * ## No transport of its own
 *
 * It never fetches. The count comes from the notification bell, which already
 * polls the owner-scoped notification endpoint and receives `unreadCount` with
 * every response. A second poll just for the icon would double the requests for
 * a number the page already holds.
 *
 * ## Deduplicated
 *
 * The bell polls every thirty seconds and the count rarely changes, so the same
 * value arrives over and over. Only a change reaches the OS.
 *
 * ## Scoped to one user
 *
 * The last value is remembered together with the user it belonged to. A change
 * of user forgets it, so "3" for one person can never be skipped as a duplicate
 * of "3" for the next — and `clearAppBadge` on sign-out wipes both.
 */

/** The last count sent to the OS, or `null` when unknown. */
let lastCount = null

/** The user `lastCount` belongs to. */
let lastOwner = null

/** `navigator`, or null outside a browser (SSR, the verify scripts). */
function getNavigator() {
  return typeof navigator === 'undefined' ? null : navigator
}

/** Whether this browser can badge the installed app at all. */
export function isAppBadgeSupported() {
  return typeof getNavigator()?.setAppBadge === 'function'
}

/** Normalises anything to a non-negative integer. */
function toCount(value) {
  const number = Math.floor(Number(value))
  return Number.isFinite(number) && number > 0 ? number : 0
}

/** Removes the badge. Never throws. */
async function clearOnOs() {
  const nav = getNavigator()

  if (typeof nav?.clearAppBadge === 'function') {
    await nav.clearAppBadge()
  } else if (typeof nav?.setAppBadge === 'function') {
    // The spec defines 0 as "clear", for implementations without the method.
    await nav.setAppBadge(0)
  }
}

/**
 * Shows `count` on the app icon for `owner`, or clears it at zero.
 *
 * @param {number} count  Unread notifications for the signed-in user.
 * @param {string|null} owner  That user's id.
 * @returns {Promise<boolean>} Whether anything was sent to the OS.
 */
export async function setAppBadgeCount(count, owner) {
  const next = toCount(count)

  if (owner !== lastOwner) {
    lastOwner = owner
    lastCount = null
  }

  if (next === lastCount) return false
  if (!isAppBadgeSupported()) return false

  lastCount = next

  try {
    if (next > 0) {
      await getNavigator().setAppBadge(next)
    } else {
      await clearOnOs()
    }
    return true
  } catch {
    // Refused (not installed, permission policy). Forget the value so the next
    // poll tries again rather than believing the icon is up to date.
    lastCount = null
    return false
  }
}

/**
 * Clears the badge and forgets the user — sign-out, or a change of account.
 *
 * @returns {Promise<boolean>} Whether anything was sent to the OS.
 */
export async function clearAppBadge() {
  lastOwner = null
  lastCount = null

  if (!isAppBadgeSupported()) return false

  try {
    await clearOnOs()
    return true
  } catch {
    return false
  }
}

export default { isAppBadgeSupported, setAppBadgeCount, clearAppBadge }
