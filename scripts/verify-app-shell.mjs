/**
 * The app shell and the cold-offline start.
 *
 * Loads the real `public/sw.js` into a miniature service-worker harness — a
 * fake `self`, a fake Cache Storage, a controllable `fetch` — and drives its
 * actual `install`, `activate` and `fetch` handlers. Nothing here restates the
 * worker's logic; the worker's own code runs.
 *
 * ## What this proves and what it does not
 *
 * It proves the handlers' behaviour: what installs, what is cached, what is
 * refused, and that no path can reject unhandled. It cannot prove that a real
 * browser registers the worker, that a WebView supports one, or that the OS
 * did not evict the cache. Those need a device and are reported as unverified.
 *
 * ## Safety
 *
 * No MongoDB, no network, no production data, no writes to the repository.
 *
 *     node scripts/verify-app-shell.mjs
 */

import { readFileSync } from 'node:fs'
import vm from 'node:vm'

let failures = 0
let checks = 0

const check = (ok, label, detail = '') => {
  checks += 1
  if (!ok) failures += 1
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`)
}

const section = (title) => console.log(`\n=== ${title} ===`)

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const SW_SOURCE = read('public/sw.js')

const ORIGIN = 'https://crm.xploreaustralia.com'

/** A Response stand-in with only the fields the worker touches. */
class FakeResponse {
  constructor(body = '', { status = 200, type = 'basic', headers = {} } = {}) {
    this.body = body
    this.status = status
    this.ok = status >= 200 && status < 300
    this.type = type
    this.statusText = ''
    this.headers = new Map(Object.entries(headers))
  }

  clone() {
    return new FakeResponse(this.body, { status: this.status, type: this.type })
  }

  /** The install parser reads the shell from the response already in hand. */
  async text() {
    return String(this.body)
  }
}

/** Cache Storage, faithful to the bits the worker uses. */
function makeCaches(stores = new Map()) {

  const keyOf = (request) =>
    typeof request === 'string' ? new URL(request, ORIGIN).href : request.url

  return {
    stores,
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map())
      const store = stores.get(name)
      return {
        put: async (request, response) => void store.set(keyOf(request), response),
        match: async (request) => store.get(keyOf(request)),
      }
    },
    async keys() {
      return [...stores.keys()]
    },
    async delete(name) {
      return stores.delete(name)
    },
    async match(request) {
      for (const store of stores.values()) {
        const hit = store.get(keyOf(request))
        if (hit) return hit
      }
      return undefined
    },
  }
}

/**
 * Boots the worker.
 *
 * @param {(url: string) => Promise<FakeResponse>} fetchImpl
 * @param {Map<string, Map<string, FakeResponse>>} [stores]
 *   Pre-seeded cache contents, so a second worker can be booted against the
 *   caches a first one filled. Passed in rather than assigned afterwards
 *   because `makeCaches` closes over the map — reassigning the property would
 *   leave `open`/`match` still reading the original.
 */
function bootWorker(fetchImpl, stores) {
  const listeners = {}
  const cacheStorage = makeCaches(stores)
  const claimed = { count: 0 }

  const self_ = {
    addEventListener: (type, handler) => void (listeners[type] = handler),
    location: { origin: ORIGIN },
    clients: { claim: async () => void (claimed.count += 1) },
    registration: {},
    skipWaiting: () => {
      throw new Error('skipWaiting() must never be called automatically')
    },
  }

  const context = {
    self: self_,
    caches: cacheStorage,
    fetch: fetchImpl,
    URL,
    Response: FakeResponse,
    console,
  }
  context.globalThis = context

  vm.createContext(context)
  vm.runInContext(SW_SOURCE, context)

  /** Runs a handler and resolves whatever it passed to waitUntil/respondWith. */
  const dispatch = async (type, event = {}) => {
    let waited = null
    let responded = null

    const e = {
      ...event,
      waitUntil: (promise) => void (waited = promise),
      respondWith: (promise) => void (responded = promise),
    }

    listeners[type]?.(e)

    if (waited) await waited
    return responded ? await responded : undefined
  }

  return { dispatch, cacheStorage, claimed, listeners, self: self_ }
}

const request = (path, extra = {}) => ({
  method: 'GET',
  url: path.startsWith('http') ? path : `${ORIGIN}${path}`,
  mode: 'no-cors',
  headers: { has: () => false },
  ...extra,
})

/**
 * A shell that references assets, as the real build's does.
 *
 * The previous stub returned a body with no markup, so nothing could be
 * discovered from it and the precache step had nothing to find.
 */
const SHELL_HTML = [
  '<!doctype html><html><head>',
  '<script type="module" crossorigin src="/assets/index-AAA111.js"></script>',
  '<link rel="modulepreload" crossorigin href="/assets/jsx-runtime-BBB222.js">',
  '<link rel="stylesheet" crossorigin href="/assets/index-CCC333.css">',
  '<link rel="icon" href="/xplore-logo-mark.svg?v=2">',
  '</head><body><div id="root"></div></body></html>',
].join('')

const online = async (url) =>
  new FakeResponse(String(url).includes('/index.html') ? SHELL_HTML : `body:${url}`)
const offline = async () => {
  throw new TypeError('Failed to fetch')
}

// ---------------------------------------------------------------------------
section('1. INSTALL PRECACHES THE APP SHELL')

{
  const w = bootWorker(online)
  await w.dispatch('install')

  const shell = await w.cacheStorage.match('/index.html')
  check(Boolean(shell), 'install stores /index.html in the shell cache')
  check(
    [...w.cacheStorage.stores.keys()].some((k) => k.startsWith('xplore-shell-')),
    'under a VERSION-scoped shell cache',
    [...w.cacheStorage.stores.keys()].join(', '),
  )

  /*
   * The gap that made a single online visit insufficient.
   *
   * Registration happens on `window.load`, after every subresource has already
   * downloaded outside this worker — so the entry bundle and stylesheet could
   * never reach the asset cache on a first visit. A served shell with nothing
   * to run in it renders a blank page.
   */
  const assets = [...w.cacheStorage.stores.entries()]
    .filter(([name]) => name.startsWith('xplore-assets-'))
    .flatMap(([, store]) => [...store.keys()])

  check(
    assets.some((u) => u.endsWith('/assets/index-AAA111.js')),
    'the entry bundle named by the shell is precached',
  )
  check(
    assets.some((u) => u.endsWith('/assets/index-CCC333.css')),
    'and the stylesheet',
  )
  check(
    assets.some((u) => u.endsWith('/assets/jsx-runtime-BBB222.js')),
    'and every modulepreload the shell declares',
  )
  check(assets.length === 3, 'exactly the three /assets/ URLs in the HTML', `${assets.length} cached`)

  check(
    !assets.some((u) => u.includes('xplore-logo-mark')),
    'a non-/assets/ reference is not swept in',
  )
  check(
    !assets.some((u) => u.includes('LeadCreatePage')),
    'and no route chunk is discovered — nothing follows imports',
  )
}

{
  // A single failing asset must not fail the install.
  const w = bootWorker(async (url) => {
    if (String(url).includes('/index.html')) return new FakeResponse(SHELL_HTML)
    if (String(url).includes('index-AAA111')) throw new TypeError('Failed to fetch')
    return new FakeResponse(`body:${url}`)
  })

  let threw = false
  try {
    await w.dispatch('install')
  } catch {
    threw = true
  }

  check(!threw, 'one asset failing does not reject the install')
  check(Boolean(await w.cacheStorage.match('/index.html')), 'the shell is still cached')

  const partial = [...w.cacheStorage.stores.entries()]
    .filter(([name]) => name.startsWith('xplore-assets-'))
    .flatMap(([, store]) => [...store.keys()])
  check(partial.length === 2, 'and the assets that did succeed are kept', `${partial.length} cached`)
}

{
  // Installing with no network must not reject: it simply caches nothing.
  const w = bootWorker(offline)
  let threw = false
  try {
    await w.dispatch('install')
  } catch {
    threw = true
  }
  check(!threw, 'installing while offline does not reject — it degrades to the old behaviour')
  const shell = await w.cacheStorage.match('/index.html')
  check(!shell, 'and stores nothing, so nothing false is served later')
}

section('2. NAVIGATION FALLS BACK TO THE CACHED SHELL')

{
  const w = bootWorker(online)
  await w.dispatch('install')

  // Now the network dies, but the caches survive — the real cold-start case.
  const w2 = bootWorker(offline, w.cacheStorage.stores)

  const response = await w2.dispatch('fetch', {
    request: request('/leads/new', { mode: 'navigate' }),
  })

  check(Boolean(response), 'an offline navigation is answered by the worker')
  check(response?.status === 200, 'with the cached shell, not an error', `status ${response?.status}`)
  check(
    String(response?.body).includes('<div id="root">'),
    'and it is genuinely the shell, not a placeholder',
  )
  check(
    String(response?.body).includes('/assets/index-AAA111.js'),
    'still naming the entry bundle that was precached alongside it',
  )
}

{
  // No shell and no network: the worker's own page, never an unhandled throw.
  const w = bootWorker(offline)
  const response = await w.dispatch('fetch', {
    request: request('/dashboard', { mode: 'navigate' }),
  })
  check(response?.status === 503, 'with no shell cached, a navigation gets a 503, not a rejection')
  check(String(response?.body).includes('No connection'), 'carrying the worker’s own message')
}

section('3. THE ASSET BRANCH CANNOT REJECT UNHANDLED')

{
  const w = bootWorker(offline)
  let rejected = false
  let response

  try {
    response = await w.dispatch('fetch', {
      request: request('/assets/LeadCreatePage-Cs1etOxv.js'),
    })
  } catch {
    rejected = true
  }

  check(!rejected, 'an uncached chunk fetched offline does NOT reject — the defect that broke Lead Create')
  check(response?.status === 503, 'it resolves to a clean 503', `status ${response?.status}`)
  check(
    response?.headers?.get('Cache-Control') === 'no-store',
    'and the 503 is never stored, so it cannot outlive the outage',
  )
}

{
  const w = bootWorker(online)
  const first = await w.dispatch('fetch', { request: request('/assets/index-abc123.js') })
  check(first?.status === 200, 'online, an asset is fetched and returned')

  let cached
  for (const [name, store] of w.cacheStorage.stores) {
    if (name.startsWith('xplore-assets-')) cached = store.get(`${ORIGIN}/assets/index-abc123.js`)
  }
  check(Boolean(cached), 'and stored in the asset cache')

  // Cached assets are served without touching the network.
  const w2 = bootWorker(offline, w.cacheStorage.stores)
  const second = await w2.dispatch('fetch', { request: request('/assets/index-abc123.js') })
  check(second?.status === 200, 'a cached asset is served offline, unchanged behaviour')
}

section('4. THE SAFETY EXCLUSIONS ARE UNTOUCHED')

{
  const w = bootWorker(online)

  const cases = [
    ['/api/v1/leads', {}, '/api is never handled'],
    ['/api/v1/health', {}, 'nor any other /api path'],
    ['/dashboard', { method: 'POST' }, 'a non-GET is never handled'],
    ['https://crmbackend.xploreaustralia.com/api/v1/health', {}, 'cross-origin is never handled'],
  ]

  for (const [path, extra, label] of cases) {
    const response = await w.dispatch('fetch', { request: request(path, extra) })
    check(response === undefined, label)
  }

  const authed = await w.dispatch('fetch', {
    request: request('/assets/index-abc.js', { headers: { has: (h) => h === 'Authorization' } }),
  })
  check(authed === undefined, 'a request carrying Authorization is never handled')
}

{
  // An opaque cross-origin reply must never be stored.
  const w = bootWorker(async () => new FakeResponse('', { status: 0, type: 'opaque' }))
  await w.dispatch('fetch', { request: request('/assets/opaque.js') })

  let stored = 0
  for (const [name, store] of w.cacheStorage.stores) {
    if (name.startsWith('xplore-assets-')) stored += store.size
  }
  check(stored === 0, 'an opaque response is never cached')
}

{
  const w = bootWorker(async () => new FakeResponse('nope', { status: 404 }))
  await w.dispatch('fetch', { request: request('/assets/missing.js') })

  let stored = 0
  for (const [name, store] of w.cacheStorage.stores) {
    if (name.startsWith('xplore-assets-')) stored += store.size
  }
  check(stored === 0, 'a non-ok response is never cached')
}

section('5. VERSION CLEANUP AND UPDATE SAFETY')

{
  const w = bootWorker(online)
  const stale = await w.cacheStorage.open('xplore-shell-v0')
  await stale.put('/index.html', new FakeResponse('old'))
  await (await w.cacheStorage.open('unrelated-cache')).put('/x', new FakeResponse('keep'))

  await w.dispatch('activate')

  check(!w.cacheStorage.stores.has('xplore-shell-v0'), 'activate deletes stale xplore-* caches')
  check(w.cacheStorage.stores.has('unrelated-cache'), 'and leaves caches it does not own alone')
  check(w.claimed.count === 1, 'and claims existing clients exactly once')
}

{
  const code = SW_SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
  check(
    !/self\.skipWaiting\(\)/.test(code.replace(/if \(event\.data === 'SKIP_WAITING'\) self\.skipWaiting\(\)/, '')),
    'skipWaiting() is called from nowhere except the pre-existing opt-in message handler',
  )
  check(
    code.includes("event.data === 'SKIP_WAITING'"),
    'and that handler is preserved, unmodified',
  )
  check(!code.includes('skipWaiting()\n'), 'install never calls it')
}

section('6. LEAD CREATE IS WARMED BY THE CLIENT, NOT PRECACHED')

{
  const prefetch = read('src/pwa/prefetchOfflineRoutes.js')
  const register = read('src/pwa/registerServiceWorker.js')

  check(
    prefetch.includes("import('@/pages/leads/LeadCreatePage')"),
    'the Lead Create chunk is warmed by a real dynamic import',
  )
  check(
    (prefetch.match(/\(\) => import\(/g) ?? []).length === 1,
    'exactly one route is warmed — not all 124 chunks',
  )
  check(prefetch.includes('navigator.onLine === false'), 'and it skips entirely when already offline')
  check(!prefetch.includes('setInterval'), 'no interval')
  check(!/fetch\(/.test(prefetch), 'no bespoke fetch — it reuses the worker’s existing asset branch')
  check(
    register.includes('navigator.serviceWorker.ready.then(prefetchOfflineRoutes)'),
    'warming waits for the worker to control the page, or it would cache nothing',
  )
  check(!SW_SOURCE.includes('LeadCreatePage'), 'sw.js does not name the chunk — it cannot know the hash')
}

// ---------------------------------------------------------------------------

console.log(`\n${failures === 0 ? `ALL ${checks} CHECKS PASSED` : `${failures} of ${checks} FAILED`}`)
process.exit(failures === 0 ? 0 : 1)
