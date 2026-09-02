/**
 * Identifiers for records the server has not seen yet.
 *
 * ## Why not a fabricated ObjectId
 *
 * It would be trivial to generate a 24-character hex string that looks exactly
 * like a MongoDB `_id`, and it would be a serious mistake. Every layer above —
 * the register, a detail route, a later sync, a support engineer reading a
 * database — would treat it as a server-confirmed id. When the record finally
 * reached the server it would be given a *different* real id, and the two would
 * have to be reconciled by something that could no longer tell them apart.
 *
 * So a local id announces itself. `local_` is not a valid ObjectId prefix, it
 * cannot be mistaken for one by eye or by regex, and `isLocalId` below is the
 * single predicate everything uses to ask the question.
 *
 * ## The properties this has to have
 *
 *  - **Unique** across devices, because two people working offline must not
 *    collide when their records eventually meet on the server.
 *  - **Persistent**, because it is the key of a row in IndexedDB and the link
 *    between that row and its queued mutation. It survives a browser restart
 *    because it is stored, not derived.
 *  - **Stable**, because the queue entry references it. It is minted once, when
 *    the record is created, and never regenerated.
 */

/** Everything a local id starts with. Never a valid ObjectId prefix. */
export const LOCAL_ID_PREFIX = 'local_'

/** A MongoDB ObjectId as it appears in a DTO: 24 hex characters. */
const OBJECT_ID = /^[0-9a-f]{24}$/i

/**
 * A collision-safe id for a record that exists only on this device.
 *
 * `crypto.randomUUID` where available — every current browser has it on a
 * secure origin. The fallback covers an insecure origin where `crypto` may be
 * missing; it is not cryptographically strong and does not need to be, because
 * this is a database key and never a secret. Both branches include enough
 * entropy that a collision is not a practical concern.
 *
 * @returns {string} e.g. `local_9f1c…`
 */
export function newLocalId() {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return `${LOCAL_ID_PREFIX}${crypto.randomUUID()}`
    }
  } catch {
    // Fall through to the entropy below.
  }

  const time = Date.now().toString(36)
  const random = Math.random().toString(36).slice(2, 12)
  return `${LOCAL_ID_PREFIX}${time}-${random}`
}

/**
 * Whether an id belongs to a record the server has never acknowledged.
 *
 * The one place this question is answered. A local id must never be sent to the
 * server as a record id, and a record holding one must never be treated as
 * synced.
 *
 * @param {unknown} id
 * @returns {boolean}
 */
export function isLocalId(id) {
  return typeof id === 'string' && id.startsWith(LOCAL_ID_PREFIX)
}

/**
 * Whether an id looks like one MongoDB issued.
 *
 * Used to assert that a reconciliation actually replaced a local id with a
 * server one, rather than storing something else the server happened to send.
 *
 * @param {unknown} id
 * @returns {boolean}
 */
export function isServerId(id) {
  return typeof id === 'string' && OBJECT_ID.test(id)
}

export default { LOCAL_ID_PREFIX, newLocalId, isLocalId, isServerId }
