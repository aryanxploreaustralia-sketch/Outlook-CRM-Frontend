/**
 * Sync service — the transport boundary for the change feed.
 *
 * Follows the same shape as every other file in this folder: components and
 * hooks call these functions, and nothing outside `api/services` touches Axios
 * or knows a URL.
 *
 * ## What this deliberately does not do
 *
 * It does not write to IndexedDB, decide what to fetch next, or interpret a
 * cursor. It performs one request and unwraps one envelope. The page loop and
 * every persistence decision live in `@/offline/sync/hydrate.js`, so the thing
 * that talks to the network and the thing that decides what is safe to keep are
 * separable and separately testable.
 *
 * ## Owner is not a parameter, and cannot be
 *
 * There is no argument here that names whose records to fetch. The server reads
 * the owner from the session cookie; a client has nothing to send and nothing
 * to spoof. See `sync.controller.js` on the server, whose query schema declares
 * no `owner` field at all.
 *
 * ## Cursors are flat on the wire, and that is load-bearing
 *
 * Callers pass an ordinary `{ leads: '…', contacts: '…' }` object, because that
 * is the convenient shape. It is flattened to one parameter per entity —
 * `cursorLeads`, `cursorContacts`, `cursorCompanies` — before it reaches Axios.
 *
 * It has to be. Handing Axios a nested `params` object makes it emit
 * `cursor[leads]=…`, and Express 5 defaults to the `"simple"` query parser,
 * which does not reassemble brackets: the server saw a flat key literally named
 * `"cursor[leads]"`, discarded it as unknown, and read from the beginning of
 * the feed on every request — while still returning a `nextCursor` this client
 * stored and could never spend. Hydration re-fetched page one until it hit its
 * own page limit.
 *
 * A flat parameter has nothing to reassemble, so no query parser can disagree
 * about it. `flattenCursors` below is the only place that shape is decided.
 */

import { ENDPOINTS } from '@/api/endpoints'
import { httpClient } from '@/api/httpClient'

/**
 * The query parameter carrying one entity's cursor: `leads` → `cursorLeads`.
 *
 * Mirrors `cursorParam` in the server's `sync.controller.js`. The two are
 * asserted against each other by `scripts/verify-hydration.mjs`, so a rename on
 * either side fails a test rather than silently resetting everybody's cursor.
 *
 * @param {string} entity
 * @returns {string}
 */
export const cursorParam = (entity) => `cursor${entity[0].toUpperCase()}${entity.slice(1)}`

/**
 * Turns `{ leads: 'ABC' }` into `{ cursorLeads: 'ABC' }`.
 *
 * Entries with no usable cursor are omitted rather than sent empty: the server
 * treats an absent parameter as "from the beginning", whereas an empty string
 * would be a malformed cursor and be refused.
 *
 * @param {Record<string, unknown>} cursors
 * @returns {Record<string, string>}
 */
export function flattenCursors(cursors = {}) {
  return Object.fromEntries(
    Object.entries(cursors)
      .filter(([, value]) => typeof value === 'string' && value !== '')
      .map(([entity, value]) => [cursorParam(entity), value]),
  )
}

/**
 * Fetches one page of changes.
 *
 * @param {object}  [params]
 * @param {object}  [params.cursors]  Per entity, e.g. `{ leads: '<opaque>' }`.
 *   An entity with no cursor is fetched from the beginning, which is what makes
 *   a first hydration and a resumed one the same request.
 * @param {string[]} [params.entities] Defaults to all three, server-side.
 * @param {number}  [params.limit]     Server caps this; see `MAX_LIMIT` there.
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<{
 *   entities: Record<string, {
 *     entity: string,
 *     records: object[],
 *     deleted: Array<{ entity: string, id: ?string, deletedAt: string, purged: boolean }>,
 *     nextCursor: ?string,
 *     hasMore: boolean,
 *   }>,
 *   serverTime: string,
 *   hasMore: boolean,
 * }>} The unwrapped `data` from the API envelope.
 */
export async function fetchChanges({ cursors = {}, entities, limit } = {}, { signal } = {}) {
  const params = {
    ...flattenCursors(cursors),
    ...(entities?.length ? { entities: entities.join(',') } : {}),
    ...(limit ? { limit } : {}),
  }

  const response = await httpClient.get(ENDPOINTS.sync.changes, { params, signal })
  return response.data?.data ?? null
}

/**
 * Asks whether anything is waiting, without transferring it.
 *
 * Cheap enough to call before deciding to hydrate on a metered connection.
 *
 * @returns {Promise<{ serverTime: string, entities: string[], maxLimit: number,
 *   defaultLimit: number, hasChanges: boolean }>}
 */
export async function fetchSyncStatus({ signal } = {}) {
  const response = await httpClient.get(ENDPOINTS.sync.status, { signal })
  return response.data?.data ?? null
}

export default { fetchChanges, fetchSyncStatus, cursorParam, flattenCursors }
