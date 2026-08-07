/**
 * Reads the permission context.
 *
 * Throws when used outside `PermissionProvider`, rather than returning a
 * permissive default. A hook that quietly answered "yes" to `can()` because a
 * provider was missing would render every hidden control in the product, and the
 * mistake would look like a working screen.
 *
 * Returning a *denying* default would be safer but no better: the whole console
 * would appear empty for everyone, with nothing to explain why. Throwing names
 * the actual problem at the moment it exists.
 */

import { useContext } from 'react'

import { PermissionContext } from '@/admin/context/permissionContext'

/**
 * @returns {import('@/admin/context/permissionContext').PermissionContextValue}
 */
export function usePermissions() {
  const context = useContext(PermissionContext)

  if (!context) {
    throw new Error(
      'usePermissions() was called outside <PermissionProvider>. Wrap the admin shell in it.',
    )
  }

  return context
}

/**
 * Convenience for the common single check.
 *
 * `const canInvite = usePermission(PERMISSIONS.USERS_INVITE)` reads better at a
 * call site than destructuring `can` and invoking it, and it is the shape most
 * components want.
 *
 * @param {string} permission
 * @returns {boolean}
 */
export function usePermission(permission) {
  return usePermissions().can(permission)
}

export default usePermissions
