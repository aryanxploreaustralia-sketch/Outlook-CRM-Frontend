/**
 * Permissions, Security and Activity — governance rather than work.
 *
 * All three are read-only, and two of the three are honest about what they
 * cannot yet show. Nothing here implements audit: the Activity section is the
 * interface that audit will populate, deliberately built now so that phase is a
 * data change rather than a design one.
 */

import { KeyRound, MonitorSmartphone, ShieldCheck } from 'lucide-react'

import { AdminBadge } from '@/admin/components/AdminBadge'
import { AdminCard } from '@/admin/components/AdminCard'
import { PermissionList } from '@/admin/components/users/PermissionList'
import {
  Fact,
  NotTracked,
  UserSection,
} from '@/admin/components/users/detail/UserDetailPrimitives'
import { formatCount, formatDateTime, formatRelative } from '@/admin/utils/format'
import { AuditEventList } from '@/admin/components/audit/AuditEventList'
import { auditLinkFor } from '@/admin/constants/audit.constants'

/**
 * Section 7 — effective permissions, grouped.
 *
 * Rendered from the same catalogue and grouping the server sends with
 * `/admin/me/permissions`, and the same `permissions` array the profile derives
 * from `roleMatrix`. So this screen cannot describe access the middleware would
 * not honour — it is the same data, not a second description of it.
 */
export function UserPermissionsSection({ user, groups, catalogue, isSelf, registerRef }) {
  return (
    <UserSection
      id="permissions"
      ref={registerRef('permissions')}
      title={isSelf ? 'My permissions' : 'Permissions'}
      description={`Everything the ${user.roleLabel ?? user.role} role grants. Roles are fixed bundles — permissions are not assigned individually.`}
    >
      <AdminCard
        title={
          <span className="flex items-center gap-2">
            <KeyRound className="size-4 text-slate-400" aria-hidden="true" />
            {formatCount(user.permissions?.length ?? 0)} permissions held
          </span>
        }
        description="Generated from the constants the server enforces on every request."
      >
        <PermissionList
          groups={groups}
          catalogue={catalogue}
          granted={user.permissions ?? []}
          emptyMessage="This role grants no permissions."
        />
      </AdminCard>
    </UserSection>
  )
}

/**
 * Section 8 — how this account signs in, and from where.
 *
 * ## What is real and what is not
 *
 * Session count and last address come from the session store, which is written
 * on every authenticated request. Device is not: `Session` records a user-agent
 * string, but nothing parses it into a device, and inventing "Chrome on Windows"
 * from an unparsed string is a guess presented as a fact.
 */
export function UserSecuritySection({ user, registerRef }) {
  const sessions = user.activity?.activeSessions ?? 0

  return (
    <UserSection
      id="security"
      ref={registerRef('security')}
      title="Security"
      description="How this account authenticates, and its current sessions."
    >
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <AdminCard
          title={
            <span className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-slate-400" aria-hidden="true" />
              Authentication
            </span>
          }
        >
          <dl>
            <Fact
              label="Google account"
              value={
                user.provider === 'google' ? (
                  <AdminBadge tone="success" dot>
                    Connected
                  </AdminBadge>
                ) : user.provider ? (
                  <AdminBadge tone="neutral">{user.provider}</AdminBadge>
                ) : (
                  <AdminBadge tone="warning">Never signed in</AdminBadge>
                )
              }
            />
            <Fact label="Sign-in address" value={user.email} />
            <Fact
              label="Last sign-in"
              value={user.lastLoginAt ? formatDateTime(user.lastLoginAt) : 'Never'}
              hint={user.lastLoginAt ? formatRelative(user.lastLoginAt) : undefined}
            />
            <Fact
              label="Password"
              value={<NotTracked>None — identity is delegated to Google</NotTracked>}
            />
          </dl>
        </AdminCard>

        <AdminCard
          title={
            <span className="flex items-center gap-2">
              <MonitorSmartphone className="size-4 text-slate-400" aria-hidden="true" />
              Sessions
            </span>
          }
        >
          <dl>
            <Fact
              label="Active sessions"
              value={
                sessions === 0 ? (
                  <span className="text-slate-500">Not signed in anywhere</span>
                ) : (
                  <AdminBadge tone="info">{formatCount(sessions)}</AdminBadge>
                )
              }
              hint="Sessions expire automatically and are swept by the database."
            />
            <Fact
              label="Last activity"
              value={
                user.activity?.lastActivityAt
                  ? formatRelative(user.activity.lastActivityAt)
                  : 'No live session'
              }
            />
            <Fact
              label="Last known address"
              value={user.activity?.lastIp ?? <NotTracked>No session recorded</NotTracked>}
              hint="Captured for audit. Never used to validate a session."
            />
            <Fact label="Last device" value={<NotTracked>User agent is not parsed</NotTracked>} />
          </dl>
        </AdminCard>
      </div>

      <p className="mt-3 text-xs text-slate-400">
        Suspending an account revokes every session immediately — it does not wait for them to
        expire.
      </p>
    </UserSection>
  )
}

/**
 * Section 9 — the activity timeline.
 *
 * ## Two timelines, deliberately kept apart
 *
 * The **lifecycle** list is derived from the account record itself: created,
 * invited, last status change, last sign-in. It is complete for every account,
 * including ones that predate audit recording.
 *
 * The **audit** list beneath it is what this person has actually done, read
 * from the log. It only covers actions taken since Phase 14.7 instrumented
 * them, which is why the two are separate sections rather than one merged feed:
 * merging them would imply the audit history reaches as far back as the
 * account does, and for existing accounts it does not.
 */
export function UserActivitySection({ user, registerRef, enabled = true, onSelectEntry }) {
  /** Newest first, and only entries that actually happened. */
  const events = [
    user.lastStatusChange?.at && {
      at: user.lastStatusChange.at,
      title: `Status changed to ${user.statusLabel}`,
      detail: user.lastStatusChange.by
        ? `by ${user.lastStatusChange.by.displayName ?? user.lastStatusChange.by.email}`
        : null,
    },
    user.lastLoginAt && {
      at: user.lastLoginAt,
      title: 'Signed in',
      detail: user.activity?.lastIp ? `from ${user.activity.lastIp}` : null,
    },
    user.invitation?.invitedAt && {
      at: user.invitation.invitedAt,
      title: 'Invited',
      detail: user.invitation.invitedBy
        ? `by ${user.invitation.invitedBy.displayName ?? user.invitation.invitedBy.email}`
        : null,
    },
    user.createdAt && { at: user.createdAt, title: 'Account created', detail: null },
  ]
    .filter(Boolean)
    .sort((a, b) => new Date(b.at) - new Date(a.at))

  return (
    <UserSection
      id="activity"
      ref={registerRef('activity')}
      title="Activity"
      description="Newest first."
    >
      <AdminCard padded={false}>
        <ol className="px-5 py-4">
          {events.map((event, index) => (
            <li key={`${event.title}-${event.at}`} className="relative flex gap-4 pb-6 last:pb-0">
              {/* The rail stops at the last item so it does not trail into
                  empty space below the final event. */}
              {index < events.length - 1 && (
                <span
                  className="absolute left-[7px] top-4 h-full w-px bg-slate-200"
                  aria-hidden="true"
                />
              )}

              <span
                className="relative z-10 mt-1.5 size-3.5 shrink-0 rounded-full bg-slate-300 ring-4 ring-white"
                aria-hidden="true"
              />

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <p className="text-sm font-medium text-slate-900">{event.title}</p>
                  <span className="ml-auto whitespace-nowrap text-xs text-slate-400">
                    {formatDateTime(event.at)}
                  </span>
                </div>
                {event.detail && <p className="mt-0.5 text-sm text-slate-600">{event.detail}</p>}
              </div>
            </li>
          ))}
        </ol>
      </AdminCard>

      {/* What this person has done, from the audit log. */}
      <div className="mt-6 space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Audit history</h3>
          <p className="mt-0.5 text-sm text-slate-500">
            Privileged actions this account has performed. Recording began when audit
            instrumentation was added, so it does not reach back to the account&rsquo;s creation.
          </p>
        </div>

        <AdminCard>
          <AuditEventList
            filter={{ actor: user.id }}
            limit={10}
            enabled={enabled}
            onSelect={onSelectEntry}
            emptyMessage="This account has not performed any recorded action."
            viewAllTo={auditLinkFor({ actor: user.id })}
          />
        </AdminCard>

        <AdminCard title="Actions taken on this account">
          <AuditEventList
            filter={{ performedFor: user.id }}
            limit={5}
            enabled={enabled}
            onSelect={onSelectEntry}
            emptyMessage="Nothing has been done to this account since recording began."
            viewAllTo={auditLinkFor({ performedFor: user.id })}
          />
        </AdminCard>
      </div>
    </UserSection>
  )
}

export default UserPermissionsSection
