/**
 * Who this local database belongs to.
 *
 * ## What is deliberately absent
 *
 * No password. No session cookie. No OAuth token, Microsoft or Google. No
 * refresh token. No secret of any kind.
 *
 * The CRM's session cookie is `httpOnly`, so JavaScript cannot read it even to
 * make that mistake — but the rule is stated here because this is the one store
 * where somebody would be tempted to "just cache the session so it works
 * offline". It must not, and `save` below drops any such key rather than
 * trusting callers to leave it out.
 *
 * What is kept is what the app needs to know *which* cached dataset to open and
 * how to label it: the user id, a display name, the role, and the permission
 * list the server already sends to the client in plain sight.
 */

import { openDatabase } from '@/offline/db/database.js'
import { STORE } from '@/offline/db/schema.js'

/** The single row. One identity per database — the database is per user. */
const IDENTITY_KEY = 'current'

/**
 * Keys that must never be written, whatever a caller passes.
 *
 * A denylist rather than an allowlist so a future profile field is not silently
 * dropped — but anything that smells like a credential is refused outright.
 */
const FORBIDDEN = [
  'password', 'token', 'accessToken', 'refreshToken', 'idToken', 'sessionId',
  'session', 'cookie', 'secret', 'clientSecret', 'apiKey', 'authorization',
]

/** Strips credential-shaped keys, at any depth, before anything is stored. */
function scrub(value) {
  if (Array.isArray(value)) return value.map(scrub)
  if (!value || typeof value !== 'object') return value

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !FORBIDDEN.some((banned) => key.toLowerCase().includes(banned.toLowerCase())))
      .map(([key, nested]) => [key, scrub(nested)]),
  )
}

const withStore = async (mode, run, userId) => {
  const db = await openDatabase(userId)
  const transaction = db.transaction(STORE.IDENTITY, mode)
  const result = await run(transaction.store)
  await transaction.done
  return result
}

export const identityRepository = {
  storeName: STORE.IDENTITY,

  /** @returns {Promise<?object>} The stored identity, or null. */
  async get({ userId = null } = {}) {
    const row = await withStore('readonly', (store) => store.get(IDENTITY_KEY), userId)
    return row ? row.value : null
  },

  /**
   * Records who is signed in.
   *
   * Scrubbed first — see `FORBIDDEN`. A caller that hands over a whole auth
   * payload gets the safe subset stored and the rest silently dropped, which is
   * the right failure: the identity is still usable and no credential lands on
   * disk.
   *
   * @param {{ userId: string, displayName?: string, email?: string,
   *           role?: string, permissions?: string[] }} identity
   */
  async save(identity, { userId = null } = {}) {
    if (!identity?.userId) throw new Error('An identity needs a userId.')

    const row = {
      key: IDENTITY_KEY,
      value: scrub({
        userId: identity.userId,
        displayName: identity.displayName ?? null,
        email: identity.email ?? null,
        role: identity.role ?? null,
        permissions: Array.isArray(identity.permissions) ? identity.permissions : [],
      }),
      updatedAt: new Date().toISOString(),
    }

    await withStore('readwrite', (store) => store.put(row), userId)
    return row.value
  },

  /**
   * Forgets who was signed in.
   *
   * Removes the identity row and **nothing else** — the cached records and any
   * queued work stay exactly where they are. Signing out is not a reason to
   * discard an edit that has not reached the server.
   */
  async clear({ userId = null } = {}) {
    await withStore('readwrite', (store) => store.delete(IDENTITY_KEY), userId)
  },

  /** The keys `save` refuses, exposed so a test can assert on them. */
  forbiddenKeys: FORBIDDEN,
}

export default identityRepository
