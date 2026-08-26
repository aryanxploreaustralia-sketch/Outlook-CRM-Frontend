/*
 * Service worker for the Xplore Australia CRM.
 *
 * ## What this is for, and what it is not for
 *
 * Installability and fast repeat loads. It is **not** an offline CRM: every
 * figure on every screen comes from a live API, and a cached answer to "how
 * many leads are unassigned" is worse than no answer at all. Nothing dynamic is
 * ever stored here.
 *
 * ## The safety rule, stated once
 *
 * This worker only ever touches **same-origin GET requests for fingerprinted
 * static assets and the app shell**. Everything else — every method that is not
 * GET, every cross-origin request, anything under `/api`, and anything carrying
 * an Authorization header — falls through untouched, which means the browser
 * handles it exactly as it would with no worker installed.
 *
 * The API is a different origin in this deployment
 * (crmbackend.xploreaustralia.com), so the origin check alone already excludes
 * all of it. The `/api` and Authorization checks are belt and braces: they keep
 * the guarantee true if the API is ever moved behind the same host.
 *
 * ## Why there is no precache manifest
 *
 * Vite fingerprints every asset, so an asset's contents cannot change without
 * its URL changing. That makes a cache keyed on URL self-invalidating: a new
 * build asks for `index-A1b2C3.js`, which is simply not in the cache, and is
 * fetched. No build-time manifest and no plugin are needed to get correctness,
 * which is why this is thirty lines of cache code rather than a dependency.
 *
 * ## Why navigations are network-first
 *
 * `index.html` is the one file whose name never changes, and it is the file
 * naming every fingerprinted asset. Served from cache it would pin the browser
 * to a previous deployment — the exact "stuck on an old version" failure. So it
 * is fetched from the network every time, and the cached copy is a fallback for
 * when the network is unreachable.
 *
 * ## Deploying a new worker
 *
 * `sw.js` is not fingerprinted, so `.htaccess` serves it `no-cache`. Without
 * that it would inherit the one-year immutable rule that covers `*.js` and
 * could never be replaced. That is also the kill switch: if this worker ever
 * misbehaves, replacing this file with one that calls
 * `self.registration.unregister()` reaches every client on their next visit.
 */

/** Bump to discard everything this worker has stored. */
const VERSION = 'v1'

const SHELL_CACHE = `xplore-shell-${VERSION}`
const ASSET_CACHE = `xplore-assets-${VERSION}`

/** The key the app shell is stored under, whatever path the reader asked for. */
const SHELL_KEY = '/index.html'

/**
 * Fingerprinted build output. Safe to cache indefinitely: the name changes
 * whenever the contents do.
 */
const isBuildAsset = (url) => url.pathname.startsWith('/assets/')

/**
 * The handful of static files referenced by name rather than by hash. They
 * change only when somebody replaces them deliberately, and `VERSION` above is
 * how that is published.
 */
const isStaticAsset = (url) =>
  url.pathname === '/manifest.webmanifest' ||
  url.pathname.startsWith('/pwa-icon-') ||
  url.pathname.startsWith('/xplore-logo-mark')

self.addEventListener('install', () => {
  /*
   * Nothing is precached.
   *
   * A precache list would have to name hashed files this worker cannot know,
   * and precaching the shell here would mean the very first visit pays for a
   * second download of what the page just loaded. The caches fill from real
   * traffic instead.
   *
   * `skipWaiting()` is deliberately NOT called. An updated worker taking over
   * a running tab can swap the caching strategy underneath a session that is
   * mid-edit; waiting for the tab to close costs nothing, because navigations
   * are network-first and the reader is already being served current HTML.
   */
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()

      await Promise.all(
        keys
          .filter((key) => key.startsWith('xplore-') && key !== SHELL_CACHE && key !== ASSET_CACHE)
          .map((key) => caches.delete(key)),
      )

      await self.clients.claim()
    })(),
  )
})

/** Stores a response only if it is one we are certain is complete and ours. */
async function put(cacheName, key, response) {
  // `type: 'opaque'` is a cross-origin response with a status of 0 — there is
  // no way to tell a success from a failure, so it is never stored.
  if (!response || !response.ok || response.type === 'opaque') return

  const cache = await caches.open(cacheName)
  await cache.put(key, response.clone())
}

self.addEventListener('fetch', (event) => {
  const { request } = event

  // --- Everything below this line is opted in, one condition at a time ------
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api')) return
  if (request.headers.has('Authorization')) return

  // --- The app shell -------------------------------------------------------
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request)
          await put(SHELL_CACHE, SHELL_KEY, response)
          return response
        } catch {
          const cached = await caches.match(SHELL_KEY)
          if (cached) return cached

          // No shell yet and no network. Say so plainly rather than showing the
          // browser's dinosaur, and do not pretend the CRM works offline.
          return new Response(
            '<!doctype html><meta charset="utf-8"><title>Offline</title>' +
              '<body style="font:16px system-ui;padding:2rem;color:#334155">' +
              '<h1 style="font-size:1.25rem">No connection</h1>' +
              '<p>Xplore Australia CRM needs a network connection. Reconnect and reload.</p>',
            { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
          )
        }
      })(),
    )
    return
  }

  // --- Static assets -------------------------------------------------------
  if (isBuildAsset(url) || isStaticAsset(url)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request)
        if (cached) return cached

        const response = await fetch(request)
        await put(ASSET_CACHE, request, response)
        return response
      })(),
    )
  }

  // Anything else: no `respondWith`, so the browser does what it always does.
})

/*
 * An escape hatch for a future update prompt.
 *
 * Nothing in the app sends this today — the app deliberately does not force a
 * reload on people mid-task. It exists so that adding a "Reload to update"
 * control later needs no change to the worker.
 */
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting()
})
