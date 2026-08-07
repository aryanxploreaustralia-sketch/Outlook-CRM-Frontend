/**
 * Authentication provider.
 *
 * Holds the single source of truth for two questions the application must never
 * confuse, and which Phase 13.2 separated:
 *
 *   - `authenticated` — is this person signed in to the CRM? Google answers it.
 *   - `canSendMail`   — does this workspace have a mailbox it can send through?
 *                       The connected Microsoft mailboxes answer it.
 *
 * The first gates navigation. The second gates *actions*, and only those that
 * genuinely reach a mailbox. A page must never be blocked because the second is
 * false — that was the bug this phase fixed, and the shape of this context is
 * what makes writing it again awkward.
 *
 * Kept in context rather than fetched per component so that adding a consumer
 * does not multiply the number of `/auth/status` calls.
 *
 * Exports only a component, so Fast Refresh works — the context object lives in
 * `authContext.js` and the consumer hook in `hooks/useAuth.js`.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { fetchAuthStatus, signOut as signOutRequest } from '@/api/services/auth.service'
import { REQUEST_STATUS } from '@/constants/app.constants'
import { AuthContext } from '@/context/authContext'
import { logger } from '@/utils/logger'

/**
 * The shape exposed to consumers before the first status response arrives.
 * Declared explicitly so components never read `undefined` during the initial
 * render pass.
 */
const INITIAL_STATUS = Object.freeze({
  /** Microsoft — mailbox authorisation. Unchanged. */
  configured: false,
  /** Google — CRM user identity. Additive in Phase 13.1. */
  googleConfigured: false,
  /**
   * Whether Microsoft may still sign somebody *in*. Off from Phase 13.2.
   *
   * Defaults false so the login page never flashes a Microsoft button during
   * the first render pass — offering a sign-in method the server will refuse.
   */
  microsoftSignInAllowed: false,
  authenticated: false,
  outlookConnected: false,
  scopesRequested: [],
  user: null,
  connection: null,
  session: null,
  mailbox: null,

  /**
   * Phase 13.2 — the mailbox layer.
   *
   * Declared here as well as on the server response so a component reading
   * `auth.mailboxes` during the first render pass gets an array rather than
   * `undefined`, and `auth.canSendMail` is a definite false rather than a
   * value that briefly looks like "allowed".
   */
  mailboxes: [],
  defaultMailboxId: null,
  canSendMail: false,
})

export function AuthProvider({ children }) {
  const [status, setStatus] = useState(INITIAL_STATUS)
  const [requestStatus, setRequestStatus] = useState(REQUEST_STATUS.IDLE)
  const [error, setError] = useState(null)

  const isMountedRef = useRef(true)

  const refresh = useCallback(async ({ verifyMailbox = false } = {}) => {
    setRequestStatus(REQUEST_STATUS.LOADING)
    try {
      const payload = await fetchAuthStatus({ verifyMailbox })
      if (!isMountedRef.current) return payload

      setStatus({ ...INITIAL_STATUS, ...payload })
      setError(null)
      setRequestStatus(REQUEST_STATUS.SUCCESS)
      return payload
    } catch (err) {
      if (!isMountedRef.current) return null

      // A failure here means the API is unreachable, not that the user is signed
      // out — surfacing it as "signed out" would be misleading.
      setError(err)
      setRequestStatus(REQUEST_STATUS.ERROR)
      return null
    }
  }, [])

  const signOut = useCallback(async () => {
    try {
      const result = await signOutRequest()
      logger.info('Signed out')
      return result
    } catch (err) {
      logger.error('Sign-out request failed', err)
      throw err
    } finally {
      // Refreshed even on failure: the server may have cleared the session
      // before the response failed, so local state must not be trusted.
      await refresh()
    }
  }, [refresh])

  useEffect(() => {
    isMountedRef.current = true
    refresh()

    return () => {
      isMountedRef.current = false
    }
  }, [refresh])

  const value = useMemo(
    () => ({
      ...status,
      error,
      isLoading: requestStatus === REQUEST_STATUS.LOADING,
      isReady: requestStatus === REQUEST_STATUS.SUCCESS || requestStatus === REQUEST_STATUS.ERROR,
      hasApiError: requestStatus === REQUEST_STATUS.ERROR,

      /** Mailboxes a message may actually be sent from, for the Send From pickers. */
      sendableMailboxes: (status.mailboxes ?? []).filter((mailbox) => mailbox.canSend),

      refresh,
      signOut,
    }),
    [status, error, requestStatus, refresh, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export default AuthProvider
