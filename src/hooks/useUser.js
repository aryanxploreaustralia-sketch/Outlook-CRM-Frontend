/**
 * Presentation-ready view of the current user.
 *
 * `useAuth` exposes the raw authentication payload. This hook derives the values
 * the UI actually renders — display name with a sensible fallback, initials,
 * humanised role and provider — so that logic is written once instead of in every
 * component that shows a name.
 */

import { useMemo } from 'react'

import { useAuth } from '@/hooks/useAuth'

/** Fallbacks used when Graph returned nothing for a field. */
const FALLBACK_NAME = 'Signed-in user'

/** Humanises a snake_case value, e.g. `work_or_school` → `Work or school`. */
function humanise(value) {
  if (!value) return null
  const spaced = String(value).replace(/_/g, ' ')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

export function useUser() {
  const auth = useAuth()

  return useMemo(() => {
    const user = auth.user ?? null

    return {
      user,
      isAuthenticated: auth.authenticated,
      isLoading: auth.isLoading,
      isReady: auth.isReady,

      /** Never null once authenticated, so components need no fallback of their own. */
      displayName: user?.displayName ?? FALLBACK_NAME,
      email: user?.email ?? user?.userPrincipalName ?? null,
      initials: user?.initials ?? null,
      jobTitle: user?.jobTitle ?? null,

      role: user?.role ?? null,
      // Prefer the server's label so the wording is identical everywhere.
      roleLabel: user?.roleLabel ?? humanise(user?.role),
      provider: user?.provider ?? null,
      providerLabel: user?.providerLabel ?? humanise(user?.provider),
      accountType: user?.accountType ?? null,
      accountTypeLabel: user?.accountTypeLabel ?? humanise(user?.accountType),

      lastLoginAt: user?.lastLoginAt ?? null,
    }
  }, [auth])
}

export default useUser
