/**
 * Connection badge.
 *
 * A thin wrapper over `StatusBadge` that understands the connection payload
 * returned by the API, including the distinction between a *lapsed access token*
 * (harmless — renewed automatically) and a *revoked grant* (needs the user to
 * reconnect).
 *
 * Existing separately from `StatusBadge` so pages do not each re-derive that
 * logic from `connection.status` and `tokenExpiry`.
 */

import { StatusBadge } from '@/components/common/StatusBadge'
import { CONNECTION_STATUS } from '@/constants/status.constants'

/** Overrides where the default badge label is not specific enough. */
const LABEL_OVERRIDES = {
  [CONNECTION_STATUS.REFRESHING]: 'Renewing access',
  [CONNECTION_STATUS.EXPIRED]: 'Reconnect required',
}

/**
 * @param {{
 *   connection?: { status?: string, tokenExpiry?: { isExpiringSoon?: boolean } },
 *   size?: 'sm' | 'md',
 *   className?: string,
 * }} props
 */
export function ConnectionBadge({ connection, size = 'md', className = '' }) {
  const status = connection?.status ?? CONNECTION_STATUS.NOT_CONNECTED

  // A token about to lapse is still connected, but saying so early explains the
  // "Renewing access" state the user may see moments later.
  const isExpiringSoon =
    status === CONNECTION_STATUS.CONNECTED && connection?.tokenExpiry?.isExpiringSoon === true

  const label = isExpiringSoon ? 'Connected · renewing soon' : LABEL_OVERRIDES[status]

  return <StatusBadge state={status} label={label} size={size} className={className} />
}

export default ConnectionBadge
