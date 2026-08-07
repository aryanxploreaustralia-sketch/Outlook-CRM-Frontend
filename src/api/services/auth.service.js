/**
 * Authentication service.
 *
 * Wraps the auth endpoints. Sign-in is the one operation that cannot go through
 * Axios: the browser has to perform a real top-level navigation so it can follow
 * the redirect to Microsoft, display the consent screen, and come back with a
 * cookie. An XHR would be blocked by CORS at the Microsoft domain and could not
 * show the login UI at all.
 */

import { ENDPOINTS } from '@/api/endpoints'
import { apiUrl } from '@/api/apiUrl'
import { httpClient } from '@/api/httpClient'

/**
 * Starts Microsoft sign-in by navigating the browser to the API.
 *
 * @param {{ returnPath?: string }} [options]
 *   Path within this app to return to after sign-in. Must be a relative path;
 *   the server rejects absolute URLs to prevent an open redirect.
 */
export function startMicrosoftSignIn({ returnPath } = {}) {
  // `assign` rather than `replace` so the browser's Back button still works if
  // the user abandons the Microsoft consent screen.
  window.location.assign(apiUrl(ENDPOINTS.auth.login, { returnPath }))
}

/**
 * Starts Google sign-in by navigating the browser to the API.
 *
 * The same mechanism `startMicrosoftSignIn` uses and for the same reason: an
 * XHR cannot follow a cross-origin redirect chain or render Google's consent
 * screen. Kept as a separate function rather than a parameterised one, because
 * the two providers do different jobs — this identifies a CRM user, the other
 * authorises a mailbox — and collapsing them into one call site would be the
 * first step towards treating them as interchangeable.
 *
 * @param {{ returnPath?: string }} [options]
 *   Path within this app to return to. Must be relative; the server rejects
 *   absolute URLs to prevent an open redirect.
 */
/**
 * Starts administrator sign-in with Microsoft.
 *
 * Takes no `returnPath`. Where an administrator lands is the **server's**
 * decision, made after it has verified the account holds administrator access —
 * a client-supplied destination here would be a client asserting where it is
 * entitled to end up, which is the thing this door exists to decide.
 *
 * A refusal comes back to the login page as `?admin=error&reason=...`.
 */
export function startMicrosoftAdminSignIn() {
  window.location.assign(apiUrl(ENDPOINTS.auth.microsoftAdmin))
}

export function startGoogleSignIn({ returnPath } = {}) {
  window.location.assign(apiUrl(ENDPOINTS.auth.google, { returnPath }))
}

/**
 * Fetches the current authentication and connection status.
 *
 * Safe to call anonymously — the endpoint answers 200 with
 * `authenticated: false` rather than 401, because "not signed in" is a valid
 * state the UI needs to render, not an error.
 *
 * @param {{ verifyMailbox?: boolean }} [options]
 *   When true, the server makes a live Graph call to prove mailbox access.
 *   Opt-in because it costs a round trip and throttling budget.
 * @returns {Promise<object>}
 */
export async function fetchAuthStatus({ verifyMailbox = false } = {}) {
  const response = await httpClient.get(ENDPOINTS.auth.status, {
    params: verifyMailbox ? { verifyMailbox: 'true' } : undefined,
  })
  return response.data?.data ?? response.data
}

/**
 * Fetches the signed-in user's Microsoft profile, read live from Graph.
 *
 * Requires an active session; rejects with a normalised 401 otherwise.
 *
 * @returns {Promise<object>}
 */
export async function fetchMicrosoftProfile() {
  const response = await httpClient.get(ENDPOINTS.auth.profile)
  return response.data?.data ?? response.data
}

/**
 * Ends the local session.
 *
 * @returns {Promise<object>} Includes `microsoftSignOutUrl`, which the caller may
 *   navigate to in order to end the Microsoft SSO session as well.
 */
export async function signOut() {
  const response = await httpClient.post(ENDPOINTS.auth.logout)
  return response.data?.data ?? response.data
}

export default {
  startMicrosoftSignIn,
  startGoogleSignIn,
  fetchAuthStatus,
  fetchMicrosoftProfile,
  signOut,
}
