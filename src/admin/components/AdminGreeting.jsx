/**
 * The dashboard's opening line.
 *
 * ## Why a greeting earns its place
 *
 * Not decoration, and not a personality. It does two jobs an executive
 * dashboard needs done before any figure is read:
 *
 *  1. **Confirms who you are signed in as.** An operator with an owner account
 *    and an employee account is one tab away from acting in the wrong one, and
 *    a name at the top is the cheapest possible answer.
 *  2. **States whether anything needs attention**, before the reader has to
 *    infer it from twelve tiles. "Everything is running normally" is a real
 *    finding — it means the twelve tiles below can be skimmed rather than
 *    audited.
 *
 * ## The status line is derived, never decorative
 *
 * It reads the same blocks the tiles do. If mailboxes are disconnected or a
 * worker is stuck it says so and points at it; otherwise it says things are
 * normal. It never claims health it has not checked — a dashboard that always
 * says "all good" teaches people to stop reading it.
 */

import { AlertTriangle, CheckCircle2 } from 'lucide-react'

import { deriveStatus } from '@/admin/utils/workspaceStatus'

/** Time-of-day greeting, from the reader's own clock. */
function greetingFor(date = new Date()) {
  const hour = date.getHours()

  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

/**
 * @param {{
 *   user?: ?object,
 *   data?: ?object,
 *   isLoading?: boolean,
 *   action?: import('react').ReactNode,
 * }} props
 *   `action` is this page's header action slot. The dashboard's heading is
 *   the greeting rather than an `AdminHeader` title, so its controls belong
 *   on this row — put in the empty header above, they read as floating over
 *   the page instead of belonging to the heading beside them.
 */
export function AdminGreeting({ user, data, isLoading = false, action = null }) {
  const status = deriveStatus(data)

  /** First name only. "Good afternoon, Aryan" reads as a greeting; the full
      legal name reads as a form letter. */
  const firstName = user?.displayName?.trim().split(/\s+/)[0] ?? null

  return (
    <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        <h1 className="text-[1.75rem] font-semibold leading-tight tracking-[-0.02em] text-slate-900">
          {greetingFor()}
          {firstName ? `, ${firstName}` : ''}
        </h1>

        {isLoading ? (
          <div className="skeleton mt-2 h-4 w-64" />
        ) : status ? (
          <p className="mt-2 flex items-center gap-2 text-sm">
            {status.tone === 'ok' ? (
              <CheckCircle2 className="size-4 shrink-0 text-emerald-600" aria-hidden="true" />
            ) : (
              <AlertTriangle className="size-4 shrink-0 text-amber-600" aria-hidden="true" />
            )}
            <span className={status.tone === 'ok' ? 'text-slate-500' : 'text-amber-800'}>
              {status.message}
            </span>
          </p>
        ) : (
          // The payload could not be read. Said plainly rather than omitted,
          // because an absent status line looks like a healthy one.
          <p className="mt-2 text-sm text-slate-400">Workspace status is unavailable.</p>
        )}
      </div>

      {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
    </div>
  )
}

export default AdminGreeting
