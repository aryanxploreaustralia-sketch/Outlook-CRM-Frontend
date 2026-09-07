/**
 * Registers the service worker, in production only.
 *
 * ## Why not in development
 *
 * Vite serves unbundled modules from memory and rewrites them on every save. A
 * worker caching that would fight hot reload and produce failures that exist
 * only on the developer's machine. `import.meta.env.PROD` is compiled to a
 * literal, so in a dev build the whole body is dead code and is dropped.
 *
 * ## Why nothing here can break the app
 *
 * Registration is fire-and-forget behind a `catch`. A worker that fails to
 * install, a browser that does not support them, an origin that is not secure —
 * each is a reason for the CRM to run exactly as it did before, never a reason
 * for it not to start. Nothing on this path is awaited by the bootstrap.
 */

/** Where the worker lives, and the scope it must control. */
const SCRIPT = '/sw.js'
const SCOPE = '/'

/**
 * Subscribers waiting to hear that a newer worker is ready.
 *
 * The same pub/sub shape `coordinator.js` uses for sync state, for the same
 * reason: this fires outside React, from a browser event, and the interface has
 * to be able to hear about it without this module importing anything from the
 * component tree.
 */
const updateListeners = new Set()

/** True once a newer worker has installed and is waiting to take over. */
let updateReady = false

function publishUpdate() {
  if (updateReady) return
  updateReady = true

  for (const listener of updateListeners) {
    // One bad subscriber must not stop the others hearing about it.
    try {
      listener(true)
    } catch {
      /* ignored */
    }
  }
}

/**
 * Notifies when a new version has installed and is waiting.
 *
 * Fires immediately if one is already waiting, so a component mounting after
 * the event still learns about it.
 *
 * @param {(ready: boolean) => void} listener
 * @returns {() => void} Unsubscribe.
 */
export function onUpdateAvailable(listener) {
  updateListeners.add(listener)
  if (updateReady) listener(true)

  return () => updateListeners.delete(listener)
}

/** Whether a newer worker is waiting right now. */
export const isUpdateReady = () => updateReady

/**
 * Watches one registration for a newer worker.
 *
 * ## `controller` is what separates an update from a first install
 *
 * On a first visit the worker also reaches `installed`, but nothing is
 * controlling the page yet and there is no old version to replace — announcing
 * "a new version is available" then would be nonsense. A controller being
 * present means this page is already being served by an older worker, which is
 * precisely the case worth reporting.
 *
 * ## Nothing here activates anything
 *
 * `skipWaiting()` is deliberately not called, matching `sw.js`, which documents
 * the same decision. An updated worker taking over mid-session would swap the
 * asset cache underneath a page that is still running — and could do it while
 * somebody is composing an email. The new version waits until the user chooses
 * to refresh.
 */
function watchForUpdate(registration) {
  // Already waiting when the page loaded — the update installed on a previous
  // visit and nobody has refreshed since.
  if (registration.waiting && navigator.serviceWorker.controller) {
    publishUpdate()
    return
  }

  registration.addEventListener('updatefound', () => {
    const installing = registration.installing
    if (!installing) return

    installing.addEventListener('statechange', () => {
      if (installing.state === 'installed' && navigator.serviceWorker.controller) {
        publishUpdate()
      }
    })
  })
}

export function registerServiceWorker() {
  if (!import.meta.env.PROD) return
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return

  /*
   * After `load`, not before.
   *
   * Registration competes with the page's own first requests for connections,
   * and the worker controls nothing on this visit anyway — it is preparing the
   * next one. Deferring it keeps first paint exactly as fast as it was.
   */
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(SCRIPT, { scope: SCOPE })
      // Additive: the registration itself is unchanged, and a failure in the
      // watcher cannot reach it — `then` runs only after a successful register,
      // and its own throw would be caught by the same `catch` below.
      .then(watchForUpdate)
      .catch((error) => {
        // Not thrown. A CRM that refuses to load because an optional cache layer
        // failed to install would be a far worse bug than the one being reported.
        console.warn('[pwa] Service worker registration failed.', error)
      })
  })
}

export default registerServiceWorker
