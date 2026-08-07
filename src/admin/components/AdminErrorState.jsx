/**
 * The failure surface for an admin screen.
 *
 * Wraps the CRM's `ErrorScreen` rather than reimplementing it: the icon set,
 * spacing, `role="alert"` and retry affordance are already correct there, and a
 * second error component is a second set of wording to keep consistent.
 *
 * What this adds is admin wording over `resolveAdminErrorVariant`, which lives
 * in `@/admin/utils/adminError` — a component file that also exports a function
 * defeats Fast Refresh, so the mapper is kept beside the other admin helpers.
 *
 * ## Wording
 *
 * Every branch says what happened and what to do about it. None of them shows a
 * stack trace or an internal path — the API's error envelope is already written
 * for end users, and non-operational messages are replaced server-side before
 * they leave the process.
 */

import { resolveAdminErrorVariant } from '@/admin/utils/adminError'
import { ErrorScreen } from '@/components/common/ErrorScreen'

/**
 * Copy per failure, keyed by the variant `ErrorScreen` will render.
 *
 * Overrides the shared defaults where the admin context makes a better sentence
 * available — "the admin API" is more actionable than "this page".
 */
const COPY = {
  sessionExpired: {
    title: 'Your session expired',
    description: 'Sign in again to continue. Nothing was lost — this screen only reads data.',
  },
  forbidden: {
    title: 'Access not permitted',
    description:
      'Your account is not allowed to read this. Ask an administrator if you believe it should be.',
  },
  networkError: {
    title: 'Cannot reach the server',
    description:
      'Check your connection and confirm the API is running, then try again. This screen only reads data, so retrying is always safe.',
  },
  notFound: {
    title: 'This endpoint is not available',
    description:
      'The admin API did not recognise this request. That usually means the server is running an older build than this page expects.',
  },
  serverError: {
    title: 'The server could not complete the request',
    description:
      'This has been logged with a request id for investigation. Retrying is safe — nothing on this screen writes.',
  },
}

/**
 * @param {{
 *   error: ?object,
 *   onRetry?: () => void,
 *   compact?: boolean,
 *   className?: string,
 * }} props
 */
export function AdminErrorState({ error, onRetry, compact = false, className = '' }) {
  const resolved = resolveAdminErrorVariant(error)

  // `ErrorScreen` has no `notFound` or `rateLimited` variant of its own. Both
  // are rendered with its neutral treatment and admin wording, rather than
  // adding variants to a component nine CRM pages share.
  const variant = resolved === 'notFound' || resolved === 'rateLimited' ? 'noData' : resolved

  const copy =
    resolved === 'rateLimited'
      ? {
          title: 'Too many requests',
          description:
            'This screen was refreshed more often than the server allows. Wait a moment and try again.',
        }
      : (COPY[resolved] ?? COPY.serverError)

  return (
    <ErrorScreen
      variant={variant}
      title={copy.title}
      description={copy.description}
      // The server's own message, shown as supporting detail. Safe by
      // construction: the error handler replaces non-operational messages
      // before they leave the process.
      message={error?.message}
      onRetry={onRetry}
      actionLabel={onRetry ? 'Try again' : undefined}
      compact={compact}
      className={className}
    />
  )
}

export default AdminErrorState
