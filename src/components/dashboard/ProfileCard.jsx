/**
 * User profile card.
 *
 * Presentational only: it receives data and callbacks, makes no API calls, and
 * holds no state. That keeps it reusable on any future page — a settings screen,
 * a team member drawer — without dragging data-fetching along with it.
 */

import { LogOut } from 'lucide-react'

import { ConnectionBadge } from '@/components/common/ConnectionBadge'
import { UserAvatar } from '@/components/common/UserAvatar'
import { Button } from '@/components/ui/Button'
import { CardRow } from '@/components/dashboard/StatusCard'
import { formatDateTime } from '@/utils/datetime'

/** Absent renders as nothing here; the callers supply their own wording. */
const displayDateTimeOrNull = (value) => formatDateTime(value, { empty: null })

/** Formats an ISO timestamp for display, tolerating null and invalid values. */
/**
 * @param {{
 *   user?: ?object,
 *   connection?: ?object,
 *   onSignOut?: () => void,
 *   isSigningOut?: boolean,
 *   className?: string,
 * }} props
 */
export function ProfileCard({
  user,
  connection,
  onSignOut,
  isSigningOut = false,
  className = '',
}) {
  return (
    <section
      className={`overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card ${className}`}
    >
      {/* --- Identity header ---------------------------------------------- */}
      <div className="flex flex-col items-center gap-3 border-b border-slate-100 bg-gradient-to-b from-slate-50 to-white px-6 py-6 text-center">
        <UserAvatar
          name={user?.displayName}
          email={user?.email}
          initials={user?.initials}
          size="xl"
        />

        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold text-slate-900">
            {user?.displayName ?? 'Signed-in user'}
          </h2>
          <p className="mt-0.5 truncate text-sm text-slate-500">
            {user?.email ?? user?.userPrincipalName ?? 'No email reported'}
          </p>
          {user?.jobTitle && (
            <p className="mt-0.5 truncate text-xs text-slate-400">{user.jobTitle}</p>
          )}
        </div>

        <ConnectionBadge connection={connection} />
      </div>

      {/* --- Details ------------------------------------------------------ */}
      <div className="px-6 py-2">
        <dl className="divide-y divide-slate-100">
          <CardRow label="Provider" value={user?.providerLabel ?? user?.provider} />
          <CardRow label="Role" value={user?.roleLabel ?? user?.role} />
          <CardRow label="Account type" value={user?.accountTypeLabel ?? user?.accountType} />
          <CardRow label="Last login" value={displayDateTimeOrNull(user?.lastLoginAt)} />
        </dl>
      </div>

      {/* --- Actions ------------------------------------------------------ */}
      {onSignOut && (
        <div className="border-t border-slate-100 px-6 py-4">
          <Button
            variant="secondary"
            fullWidth
            onClick={onSignOut}
            isLoading={isSigningOut}
            loadingLabel="Signing out…"
          >
            <LogOut className="size-4" aria-hidden="true" />
            Logout
          </Button>
        </div>
      )}
    </section>
  )
}

export default ProfileCard
