/**
 * Warms the route chunks that have to survive a cold offline start.
 *
 * ## Why the client does this and not the worker
 *
 * `sw.js` cannot precache a route chunk: Vite fingerprints it
 * (`LeadCreatePage-Cs1etOxv.js`) and the worker has no way to learn that name —
 * `index.html` does not reference lazy chunks, only the entry bundle. But the
 * client already knows how to name it, because the router imports it by module
 * path and the bundler rewrites that to the hashed URL.
 *
 * So this performs the ordinary dynamic import the router would perform, early.
 * The request goes through the worker's existing static-asset branch and lands
 * in `ASSET_CACHE` exactly as a real visit would. **No new cache, no second
 * caching strategy, and no change to `sw.js` was needed for this half.**
 *
 * ## Why only Lead Create
 *
 * It is the one route the field team opens with no connection — a lead taken on
 * a phone call from a train. The other 123 chunks stay on demand: precaching
 * 1.4 MB to serve routes nobody opens offline would make every install slower
 * to solve a problem that does not exist.
 *
 * Adding a route here is one line, and the cost is that chunk's size. It should
 * stay a short list of things genuinely used offline, not a mirror of the
 * router.
 *
 * ## What this deliberately does not do
 *
 * No polling, no interval, no retry loop. It runs at most once per page load,
 * skips entirely when the browser reports no connection, and swallows failures
 * — a chunk that did not warm is simply fetched on demand later, which is the
 * behaviour that exists today.
 */

/**
 * The routes worth having before the connection drops.
 *
 * Written as import thunks so the bundler sees a static module specifier and
 * emits the same chunk the router points at. A computed path would defeat that
 * and fetch nothing.
 */
const OFFLINE_ROUTES = [() => import('@/pages/leads/LeadCreatePage')]

/** Once per page load. A second call is a no-op rather than a second download. */
let started = false

/** How long to wait for an idle moment before warming anyway. */
const IDLE_TIMEOUT_MS = 10_000

/** Fallback delay where `requestIdleCallback` is unavailable (Safari). */
const FALLBACK_DELAY_MS = 3_000

/**
 * Fetches the offline-critical chunks into the worker's asset cache.
 *
 * Call after the worker is controlling the page — before that, the request
 * bypasses the worker entirely and nothing is cached.
 */
export function prefetchOfflineRoutes() {
  if (started) return
  started = true

  // Offline already: the fetch would fail and cache nothing. Not an error, and
  // not worth a console line — the chunk loads on demand when the connection
  // returns, exactly as it does today.
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return

  const warm = () => {
    for (const load of OFFLINE_ROUTES) {
      // Failure is the status quo, never a regression: an unwarmed chunk is
      // fetched on demand. Swallowed so a prefetch can never surface as an
      // error in a session that is working perfectly well.
      load().catch(() => {})
    }
  }

  /*
   * Idle, so this never competes with the first paint or the coordinator's
   * opening sync. The timeout bounds the wait — a busy tab still warms rather
   * than deferring forever.
   */
  if (typeof globalThis.requestIdleCallback === 'function') {
    globalThis.requestIdleCallback(warm, { timeout: IDLE_TIMEOUT_MS })
  } else {
    setTimeout(warm, FALLBACK_DELAY_MS)
  }
}

export default prefetchOfflineRoutes
