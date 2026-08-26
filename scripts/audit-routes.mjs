/**
 * READ-ONLY navigation audit.
 *
 * Every sidebar item must name a path that is declared and registered in the
 * router, or it is a menu entry leading to a blank screen.
 *
 *     node scripts/audit-routes.mjs
 */

import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const read = (p) => fs.readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8')
const readDir = (p) => {
  const dir = fileURLToPath(new URL(p, import.meta.url))
  return fs.readdirSync(dir).map((f) => fs.readFileSync(`${dir}/${f}`, 'utf8')).join('\n')
}

const navigation = read('../src/config/navigation.js')
const routePaths = read('../src/routes/paths.js')
const adminNavigation = read('../src/admin/constants/adminNavigation.js')
const adminPaths = read('../src/admin/routes/adminPaths.js')
const allRouters = readDir('../src/routes/') + '\n' + readDir('../src/admin/routes/')

let failures = 0

// --- User sidebar: paths are full constants, registered by constant ---------
console.log('\n=== USER SIDEBAR ===')
const userKeys = [...navigation.matchAll(/path: ROUTE_PATHS\.([A-Z_]+)/g)].map((m) => m[1])
for (const key of userKeys) {
  const declared = new RegExp(`^\\s*${key}:`, 'm').test(routePaths)
  const registered = new RegExp(`ROUTE_PATHS\\.${key}\\b`).test(allRouters)
  const ok = declared && registered
  if (!ok) failures += 1
  console.log(`  ${ok ? 'OK  ' : 'FAIL'}  ${key.padEnd(18)}${ok ? '' : `declared=${declared} registered=${registered}`}`)
}

/*
 * The admin router nests RELATIVE segments under `/admin` ('users', 'roles')
 * rather than repeating the ADMIN_PATHS constants, so searching for the
 * constant name finds nothing. Resolve each constant to its segment instead.
 */
console.log('\n=== ADMIN SIDEBAR ===')
const adminKeys = [...adminNavigation.matchAll(/path: ADMIN_PATHS\.([A-Z_]+)/g)].map((m) => m[1])
for (const key of adminKeys) {
  const found = new RegExp(`^\\s*${key}:.*$`, 'm').exec(adminPaths)
  let segment = null
  if (found) {
    const m = found[0].match(/ADMIN_ROOT\}\/?([a-z/:-]*)/)
    segment = m ? m[1] : ''
  }
  const isIndex = segment === ''
  const registered = isIndex
    ? /index: true/.test(allRouters)
    : new RegExp(`path: '${segment}'`).test(allRouters)
  const ok = Boolean(found) && registered
  if (!ok) failures += 1
  console.log(
    `  ${ok ? 'OK  ' : 'FAIL'}  ${key.padEnd(18)}` +
      `${isIndex ? '(index route)' : `-> path: '${segment}'`}${ok ? '' : '   NOT REGISTERED'}`,
  )
}

console.log('\n=== ADMIN SIDEBAR GROUP ORDER ===')
const order = [...adminNavigation.matchAll(/id: '(overview|monitoring|access|platform)'/g)].map((m) => m[1])
console.log('  ' + order.join(' -> '))
const monitoringFirst = order.indexOf('monitoring') < order.indexOf('access')
if (!monitoringFirst) failures += 1
console.log(`  ${monitoringFirst ? 'OK  ' : 'FAIL'}  Monitoring appears above Access control`)

console.log('\n=== EMPTY NAV SECTIONS ===')
const upcomingEmpty = /UPCOMING_NAV = Object\.freeze\(\[\]\)/.test(navigation)
console.log(`  ${upcomingEmpty ? 'OK  ' : 'note'}  "Coming soon" is empty and filtered out of the sidebar`)

console.log(`\nnav targets checked: ${userKeys.length + adminKeys.length} · broken: ${failures}`)
process.exit(failures === 0 ? 0 : 1)
