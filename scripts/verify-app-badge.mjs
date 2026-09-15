/**
 * The installed app's taskbar/dock badge.
 *
 * Runs the real `src/pwa/appBadge.js` through Vite's SSR pipeline against a
 * stubbed `navigator`, recording every call the OS would receive. The wiring in
 * the bell and the auth provider is checked from source, the same way the other
 * verify scripts check theirs.
 *
 * ## Safety
 *
 * No network, no database, no browser. Everything lives in this process.
 *
 *     node scripts/verify-app-badge.mjs
 */

import { readFileSync } from 'node:fs'
import { createServer } from 'vite'

let failures = 0
let checks = 0

const check = (ok, label, detail = '') => {
  checks += 1
  if (!ok) failures += 1
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`)
}

const section = (title) => console.log(`\n=== ${title} ===`)
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

/** Replaces the global navigator for one scenario. */
const calls = []
const installNavigator = (value) =>
  Object.defineProperty(globalThis, 'navigator', { value, configurable: true, writable: true })

const badgingNavigator = () => ({
  setAppBadge: async (count) => calls.push(['set', count]),
  clearAppBadge: async () => calls.push(['clear']),
})

const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
})

const badge = await server.ssrLoadModule('/src/pwa/appBadge.js')
const A = 'user-a-000000000001'
const B = 'user-b-000000000002'

const reset = async () => {
  installNavigator(badgingNavigator())
  await badge.clearAppBadge()
  calls.length = 0
}

// ---------------------------------------------------------------------------
section('Counts reach the OS')

await reset()
check(badge.isAppBadgeSupported(), 'feature detection finds the API')

await badge.setAppBadgeCount(1, A)
check(calls.length === 1 && calls[0][0] === 'set', '1. setAppBadge is called when unread > 0')
check(calls[0]?.[1] === 1, '2. with the exact count', JSON.stringify(calls[0]))

await badge.setAppBadgeCount(2, A)
await badge.setAppBadgeCount(3, A)
check(JSON.stringify(calls.map((c) => c[1])) === '[1,2,3]', '   1 → 2 → 3 in order')

await badge.setAppBadgeCount(2, A)
await badge.setAppBadgeCount(1, A)
calls.length = 0
await badge.setAppBadgeCount(0, A)
check(calls.length === 1 && calls[0][0] === 'clear', '3. clearAppBadge is called at zero')

await badge.setAppBadgeCount(-4, A)
await badge.setAppBadgeCount('nonsense', A)
check(calls.length === 1, '   invalid counts are treated as zero, and deduplicated')

// ---------------------------------------------------------------------------
section('Unsupported browsers')

installNavigator({})
let threw = false
try {
  const sent = await badge.setAppBadgeCount(5, A)
  const cleared = await badge.clearAppBadge()
  check(sent === false && cleared === false, '   nothing is reported as sent')
} catch {
  threw = true
}
check(!threw, '4. a missing Badging API does not throw')

installNavigator(undefined)
threw = false
try {
  await badge.setAppBadgeCount(5, A)
  await badge.clearAppBadge()
} catch {
  threw = true
}
check(!threw, '   nor does a missing navigator')

installNavigator({ setAppBadge: async () => calls.push(['set-only', 0]) })
calls.length = 0
await badge.setAppBadgeCount(2, A)
await badge.setAppBadgeCount(0, A)
check(
  calls.length === 2 && calls[1][0] === 'set-only',
  '   without clearAppBadge, zero falls back to setAppBadge(0)',
)

installNavigator({
  setAppBadge: async () => {
    throw new Error('NotAllowedError')
  },
})
threw = false
try {
  await badge.setAppBadgeCount(7, A)
} catch {
  threw = true
}
check(!threw, '   a refused call (app not installed) is swallowed')

let retried = 0
installNavigator({ setAppBadge: async () => (retried += 1), clearAppBadge: async () => {} })
await badge.setAppBadgeCount(7, A)
check(retried === 1, '   and the next poll retries instead of treating it as applied')

// ---------------------------------------------------------------------------
section('Session lifecycle')

await reset()
await badge.setAppBadgeCount(4, A)
check(calls[0]?.[1] === 4, '5. sign-in: the first count for a user is applied')

calls.length = 0
await badge.clearAppBadge()
check(calls.length === 1 && calls[0][0] === 'clear', '6. sign-out clears the badge')

await reset()
await badge.setAppBadgeCount(3, A)
calls.length = 0
await badge.setAppBadgeCount(2, A)
check(calls[0]?.[1] === 2, '7. marking one read lowers the badge')

calls.length = 0
await badge.setAppBadgeCount(0, A)
check(calls[0]?.[0] === 'clear', '8. marking all read clears it')

await reset()
await badge.setAppBadgeCount(3, A)
calls.length = 0
await badge.setAppBadgeCount(3, B)
check(
  calls.length === 1 && calls[0][1] === 3,
  "9. user B's equal count is applied, not skipped as A's duplicate",
)

await reset()
await badge.setAppBadgeCount(5, A)
await badge.clearAppBadge()
calls.length = 0
await badge.setAppBadgeCount(1, B)
check(calls.length === 1 && calls[0][1] === 1, '   after A signs out, B starts from their own count')

await reset()
for (let i = 0; i < 10; i += 1) await badge.setAppBadgeCount(2, A)
check(calls.length === 1, '10. ten identical polls produce one OS update', `${calls.length}`)

// ---------------------------------------------------------------------------
section('Wiring')

const strip = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')

const bell = strip(read('src/components/layout/NotificationBell.jsx'))
check(bell.includes('setAppBadgeCount(unreadCount, ownerId)'), 'the bell feeds its unread count')
check(
  bell.includes('data.ownerId === ownerId'),
  'only for a response fetched for the signed-in user',
)
check(bell.includes('setAppBadgeCount(result.unreadCount, ownerId)'), 'mark-read applies the returned count')
check(bell.includes('setAppBadgeCount(0, ownerId)'), 'mark-all-read clears it at once')

const auth = strip(read('src/context/AuthProvider.jsx'))
check(auth.includes('clearAppBadge()'), 'the auth provider clears on sign-out and account change')
check(
  auth.includes('requestStatus === REQUEST_STATUS.SUCCESS && !currentUserId'),
  'an unreachable API is not mistaken for a sign-out',
)

// ---------------------------------------------------------------------------
section('Nothing else changed')

check(bell.includes('const POLL_INTERVAL_MS = 30 * 1000'), '11. the bell still polls every 30 s')
check(
  (bell.match(/useApiResource\(/g) ?? []).length === 1,
  '   through one resource — no second fetch loop',
)
check(
  ['markNotificationRead', 'markAllNotificationsRead', 'dismissNotification', 'navigate('].every((s) =>
    bell.includes(s),
  ),
  '   open, mark-read, mark-all and dismiss are all still present',
)

const badgeSource = strip(read('src/pwa/appBadge.js'))
check(
  !/setInterval|setTimeout|fetch\(|httpClient|axios|addEventListener/.test(badgeSource),
  '14. the badge module has no timer, request or listener of its own',
)
check(!/setInterval/.test(auth), '   the auth provider gained no interval')

const sw = read('public/sw.js')
check(!/badge/i.test(sw), '12. the service worker was not touched for this')
check(sw.includes("url.pathname.startsWith('/api')) return"), '13. its /api exclusion is intact')

await server.close()

console.log(`\n${failures === 0 ? `ALL ${checks} CHECKS PASSED` : `${failures} of ${checks} FAILED`}`)
process.exit(failures === 0 ? 0 : 1)
