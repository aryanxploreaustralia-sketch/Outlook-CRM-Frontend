/**
 * Mailbox vocabulary, mirroring the backend DTO.
 *
 * The four health states are the ones `adminMailbox.dto.js` produces, and no
 * more: a client that invents a fifth renders a blank badge for a state the
 * server can never send.
 */

/** Health, in the four words an operator can act on. */
export const MAILBOX_HEALTH = Object.freeze({
  HEALTHY: 'healthy',
  TOKEN_EXPIRING: 'token_expiring',
  DISCONNECTED: 'disconnected',
  RECONNECT_REQUIRED: 'reconnect_required',
})

export const MAILBOX_HEALTH_LABELS = Object.freeze({
  [MAILBOX_HEALTH.HEALTHY]: 'Healthy',
  [MAILBOX_HEALTH.TOKEN_EXPIRING]: 'Token expiring',
  [MAILBOX_HEALTH.DISCONNECTED]: 'Disconnected',
  [MAILBOX_HEALTH.RECONNECT_REQUIRED]: 'Reconnect required',
})

/**
 * Badge tone per state. The label always carries the meaning too.
 *
 * `token_expiring` is amber rather than red: the mailbox still works, and
 * colouring a working mailbox as broken is how operators learn to ignore red.
 */
export const MAILBOX_HEALTH_TONE = Object.freeze({
  [MAILBOX_HEALTH.HEALTHY]: 'success',
  [MAILBOX_HEALTH.TOKEN_EXPIRING]: 'warning',
  [MAILBOX_HEALTH.DISCONNECTED]: 'neutral',
  [MAILBOX_HEALTH.RECONNECT_REQUIRED]: 'danger',
})

export const MAILBOX_HEALTH_OPTIONS = Object.entries(MAILBOX_HEALTH_LABELS).map(
  ([value, label]) => ({ value, label }),
)

export const MAILBOX_STATUS_OPTIONS = Object.freeze([
  { value: 'connected', label: 'Connected' },
  { value: 'disconnected', label: 'Disconnected' },
  { value: 'expired', label: 'Expired' },
  { value: 'error', label: 'Error' },
])

/**
 * Stated on the assignment screens.
 *
 * The rule is not obvious from the interface alone, and getting it wrong looks
 * like a bug: an administrator who removes somebody from a mailbox and finds the
 * connector still listed needs to know that is deliberate.
 */
export const MAILBOX_CONNECTOR_NOTICE =
  'The person who connected a mailbox always keeps access — the authorisation it runs on is theirs.'

export default MAILBOX_HEALTH
