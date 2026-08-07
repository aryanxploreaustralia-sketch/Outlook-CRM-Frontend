/**
 * Error and empty states.
 *
 * One component with named variants rather than six near-identical components:
 * the layout, spacing and accessibility semantics are shared, and only the icon,
 * wording and default action differ.
 *
 * Wording rules applied throughout:
 *  - say what happened, in plain language;
 *  - say what the user can do about it;
 *  - never surface a stack trace, internal path or raw server message.
 *
 * A caller-supplied `message` is shown as supporting detail because the API's
 * error envelope is already written for end users. Internal detail never reaches
 * the client — the server replaces non-operational messages before responding.
 */

import { Inbox, LockKeyhole, RefreshCw, ServerCrash, TimerOff, WifiOff } from 'lucide-react'

import { Button } from '@/components/ui/Button'

/**
 * Variant type is declared in `@/utils/apiError`, alongside the function that
 * chooses one from an API error.
 *
 * @typedef {import('@/utils/apiError').ErrorVariant} ErrorVariant
 */

const VARIANTS = {
  unauthorized: {
    Icon: LockKeyhole,
    tone: 'text-amber-600 bg-amber-50 ring-amber-600/20',
    title: 'Sign-in required',
    description: 'You need to sign in with Microsoft to view this page.',
    actionLabel: 'Go to sign in',
  },
  sessionExpired: {
    Icon: TimerOff,
    tone: 'text-orange-600 bg-orange-50 ring-orange-600/20',
    title: 'Your session expired',
    description: 'For your security, sessions end after a period of inactivity. Please sign in again.',
    actionLabel: 'Sign in again',
  },
  forbidden: {
    Icon: LockKeyhole,
    tone: 'text-red-600 bg-red-50 ring-red-600/20',
    title: 'Access not permitted',
    description: 'Your account does not have permission to view this resource.',
    actionLabel: 'Back to dashboard',
  },
  serverError: {
    Icon: ServerCrash,
    tone: 'text-red-600 bg-red-50 ring-red-600/20',
    title: 'Something went wrong on our side',
    description: 'The server could not complete the request. This has been logged for investigation.',
    actionLabel: 'Try again',
  },
  networkError: {
    Icon: WifiOff,
    tone: 'text-slate-600 bg-slate-100 ring-slate-500/20',
    title: 'Cannot reach the server',
    description:
      'Check your internet connection and confirm the API is running, then try again.',
    actionLabel: 'Retry',
  },
  noData: {
    Icon: Inbox,
    tone: 'text-slate-500 bg-slate-100 ring-slate-400/20',
    title: 'Nothing here yet',
    description: 'There is no data to display at the moment.',
    actionLabel: null,
  },
}

/**
 * @param {{
 *   variant?: ErrorVariant,
 *   title?: string,
 *   description?: string,
 *   message?: string,
 *   onRetry?: () => void,
 *   actionLabel?: string,
 *   action?: import('react').ReactNode,
 *   compact?: boolean,
 *   className?: string,
 * }} props
 */
export function ErrorScreen({
  variant = 'serverError',
  title,
  description,
  message,
  onRetry,
  actionLabel,
  action,
  compact = false,
  className = '',
}) {
  const config = VARIANTS[variant] ?? VARIANTS.serverError
  const { Icon } = config

  const resolvedActionLabel = actionLabel ?? config.actionLabel

  return (
    <div
      role="alert"
      className={`grid place-items-center px-6 ${compact ? 'py-10' : 'min-h-[60vh]'} ${className}`}
    >
      <div className="flex max-w-md flex-col items-center text-center">
        <span
          className={`grid size-12 place-items-center rounded-xl ring-1 ring-inset ${config.tone}`}
        >
          <Icon className="size-6" aria-hidden="true" />
        </span>

        <h2 className="mt-4 text-base font-semibold text-slate-900">{title ?? config.title}</h2>
        <p className="mt-1.5 text-sm text-slate-500">{description ?? config.description}</p>

        {message && (
          <p className="mt-3 rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600">{message}</p>
        )}

        {(action || (onRetry && resolvedActionLabel)) && (
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            {action}
            {!action && onRetry && resolvedActionLabel && (
              <Button variant="secondary" onClick={onRetry}>
                <RefreshCw className="size-3.5" aria-hidden="true" />
                {resolvedActionLabel}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default ErrorScreen
