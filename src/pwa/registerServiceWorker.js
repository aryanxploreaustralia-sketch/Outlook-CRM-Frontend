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
    navigator.serviceWorker.register(SCRIPT, { scope: SCOPE }).catch((error) => {
      // Not thrown. A CRM that refuses to load because an optional cache layer
      // failed to install would be a far worse bug than the one being reported.
      console.warn('[pwa] Service worker registration failed.', error)
    })
  })
}

export default registerServiceWorker
