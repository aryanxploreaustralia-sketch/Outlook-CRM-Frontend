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
 *
 * ## "Not connected" is now something the server has to say
 *
 * This defaulted a missing payload to `NOT_CONNECTED`, which made the badge
 * assert a fact it had not been told. Before the first response, and after a
 * failed one, `connection` is simply absent — and "we have not heard yet" and
 * "there is no mailbox" are different answers that this rendered identically.
 * An absent payload is now `unknown`, which `StatusBadge` already draws as a
 * pulsing "Checking". Only an explicit `not_connected` from the server draws
 * "Not connected".
 */

import { StatusBadge } from '@/components/common/StatusBadge'
import { CONNECTION_STATUS, LEGACY_STATUS } from '@/constants/status.constants'

/** Overrides where the default badge label is not specific enough. */
const LABEL_OVERRIDES = {
  [CONNECTION_STATUS.REFRESHING]: 'Renewing access',
  [CONNECTION_STATUS.EXPIRED]: 'Reconnect required',
}

/**
 * @param {{
 *   connection?: ?{
 *     status?: string,
 *     tokenExpiry?: { isExpiringSoon?: boolean },
 *     connectedMailboxCount?: ?number,
 *   },
 *   isLoading?: boolean,
 *   size?: 'sm' | 'md',
 *   className?: string,
 * }} props
 *   `isLoading` lets a caller that renders during its own first fetch say so
 *   explicitly. A caller that gates on its own loading state — as the dashboard
 *   does — can omit it; an absent `connection` reaches the same badge.
 */
export function ConnectionBadge({ connection, isLoading = false, size = 'md', className = '' }) {
  /*
   * Three cases, not two.
   *
   * Loading and "no payload" both mean *unknown*. Only a status the server
   * actually sent is reported as fact.
   */
  const status = isLoading || !connection?.status ? LEGACY_STATUS.UNKNOWN : connection.status

  const isConnected = status === CONNECTION_STATUS.CONNECTED

  // A token about to lapse is still connected, but saying so early explains the
  // "Renewing access" state the user may see moments later.
  const isExpiringSoon = isConnected && connection?.tokenExpiry?.isExpiringSoon === true

  /*
   * The mailbox count, when there is more than one and nothing more urgent to
   * say. A workspace with two mailboxes is not better described as plain
   * "Connected", and the count is the one thing this badge can add without
   * needing a second request.
   *
   * `isExpiringSoon` wins: a renewal is time-sensitive and the count is not.
   */
  const count = connection?.connectedMailboxCount

  let label
  if (status === LEGACY_STATUS.UNKNOWN) label = 'Checking connection…'
  else if (isExpiringSoon) label = 'Connected · renewing soon'
  else if (isConnected && typeof count === 'number' && count > 1) label = `Connected · ${count} accounts`
  else label = LABEL_OVERRIDES[status]

  return <StatusBadge state={status} label={label} size={size} className={className} />
}

export default ConnectionBadge
