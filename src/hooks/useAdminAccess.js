/**
 * Whether this account may open the admin console.
 *
 * Answers exactly one question, for exactly one purpose: should the CRM offer a
 * way through to `/admin`? A CRM user who holds no admin permission never sees
 * the entrance.
 *
 * ## Why this is not `usePermissions`
 *
 * `PermissionProvider` is mounted inside `AdminLayout`, not at the application
 * root, and its own note records why: *"the CRM does not consult permissions
 * yet, and every CRM user would otherwise pay for a request nothing reads"*.
 * Calling `usePermissions()` from the CRM chrome would therefore throw.
 *
 * That reasoning still holds for the console's fine-grained catalogue, which the
 * CRM has no use for. It no longer holds for this one boolean. So rather than
 * hoisting the provider — which would move a large, admin-shaped context around
 * the whole application to light up a single link — this reads the same
 * endpoint, keeps the one field it needs, and leaves the console's architecture
 * untouched.
 *
 * ## Same source of truth
 *
 * `adminAccess` is computed **server-side** from `roleMatrix.js`, the table the
 * admin routes themselves are gated by. Nothing here inspects a role name or
 * reimplements the rule, so this cannot drift from what the server will allow.
 *
 * `GET /v1/admin/me/permissions` is deliberately guarded by authentication only
 * — gating the discovery of your own permissions on a permission would be
 * circular — so it is safe for every signed-in user and answers `false` rather
 * than refusing.
 *
 * ## It is not a security boundary
 *
 * Hiding a link hides nothing. `AdminLayout` still gates on the same flag,
 * every admin page still declares its permission, and every admin endpoint
 * still enforces it server-side and answers 403. This decides only whether the
 * link is worth showing.
 */

import { useCallback } from 'react'

import { fetchMyPermissions } from '@/admin/services/admin.service'
import { useApiResource } from '@/hooks/useApiResource'
import { useAuth } from '@/hooks/useAuth'

/**
 * @returns {{ hasAdminAccess: boolean, isReady: boolean }}
 *   `hasAdminAccess` is false until the answer is known, so the link fades in
 *   for an administrator rather than flashing for everybody. Failing closed is
 *   the right direction: the worst case is an administrator using the URL.
 */
export function useAdminAccess() {
  const auth = useAuth()

  const fetcher = useCallback(({ signal }) => fetchMyPermissions({ signal }), [])

  // Deferred until the session is confirmed. Asking anonymously is a guaranteed
  // 401 on every cold load of the login page.
  const { data, isSuccess } = useApiResource(fetcher, {
    enabled: auth.isReady && auth.authenticated,
  })

  return {
    hasAdminAccess: data?.adminAccess === true,
    isReady: isSuccess,
  }
}

export default useAdminAccess
