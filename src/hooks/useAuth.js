/**
 * Reads the authentication context.
 *
 * Throws when used outside `<AuthProvider>` — a clear error at the point of
 * misuse beats a confusing `null` dereference further down the tree.
 *
 * @returns {{
 *   configured: boolean,
 *   authenticated: boolean,
 *   outlookConnected: boolean,
 *   scopesRequested: string[],
 *   user: ?object,
 *   connection: ?object,
 *   session: ?object,
 *   mailbox: ?{ reachable: boolean, reason: ?string },
 *   error: ?object,
 *   isLoading: boolean,
 *   isReady: boolean,
 *   hasApiError: boolean,
 *   refresh: (options?: { verifyMailbox?: boolean }) => Promise<?object>,
 *   signOut: () => Promise<object>,
 * }}
 */

import { useContext } from 'react'

import { AuthContext } from '@/context/authContext'

export function useAuth() {
  const context = useContext(AuthContext)

  if (context === null) {
    throw new Error('useAuth must be used inside an <AuthProvider>.')
  }

  return context
}

export default useAuth
