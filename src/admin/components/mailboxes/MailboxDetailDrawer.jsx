/**
 * One mailbox, and who may use it.
 *
 * The mailbox side of the assignment relationship. The user side lives in
 * `UserMailboxesDialog`; both call the same service, so there is one
 * implementation of what assignment means and two ways to reach it.
 *
 * ## The connector is shown but not removable
 *
 * Their access comes from the OAuth grant the mailbox actually runs on. The
 * server refuses to unassign them; this renders that refusal as an absent
 * button and a short explanation, rather than a control that fails when pressed.
 *
 * ## No token material
 *
 * Nothing here renders a credential, and the endpoint behind it does not read
 * one — `sourceAccount` is not selected server-side, so it cannot be
 * dereferenced by accident. Health is inferred from recorded sync state, and
 * says so.
 */

import { useCallback, useState } from 'react'
import { Inbox, Plug, Star, UserMinus, UserPlus } from 'lucide-react'

import { AdminBadge } from '@/admin/components/AdminBadge'
import { AdminDrawer } from '@/admin/components/AdminDrawer'
import { AdminErrorState } from '@/admin/components/AdminErrorState'
import { AdminListLoading } from '@/admin/components/AdminLoadingState'
import { Can } from '@/admin/components/Can'
import { AssignUsersDialog } from '@/admin/components/mailboxes/AssignUsersDialog'
import { MAILBOX_HEALTH_LABELS, MAILBOX_HEALTH_TONE } from '@/admin/constants/mailbox.constants'
import { PERMISSIONS } from '@/admin/constants/permissions'
import { useAdminResource } from '@/admin/hooks'
import { usePermission } from '@/admin/hooks/usePermissions'
import {
  fetchAdminMailbox,
  setMailboxDefaultFor,
  unassignMailboxUsers,
} from '@/admin/services/admin.service'
import { AuditEventList } from '@/admin/components/audit/AuditEventList'
import { auditLinkFor } from '@/admin/constants/audit.constants'
import { EMPTY, formatCount, formatDateTime, formatRelative } from '@/admin/utils/format'
import { StatusBadge } from '@/components/common/StatusBadge'
import { UserAvatar } from '@/components/common/UserAvatar'
import { Button } from '@/components/ui/Button'

/** One labelled fact. This drawer edits nothing except membership. */
function Fact({ label, value }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-slate-100 py-2.5 last:border-b-0">
      <dt className="shrink-0 text-xs font-medium text-slate-500">{label}</dt>
      <dd className="min-w-0 text-right text-sm text-slate-800">{value ?? EMPTY}</dd>
    </div>
  )
}

/**
 * @param {{
 *   mailboxId: ?string,
 *   isOpen: boolean,
 *   onClose: () => void,
 *   onChanged?: () => void,
 * }} props
 */
export function MailboxDetailDrawer({ mailboxId, isOpen, onClose, onChanged }) {
  const canAssign = usePermission(PERMISSIONS.MAILBOXES_ASSIGN)

  const [isAssignOpen, setIsAssignOpen] = useState(false)
  const [busyUserId, setBusyUserId] = useState(null)
  const [actionError, setActionError] = useState(null)

  const loader = useCallback((options) => fetchAdminMailbox(mailboxId, options), [mailboxId])

  const { data, error, isLoading, refresh } = useAdminResource(loader, {
    deps: [mailboxId],
    // Nothing is fetched until the drawer is open, so closing it does not leave
    // a request in flight for a panel nobody is looking at.
    enabled: Boolean(isOpen && mailboxId),
  })

  /** Both member actions refetch rather than patch — counts and defaults move. */
  const run = async (userId, operation) => {
    setBusyUserId(userId)
    setActionError(null)

    try {
      await operation()
      refresh()
      onChanged?.()
    } catch (caught) {
      setActionError(caught?.message ?? 'That change could not be applied.')
    } finally {
      setBusyUserId(null)
    }
  }

  const members = data ? [data.connector, ...data.assignees].filter(Boolean) : []

  return (
    <>
      <AdminDrawer
        isOpen={isOpen}
        onClose={onClose}
        title={data?.emailAddress ?? 'Mailbox'}
        description={data?.providerLabel}
        footer={
          data && canAssign ? (
            <Button size="sm" onClick={() => setIsAssignOpen(true)}>
              <UserPlus className="size-3.5" aria-hidden="true" />
              Assign users
            </Button>
          ) : null
        }
      >
        {error ? (
          <AdminErrorState error={error} onRetry={refresh} compact />
        ) : isLoading || !data ? (
          <AdminListLoading rows={8} />
        ) : (
          <div className="space-y-6">
            {/* --- Identity ---------------------------------------------- */}
            <div className="flex items-center gap-4">
              <span
                className="grid size-12 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-500"
                aria-hidden="true"
              >
                <Inbox className="size-6" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-slate-900">
                  {data.emailAddress}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <StatusBadge state={data.status} size="sm" />
                  <AdminBadge tone={MAILBOX_HEALTH_TONE[data.health.state] ?? 'neutral'} dot>
                    {MAILBOX_HEALTH_LABELS[data.health.state] ?? data.health.state}
                  </AdminBadge>
                </div>
              </div>
            </div>

            <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
              {data.health.detail}
            </p>

            {/* --- Connection -------------------------------------------- */}
            <section>
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Connection
              </h3>
              <dl className="mt-1">
                <Fact label="Provider" value={data.providerLabel} />
                <Fact
                  label="Connected by"
                  value={data.connectedBy?.displayName ?? data.connectedBy?.email}
                />
                <Fact label="Connected" value={formatDateTime(data.connectedAt)} />
                <Fact label="Last sync" value={formatRelative(data.lastSyncAt)} />
                <Fact
                  label="Reply sync"
                  value={data.syncEnabled ? 'Enabled' : 'Disabled'}
                />
                <Fact
                  label="Messages synced"
                  value={formatCount(data.metrics.messagesSynced)}
                />
              </dl>
            </section>

            {/* --- Members ------------------------------------------------ */}
            <section>
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Who can use this mailbox
                </h3>
                <span className="text-xs text-slate-400">
                  {members.length} {members.length === 1 ? 'person' : 'people'}
                </span>
              </div>

              {actionError && (
                <p role="alert" className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                  {actionError}
                </p>
              )}

              <ul className="mt-3 space-y-2">
                {members.map((member) => (
                  <li
                    key={member.id}
                    className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2"
                  >
                    <UserAvatar name={member.displayName} email={member.email} size="sm" />

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {member.displayName ?? member.email}
                      </p>
                      <p className="truncate text-xs text-slate-500">{member.email}</p>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                      {member.isDefault && (
                        <AdminBadge tone="warning">
                          <Star className="size-3 fill-current" aria-hidden="true" />
                          Default
                        </AdminBadge>
                      )}

                      {member.accessVia === 'connector' ? (
                        <AdminBadge tone="neutral" title="Connected this mailbox">
                          <Plug className="size-3" aria-hidden="true" />
                          Owner
                        </AdminBadge>
                      ) : (
                        <>
                          {!member.isDefault && (
                            <Can do={PERMISSIONS.MAILBOXES_DEFAULT}>
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={busyUserId === member.id}
                                onClick={() =>
                                  run(member.id, () => setMailboxDefaultFor(data.id, member.id))
                                }
                              >
                                Make default
                              </Button>
                            </Can>
                          )}

                          <Can do={PERMISSIONS.MAILBOXES_ASSIGN}>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-600 hover:bg-red-50 hover:text-red-700"
                              disabled={busyUserId === member.id}
                              aria-label={`Remove ${member.email}`}
                              onClick={() =>
                                run(member.id, () => unassignMailboxUsers(data.id, [member.id]))
                              }
                            >
                              <UserMinus className="size-3.5" aria-hidden="true" />
                            </Button>
                          </Can>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>

              <p className="mt-3 text-xs text-slate-400">
                The person who connected a mailbox always keeps access — the authorisation the
                mailbox runs on is theirs. Disconnect the mailbox from Account to remove it.
              </p>
            </section>

            {/* Phase 14.7: what has happened to this mailbox.
                Connection, disconnection, assignment and default changes all
                carry a `mailboxId`, so one filter finds every one of them. */}
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Recent events
              </h3>
              <AuditEventList
                filter={{ mailboxId }}
                limit={8}
                emptyMessage="Nothing has been recorded for this mailbox since audit recording began."
                viewAllTo={auditLinkFor({ mailboxId })}
              />
            </section>
          </div>
        )}
      </AdminDrawer>

      {data && (
        <AssignUsersDialog
          isOpen={isAssignOpen}
          onClose={() => setIsAssignOpen(false)}
          mailbox={data}
          onAssigned={() => {
            refresh()
            onChanged?.()
          }}
        />
      )}
    </>
  )
}

export default MailboxDetailDrawer
