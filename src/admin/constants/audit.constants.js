/**
 * Audit vocabulary and link helpers.
 *
 * Split out of the audit components for the reason the chart palette was in
 * Phase 14.1: a `.jsx` module that exports both a component and a constant
 * defeats Fast Refresh, so editing a badge reloads the whole page instead of
 * hot-swapping the badge.
 *
 * Nothing here maps an action to English. Labels arrive on every row from the
 * server's event registry — a second mapping in the client would go stale the
 * first time an event was renamed, and would fail silently.
 */

import { ADMIN_PATHS } from '@/admin/routes/adminPaths'

/**
 * Severity tone.
 *
 * `critical` is deliberately not red. Red on this page means "something went
 * wrong", and a critical event is usually somebody doing their job correctly —
 * granting access, starting a campaign. Failure and denial get the red, because
 * those did go wrong.
 */
export const SEVERITY_TONE = Object.freeze({
  notice: 'neutral',
  warning: 'warning',
  critical: 'brand',
})

export const SEVERITY_LABEL = Object.freeze({
  notice: 'Routine',
  warning: 'Attention',
  critical: 'Privileged',
})

export const RESULT_TONE = Object.freeze({
  success: 'success',
  failure: 'danger',
  denied: 'danger',
})

export const RESULT_LABEL = Object.freeze({
  success: 'Success',
  failure: 'Failed',
  denied: 'Denied',
})

/** Builds an audit-log URL that opens with a filter already applied. */
export function auditLinkFor(filter) {
  const query = new URLSearchParams(
    Object.entries(filter).filter(
      ([, value]) => value !== null && value !== undefined && value !== '',
    ),
  )

  return `${ADMIN_PATHS.AUDIT}?${query}`
}

export default { RESULT_LABEL, RESULT_TONE, SEVERITY_LABEL, SEVERITY_TONE, auditLinkFor }
