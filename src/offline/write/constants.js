/**
 * The vocabulary the write layer shares.
 *
 * Held apart from `mutations.js` and `processor.js` so neither has to import
 * the other for a constant — the queue writer and the queue drainer are
 * genuinely independent, and keeping them that way is what lets each be tested
 * without the other.
 */

import { STORE } from '@/offline/db/schema.js'

/**
 * The header carrying the idempotency key.
 *
 * Must match `MUTATION_ID_HEADER` in the backend's `middlewares/idempotency.js`.
 * A header rather than a body field, because every mutation controller
 * validates with `z.object()`, which strips unknown keys — a body-borne key
 * would be silently discarded and duplicate protection would never happen.
 */
export const MUTATION_ID_HEADER = 'X-Client-Mutation-Id'

/** Which local store holds each entity. */
export const WRITABLE = Object.freeze({
  leads: STORE.LEADS,
  contacts: STORE.CONTACTS,
  companies: STORE.COMPANIES,
})

/**
 * Entities with no server create endpoint.
 *
 * There is no `POST /v1/companies` in the API — a company comes into existence
 * implicitly, resolved by name while a lead is saved or imported. Queueing an
 * offline company create would strand a mutation with nowhere to send it, so it
 * is refused when it is made rather than discovered later.
 */
export const CREATE_UNSUPPORTED = Object.freeze(['companies'])

export default { MUTATION_ID_HEADER, WRITABLE, CREATE_UNSUPPORTED }
