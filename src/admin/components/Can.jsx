/**
 * Declarative permission gates.
 *
 * Three components rather than one with a mode prop, because the three read
 * differently at a call site and the distinction matters:
 *
 *   <Can do={USERS_INVITE}>            one permission
 *   <CanAny of={[A, B]}>               reachable from either capability
 *   <CanAll of={[LEADS_VIEW, EXPORT]}> genuinely needs both
 *
 * ## Renders nothing rather than something disabled
 *
 * The brief is explicit and it is the right call: an unauthorized user should
 * not learn that a control exists. A greyed-out "Suspend user" button tells
 * somebody exactly what the account above theirs can do, and invites them to ask
 * for it.
 *
 * `fallback` is available for the rare case where the absence needs explaining —
 * an empty table cell that would otherwise collapse the column, say — and
 * defaults to nothing.
 *
 * ## This is not the security boundary
 *
 * Hiding is presentation. Every gated action calls an endpoint that checks the
 * same permission server-side and answers 403. If these components were deleted
 * entirely, the product would be uglier and exactly as secure.
 */

import { usePermissions } from '@/admin/hooks/usePermissions'

/**
 * @param {{
 *   do: string,
 *   fallback?: import('react').ReactNode,
 *   children: import('react').ReactNode,
 * }} props
 */
export function Can({ do: permission, fallback = null, children }) {
  const { can } = usePermissions()
  return can(permission) ? children : fallback
}

/**
 * Renders when the caller holds **any** of the permissions.
 *
 * @param {{
 *   of: string[],
 *   fallback?: import('react').ReactNode,
 *   children: import('react').ReactNode,
 * }} props
 */
export function CanAny({ of: permissions, fallback = null, children }) {
  const { canAny } = usePermissions()
  return canAny(permissions) ? children : fallback
}

/**
 * Renders only when the caller holds **every** permission.
 *
 * @param {{
 *   of: string[],
 *   fallback?: import('react').ReactNode,
 *   children: import('react').ReactNode,
 * }} props
 */
export function CanAll({ of: permissions, fallback = null, children }) {
  const { canAll } = usePermissions()
  return canAll(permissions) ? children : fallback
}

export default Can
