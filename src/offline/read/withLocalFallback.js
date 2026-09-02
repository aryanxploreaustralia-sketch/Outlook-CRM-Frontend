/**
 * The one place a read chooses between the network and the cache.
 *
 * Wrapping rather than branching at each call site is the point: there are a
 * dozen list and detail reads across the register, and a rule this consequential
 * — when is stale data acceptable? — must have exactly one implementation.
 *
 * ## The contract
 *
 * The wrapped result is whatever the online service returns, plus a `source`
 * field naming who answered. Adding a key is additive: every existing consumer
 * destructures `items` and `pagination` and is unaffected, while a page that
 * wants to say "showing offline data" now has something truthful to read.
 *
 * ## What is deliberately not done here
 *
 * No retry, no backoff, no request coalescing. `useApiResource` already owns
 * cancellation and stale-response ordering, and a second layer of retry logic
 * underneath it would fight with the first. This decides *where* a read comes
 * from and nothing else.
 */

import {
  READ_SOURCE,
  SERVED_BY,
  isTransportFailure,
  resolveSource,
} from '@/offline/read/source.js'

/**
 * Tags a result with the source that produced it.
 *
 * An array result is left alone apart from the tag being impossible to attach —
 * callers of this layer return objects, and a plain array would silently lose
 * the field. Guarded rather than assumed.
 */
function tag(result, source) {
  if (result === null || result === undefined) return result
  if (typeof result !== 'object' || Array.isArray(result)) return result
  return { ...result, source }
}

/**
 * Runs a read against the network, the cache, or the network then the cache.
 *
 * @param {object}   options
 * @param {(opts: { signal?: AbortSignal }) => Promise<any>} options.online
 *   The existing API service call. Untouched and unaware of any of this.
 * @param {() => Promise<any>} options.local
 *   The `localReads` equivalent, already bound to its user and parameters.
 * @param {() => Promise<boolean>} [options.hasLocal]
 *   Whether the cache can answer at all. An empty cache must produce the
 *   network's error rather than an empty page — see below.
 * @param {?AbortSignal} [options.signal]
 * @param {string} [options.preference] Overrides the stored preference.
 * @returns {Promise<any>} The result, tagged with `source`.
 */
export async function withLocalFallback({
  online,
  local,
  hasLocal = null,
  signal = null,
  preference,
} = {}) {
  const source = resolveSource(preference)

  /*
   * Cache-only: either the browser is certain it is offline, or somebody chose
   * LOCAL. No request is attempted — there is nothing to attempt it against,
   * and a doomed request would only add a timeout to every page load.
   */
  if (source === READ_SOURCE.LOCAL) {
    return tag(await local(), SERVED_BY.LOCAL)
  }

  try {
    return tag(await online({ signal }), SERVED_BY.ONLINE)
  } catch (error) {
    /*
     * Only a transport failure earns the cache. A 401, a 403, a 404 or a 500
     * are the server answering, and replacing an answer with stale data would
     * hide a real fault — a revoked session would look like a working CRM
     * showing slightly old numbers, which is the worst of both.
     */
    if (!isTransportFailure(error)) throw error

    /*
     * An empty cache must not become an empty register.
     *
     * Serving `{ items: [] }` here would be indistinguishable from a workspace
     * with no enquiries: the page would render its cheerful empty state and the
     * user would believe their data was gone. Rethrowing the network error
     * gives them the honest "could not reach the server" instead.
     */
    if (hasLocal && !(await hasLocal())) throw error

    try {
      return tag(await local(), SERVED_BY.LOCAL)
    } catch {
      /*
       * The cache failed too — IndexedDB unavailable, or a corrupt store. The
       * network error is the more useful of the two to surface, because it is
       * the one the user can act on.
       */
      throw error
    }
  }
}

export default withLocalFallback
