/**
 * Verifies the User Panel / Admin Panel access matrix.
 *
 * Runs the real `routes/landing.js` through Vite's SSR pipeline, so the `@/`
 * aliases and the actual `ROUTE_PATHS` / `ADMIN_PATHS` constants resolve exactly
 * as they do in the browser. Nothing here reimplements the rule — a test that
 * restates the logic it is checking proves only that it can copy.
 *
 * ## Safety
 *
 * No MongoDB connection, no network request, no production data, no writes of
 * any kind. This loads two constant modules and one pure function.
 *
 *     node scripts/verify-panel-access.mjs
 */

import { createServer } from 'vite'

let failures = 0
let checks = 0

const check = (ok, label, detail = '') => {
  checks += 1
  if (!ok) failures += 1
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`)
}

const section = (title) => console.log(`\n=== ${title} ===`)

const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
})

const { resolveLanding, hasUserPanelAccess } = await server.ssrLoadModule('/src/routes/landing.js')
const { ROUTE_PATHS } = await server.ssrLoadModule('/src/routes/paths.js')
const { ADMIN_PATHS } = await server.ssrLoadModule('/src/admin/routes/adminPaths.js')

const CRM = ROUTE_PATHS.DASHBOARD
const ADMIN = ADMIN_PATHS.ROOT
const NONE = ROUTE_PATHS.NO_ACCESS

/** A user document shaped like `/auth/status` returns it. */
const user = (role, userPanelAccess) =>
  userPanelAccess === undefined ? { role } : { role, userPanelAccess }

// ---------------------------------------------------------------------------

section('1. THE SIX CASES FROM THE BRIEF')

check(
  resolveLanding({ user: user('owner', false), hasAdminAccess: true }) === ADMIN,
  'A. Owner, CRM off → Admin Panel',
)
check(
  resolveLanding({ user: user('owner', true), hasAdminAccess: true }) === ADMIN,
  'B. Owner, CRM on → still Admin Panel (the flag does not move their default)',
)
check(
  resolveLanding({ user: user('sales', true), hasAdminAccess: false }) === CRM,
  'C. Normal user, CRM on, no admin permission → User Panel',
)
check(
  resolveLanding({ user: user('manager', true), hasAdminAccess: true }) === CRM,
  'D. Normal user, CRM on, has admin permission → User Panel, not Admin',
)
check(
  resolveLanding({ user: user('manager', false), hasAdminAccess: true }) === ADMIN,
  'F. Normal user, CRM off, has admin permission → Admin Panel',
)
check(
  resolveLanding({ user: user('sales', false), hasAdminAccess: false }) === NONE,
  'E. Normal user, CRM off, no admin permission → stable no-access page',
)

section('2. NO REDIRECT LOOP IS POSSIBLE')

const destinations = new Set()
for (const role of ['owner', 'admin', 'manager', 'sales', 'support', 'viewer', 'member']) {
  for (const access of [true, false, undefined]) {
    for (const admin of [true, false]) {
      destinations.add(resolveLanding({ user: user(role, access), hasAdminAccess: admin }))
    }
  }
}

check(
  [...destinations].every((path) => [CRM, ADMIN, NONE].includes(path)),
  'every combination lands on one of three terminal destinations',
  [...destinations].join(', '),
)
check(
  !destinations.has(ROUTE_PATHS.LOGIN) && !destinations.has(ROUTE_PATHS.ROOT),
  'no combination routes back to /login or / — the two that would bounce',
)
check(
  resolveLanding({ user: user('sales', false), hasAdminAccess: false }) !== CRM,
  'the refused case never returns the route that just refused it',
)

section('3. BACKWARD COMPATIBILITY — THE FIELD IS ABSENT')

check(hasUserPanelAccess({ role: 'manager' }) === true, 'a document with no field reads as permitted')
check(hasUserPanelAccess({ role: 'owner' }) === true, 'including an owner’s')
check(hasUserPanelAccess({ role: 'sales', userPanelAccess: undefined }) === true, 'explicit undefined too')
check(hasUserPanelAccess(null) === true, 'a null user does not throw and does not refuse')
check(hasUserPanelAccess({ userPanelAccess: false }) === false, 'only an explicit false revokes')

check(
  resolveLanding({ user: user('manager', undefined), hasAdminAccess: true }) === CRM,
  'an existing manager with no field still lands on the CRM — unchanged behaviour',
)

section('4. THE TWO SYSTEMS STAY INDEPENDENT')

check(
  resolveLanding({ user: user('sales', true), hasAdminAccess: false }) !== ADMIN,
  'CRM access alone never opens the Admin Panel',
)
check(
  resolveLanding({ user: user('viewer', true), hasAdminAccess: false }) === CRM,
  'a viewer with CRM access gets the CRM and nothing more',
)
check(
  resolveLanding({ user: user('owner', true), hasAdminAccess: false }) === CRM,
  'an owner whose permissions do not open the console is not sent to a door that would refuse them',
)
check(
  resolveLanding({ user: user('manager', false), hasAdminAccess: false }) === NONE,
  'revoking the CRM grants no administrative capability as a side effect',
)

section('5. THE OWNER RULE IS A PREFERENCE, NOT A GRANT')

check(
  resolveLanding({ user: user('owner', false), hasAdminAccess: false }) === NONE,
  'being owner does not itself open the console — permissions still decide',
)
check(
  resolveLanding({ user: user('admin', true), hasAdminAccess: true }) === CRM,
  'only the owner role prefers the console; an admin still works in the CRM',
)

// ---------------------------------------------------------------------------

await server.close()

console.log(`\n${failures === 0 ? `ALL ${checks} CHECKS PASSED` : `${failures} of ${checks} FAILED`}`)
process.exit(failures === 0 ? 0 : 1)
