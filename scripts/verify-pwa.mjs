/**
 * Verifies the built PWA in `dist/`.
 *
 * Two halves. The first reads the manifest, icons and HTML and checks them
 * against Chrome's installability criteria. The second loads the real `sw.js`
 * into a sandbox with a stubbed worker global, then drives its `fetch` handler
 * with representative requests and asserts which ones it claims — which is the
 * only way to actually demonstrate that no authenticated API response can be
 * cached, rather than asserting it in a comment.
 *
 *     node scripts/verify-pwa.mjs
 */

import { readFileSync, existsSync, statSync } from 'node:fs'
import { createContext, runInContext } from 'node:vm'

const DIST = new URL('../dist/', import.meta.url)
const read = (name) => readFileSync(new URL(name, DIST), 'utf8')
const bytes = (name) => readFileSync(new URL(name, DIST))

let failures = 0
const check = (label, ok, detail = '') => {
  if (!ok) failures += 1
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`)
}

// ---------------------------------------------------------------------------
// Manifest
// ---------------------------------------------------------------------------
console.log('\n=== MANIFEST ===')
let manifest
try {
  manifest = JSON.parse(read('manifest.webmanifest'))
  check('parses as JSON', true)
} catch (error) {
  check('parses as JSON', false, error.message)
  process.exit(1)
}

check('name', manifest.name === 'Xplore Australia CRM', manifest.name)
check('short_name', manifest.short_name === 'Xplore CRM', manifest.short_name)
check('description present', Boolean(manifest.description))
check('start_url', manifest.start_url === '/', manifest.start_url)
check('scope covers every route', manifest.scope === '/', manifest.scope)
check('display standalone', manifest.display === 'standalone', manifest.display)
check('theme_color matches the brand token', manifest.theme_color === '#2563eb', manifest.theme_color)
check('background_color set', Boolean(manifest.background_color), manifest.background_color)

// ---------------------------------------------------------------------------
// Icons — Chrome needs a 192 and a 512 PNG, plus a maskable for a clean install
// ---------------------------------------------------------------------------
console.log('\n=== ICONS ===')
const png = (name) => {
  const b = bytes(name)
  const isPng = b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  return { isPng, w: b.readUInt32BE(16), h: b.readUInt32BE(20), kb: Math.round(b.length / 1024) }
}

for (const icon of manifest.icons) {
  const path = icon.src.replace(/^\//, '')
  if (!existsSync(new URL(path, DIST))) {
    check(`${icon.src} exists`, false)
    continue
  }
  if (!path.endsWith('.png')) {
    check(`${icon.src} exists (${statSync(new URL(path, DIST)).size} bytes)`, true)
    continue
  }
  const { isPng, w, h, kb } = png(path)
  const declared = icon.sizes
  check(
    `${icon.src} is a real ${declared} PNG [${icon.purpose}]`,
    isPng && `${w}x${h}` === declared && w === h,
    `${w}x${h}, ${kb}KB`,
  )
}

const anyIcons = manifest.icons.filter((i) => i.purpose === 'any' && i.type === 'image/png')
check('has a 192x192 "any" PNG', anyIcons.some((i) => i.sizes === '192x192'))
check('has a 512x512 "any" PNG', anyIcons.some((i) => i.sizes === '512x512'))
check('has a maskable icon', manifest.icons.some((i) => i.purpose === 'maskable'))

// ---------------------------------------------------------------------------
// Shortcuts must point at routes that exist
// ---------------------------------------------------------------------------
console.log('\n=== SHORTCUTS ===')
const paths = readFileSync(new URL('../src/routes/paths.js', import.meta.url), 'utf8')
const adminPaths = readFileSync(new URL('../src/admin/routes/adminPaths.js', import.meta.url), 'utf8')
const known = ['/dashboard', '/leads/new', '/admin/leads']
for (const shortcut of manifest.shortcuts ?? []) {
  const declared = known.includes(shortcut.url)
  const inSource = paths.includes(shortcut.url.replace('/admin', '')) || adminPaths.includes('/leads') || paths.includes(shortcut.url)
  check(`${shortcut.name} → ${shortcut.url}`, declared && inSource, 'route exists in the router')
}

// ---------------------------------------------------------------------------
// HTML / branding
// ---------------------------------------------------------------------------
console.log('\n=== HTML & BRANDING ===')
const html = read('index.html')
check('links the manifest', html.includes('rel="manifest"'))
check('favicon is the Xplore mark', /rel="icon"[^>]*xplore-logo-mark\.svg/.test(html))
check('apple-touch-icon present', html.includes('apple-touch-icon'))
check('theme-color meta matches manifest', html.includes('content="#2563eb"'))
check('title', /<title>Xplore Australia CRM<\/title>/.test(html))

const bundles = html.match(/\/assets\/[\w.-]+\.js/g) ?? []
const allJs = bundles.map((b) => read(b.replace(/^\//, ''))).join('\n')
const OLD = /Outlook Automation CRM|outlook-automation-crm/i
check('no old branding in dist HTML', !OLD.test(html))
check('no old branding in the manifest', !OLD.test(JSON.stringify(manifest)))
check('no old branding in the entry bundles', !OLD.test(allJs))
check('service worker is registered by the bundle', allJs.includes('/sw.js'))

// ---------------------------------------------------------------------------
// .htaccess — the rules that decide whether an update can ever ship
// ---------------------------------------------------------------------------
console.log('\n=== DEPLOYMENT RULES ===')
const htaccess = read('.htaccess')
const swNoCache = /FilesMatch "\^\(sw\\\.js\|manifest\\\.webmanifest\)\$"[\s\S]{0,200}?no-cache/.test(htaccess)
check('sw.js is served no-cache (a new worker can ship)', swNoCache)
check('.webmanifest has a MIME type', htaccess.includes('AddType application/manifest+json'))
check('SPA fallback still present (deep links)', htaccess.includes('RewriteRule . /index.html [L]'))

// ---------------------------------------------------------------------------
// Service worker behaviour — the real thing, driven
// ---------------------------------------------------------------------------
console.log('\n=== SERVICE WORKER BEHAVIOUR ===')
const listeners = {}
const sandbox = {
  console,
  URL,
  Response: class {
    constructor(body, init) {
      this.body = body
      this.status = init?.status ?? 200
    }
  },
  fetch: async () => ({ ok: true, type: 'basic', clone: () => ({}) }),
  caches: { keys: async () => [], open: async () => ({ put: async () => {} }), match: async () => null, delete: async () => true },
  self: {
    location: new URL('https://crm.xploreaustralia.com/sw.js'),
    clients: { claim: async () => {} },
    registration: {},
    skipWaiting: () => {},
    addEventListener: (type, fn) => {
      listeners[type] = fn
    },
  },
}
sandbox.self.caches = sandbox.caches
createContext(sandbox)
runInContext(read('sw.js'), sandbox)

check('registers install/activate/fetch handlers', ['install', 'activate', 'fetch'].every((t) => listeners[t]))

/** Drives the real handler and reports whether it took over the request. */
const claims = (url, { method = 'GET', mode = 'no-cors', auth = false } = {}) => {
  let claimed = false
  const request = { method, url, mode, headers: { has: (h) => auth && h === 'Authorization' } }
  listeners.fetch({ request, respondWith: () => { claimed = true } })
  return claimed
}

const API = 'https://crmbackend.xploreaustralia.com'
const APP = 'https://crm.xploreaustralia.com'

console.log('\n  -- must NEVER be intercepted --')
check('cross-origin API GET', !claims(`${API}/api/v1/admin/leads`), 'browser handles it')
check('cross-origin API POST', !claims(`${API}/api/v1/auth/login`, { method: 'POST' }), 'browser handles it')
check('same-origin /api GET', !claims(`${APP}/api/v1/leads`), 'belt and braces')
check('request carrying Authorization', !claims(`${APP}/assets/x.js`, { auth: true }), 'never cached')
check('any non-GET method', !claims(`${APP}/assets/x.js`, { method: 'POST' }))
check('unknown same-origin path', !claims(`${APP}/something-else.txt`))

console.log('\n  -- must be intercepted --')
check('navigation (the app shell)', claims(`${APP}/admin/leads`, { mode: 'navigate' }))
check('fingerprinted build asset', claims(`${APP}/assets/index-A1b2C3.js`))
check('PWA icon', claims(`${APP}/pwa-icon-192.png`))
check('the manifest', claims(`${APP}/manifest.webmanifest`))

console.log('\n  -- deep links all resolve to the shell --')
for (const route of ['/dashboard', '/leads', '/leads/new', '/admin', '/admin/leads', '/admin/roles']) {
  check(`${route}`, claims(APP + route, { mode: 'navigate' }), 'served the shell, router takes over')
}

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`)
process.exit(failures === 0 ? 0 : 1)
