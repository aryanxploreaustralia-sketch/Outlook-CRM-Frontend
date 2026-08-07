/**
 * Mailboxes, Campaigns, Leads and Replies — this person's working surface.
 *
 * All four are read-only. Nothing here edits a campaign or a lead: the admin
 * console monitors, and the CRM is where work happens. The one exception is
 * removing a mailbox assignment, which is administration rather than sales work
 * and calls the Phase 14.5 engine unchanged.
 *
 * ## Campaigns and leads are filtered by owner id, not name
 *
 * The monitoring endpoints return up to 200 rows across the whole deployment and
 * the page selects this person's from them. Matching on the display name would
 * attribute one person's pipeline to another the moment two names collide, or a
 * name is absent and falls back to an address — so both rows carry `ownerId`.
 */

import { Link } from 'react-router-dom'
import {
  ExternalLink,
  Inbox,
  MessageSquare,
  Plug,
  RefreshCw,
  Star,
  UserMinus,
} from 'lucide-react'

import { AdminBadge } from '@/admin/components/AdminBadge'
import { AdminCard } from '@/admin/components/AdminCard'
import { AdminEmptyState } from '@/admin/components/AdminEmptyState'
import { AdminListLoading, AdminTableLoading } from '@/admin/components/AdminLoadingState'
import { AdminTable, AdminTableIdentity } from '@/admin/components/AdminTable'
import { Can } from '@/admin/components/Can'
import {
  PendingSection,
  UserSection,
} from '@/admin/components/users/detail/UserDetailPrimitives'
import {
  MAILBOX_CONNECTOR_NOTICE,
  MAILBOX_HEALTH_LABELS,
  MAILBOX_HEALTH_TONE,
} from '@/admin/constants/mailbox.constants'
import { PERMISSIONS } from '@/admin/constants/permissions'
import { ADMIN_PATHS } from '@/admin/routes/adminPaths'
import { formatCount, formatDate, formatRelative } from '@/admin/utils/format'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Button } from '@/components/ui/Button'
import { ROUTE_PATHS } from '@/routes/paths'

/** Campaign status → badge tone. The label always carries the meaning too. */
const CAMPAIGN_TONE = {
  draft: 'neutral',
  scheduled: 'info',
  running: 'success',
  paused: 'warning',
  completed: 'neutral',
  cancelled: 'neutral',
  archived: 'neutral',
}

const STAGE_TONE = {
  new: 'brand',
  quoted: 'violet',
  follow_up: 'info',
  interested: 'info',
  negotiation: 'warning',
  visa_process: 'warning',
  booked: 'success',
  completed: 'success',
  cancelled: 'neutral',
  lost: 'neutral',
}

/**
 * Section 3 — the mailboxes this person may send through.
 *
 * Cards rather than a table: each mailbox carries a health sentence and up to
 * three controls, which a row would either truncate or make unreadably wide.
 */
export function UserMailboxesSection({
  mailboxes,
  isLoading,
  canSee,
  busyId,
  onRemove,
  onManage,
  registerRef,
}) {
  if (!canSee) {
    return (
      <UserSection id="mailboxes" ref={registerRef('mailboxes')} title="Mailboxes">
        <PendingSection title="You cannot view mailboxes">
          This section needs the “View connected mailboxes” permission.
        </PendingSection>
      </UserSection>
    )
  }

  return (
    <UserSection
      id="mailboxes"
      ref={registerRef('mailboxes')}
      title="Mailboxes"
      description="Everything this person may send through, and which is their default."
      action={
        <Can do={PERMISSIONS.MAILBOXES_ASSIGN}>
          <Button size="sm" variant="secondary" onClick={onManage}>
            <Inbox className="size-3.5" aria-hidden="true" />
            Manage assignments
          </Button>
        </Can>
      }
    >
      {isLoading ? (
        <AdminCard>
          <AdminListLoading rows={3} />
        </AdminCard>
      ) : mailboxes.length === 0 ? (
        <AdminCard>
          <AdminEmptyState
            title="No mailboxes"
            description="This person cannot send email until a mailbox is assigned to them."
            compact
          />
        </AdminCard>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {mailboxes.map((mailbox) => (
            <AdminCard key={mailbox.id}>
              <div className="flex items-start gap-3">
                <span
                  className="grid size-10 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500"
                  aria-hidden="true"
                >
                  <Inbox className="size-5" />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {mailbox.emailAddress}
                  </p>
                  <p className="truncate text-xs text-slate-500">{mailbox.providerLabel}</p>

                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <StatusBadge state={mailbox.status} size="sm" />
                    <AdminBadge tone={MAILBOX_HEALTH_TONE[mailbox.health.state] ?? 'neutral'} dot>
                      {MAILBOX_HEALTH_LABELS[mailbox.health.state] ?? mailbox.health.state}
                    </AdminBadge>
                    {mailbox.isDefaultForUser && (
                      <AdminBadge tone="warning">
                        <Star className="size-3 fill-current" aria-hidden="true" />
                        Default
                      </AdminBadge>
                    )}
                    <AdminBadge tone="neutral">
                      {mailbox.accessVia === 'connector' ? (
                        <>
                          <Plug className="size-3" aria-hidden="true" />
                          Connected by them
                        </>
                      ) : (
                        'Assigned'
                      )}
                    </AdminBadge>
                  </div>

                  <p className="mt-2 text-xs text-slate-500">{mailbox.health.detail}</p>

                  <dl className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 text-xs">
                    <div>
                      <dt className="text-slate-400">Last sync</dt>
                      <dd className="mt-0.5 text-slate-700">{formatRelative(mailbox.lastSyncAt)}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">Shared with</dt>
                      <dd className="mt-0.5 text-slate-700">
                        {formatCount(mailbox.assignedUserCount)} assigned
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-end gap-1.5 border-t border-slate-100 pt-3">
                <Button as={Link} to={ADMIN_PATHS.MAILBOXES} size="sm" variant="ghost">
                  <ExternalLink className="size-3.5" aria-hidden="true" />
                  View
                </Button>

                {/*
                  Reconnection is an OAuth consent flow that only the mailbox's
                  own owner can complete — it needs their Microsoft session, not
                  an administrator's. Offered as a disabled control with the
                  reason, rather than a button that would send an admin into a
                  consent screen for somebody else's account.
                */}
                <Button
                  size="sm"
                  variant="ghost"
                  disabled
                  title="Reconnection happens from the mailbox owner's own Account screen"
                >
                  <RefreshCw className="size-3.5" aria-hidden="true" />
                  Reconnect
                </Button>

                {mailbox.accessVia === 'connector' ? (
                  <span className="px-2 text-xs text-slate-400">Access cannot be removed</span>
                ) : (
                  <Can do={PERMISSIONS.MAILBOXES_ASSIGN}>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-600 hover:bg-red-50 hover:text-red-700"
                      disabled={busyId === mailbox.id}
                      onClick={() => onRemove(mailbox)}
                    >
                      <UserMinus className="size-3.5" aria-hidden="true" />
                      Remove
                    </Button>
                  </Can>
                )}
              </div>
            </AdminCard>
          ))}
        </div>
      )}

      <p className="mt-3 text-xs text-slate-400">{MAILBOX_CONNECTOR_NOTICE}</p>
    </UserSection>
  )
}

/** Section 4 — recent campaigns this person owns. Read-only. */
export function UserCampaignsSection({ campaigns, isLoading, canSee, registerRef }) {
  const columns = [
    {
      key: 'name',
      header: 'Campaign',
      render: (row) => (
        <AdminTableIdentity
          primary={row.name}
          secondary={row.mailbox ? `via ${row.mailbox}` : 'No sending mailbox'}
        />
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <AdminBadge tone={CAMPAIGN_TONE[row.status] ?? 'neutral'} dot>
          {row.statusLabel ?? row.status}
        </AdminBadge>
      ),
    },
    {
      key: 'sent',
      header: 'Sent',
      align: 'right',
      cellClassName: 'tabular-nums',
      render: (row) => `${formatCount(row.sent)} / ${formatCount(row.recipients)}`,
    },
    {
      key: 'replies',
      header: 'Replies',
      align: 'right',
      cellClassName: 'tabular-nums',
      render: (row) => formatCount(row.replies),
    },
    {
      key: 'createdAt',
      header: 'Created',
      render: (row) => <span className="text-slate-600">{formatDate(row.createdAt)}</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      srOnlyHeader: true,
      align: 'right',
      width: 'w-24',
      render: () => (
        <Button as={Link} to={ADMIN_PATHS.CAMPAIGN_MONITOR} size="sm" variant="ghost">
          View
        </Button>
      ),
    },
  ]

  return (
    <UserSection
      id="campaigns"
      ref={registerRef('campaigns')}
      title="Campaigns"
      description="Campaigns this account owns. Read-only — control them from the campaign monitor."
    >
      {!canSee ? (
        <PendingSection title="You cannot view campaigns">
          This section needs the “View campaigns” and “View cross-user analytics” permissions.
        </PendingSection>
      ) : (
        <AdminCard padded={false}>
          {isLoading ? (
            <AdminTableLoading rows={3} columns={5} />
          ) : (
            <AdminTable
              columns={columns}
              rows={campaigns}
              caption="Campaigns owned by this user"
              empty={
                <AdminEmptyState
                  title="No campaigns"
                  description="This person has not created any campaigns."
                  compact
                />
              }
            />
          )}
        </AdminCard>
      )}
    </UserSection>
  )
}

/** Section 5 — recent enquiries this person owns. Read-only. */
export function UserLeadsSection({ leads, isLoading, canSee, registerRef }) {
  const columns = [
    {
      key: 'reference',
      header: 'Reference',
      render: (row) => (
        <AdminTableIdentity primary={row.reference} secondary={row.customer} />
      ),
    },
    {
      key: 'company',
      header: 'Company',
      render: (row) => row.company ?? <span className="text-slate-400">No company</span>,
    },
    {
      key: 'stage',
      header: 'Status',
      render: (row) => (
        <AdminBadge tone={STAGE_TONE[row.stage] ?? 'neutral'}>
          {row.stageLabel ?? row.stage}
        </AdminBadge>
      ),
    },
    {
      key: 'createdAt',
      header: 'Created',
      render: (row) => <span className="text-slate-600">{formatDate(row.createdAt)}</span>,
    },
    {
      key: 'lastActivityAt',
      header: 'Updated',
      render: (row) => (
        <span className={row.isStale ? 'font-medium text-amber-700' : 'text-slate-600'}>
          {formatRelative(row.lastActivityAt)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      srOnlyHeader: true,
      align: 'right',
      width: 'w-24',
      render: (row) => (
        <Button
          as={Link}
          to={ROUTE_PATHS.LEAD_DETAIL.replace(':id', row.id)}
          size="sm"
          variant="ghost"
        >
          View
        </Button>
      ),
    },
  ]

  return (
    <UserSection
      id="leads"
      ref={registerRef('leads')}
      title="Leads"
      description="Enquiries this account owns, newest first."
    >
      {!canSee ? (
        <PendingSection title="You cannot view leads">
          This section needs the “View enquiries” and “View cross-user analytics” permissions.
        </PendingSection>
      ) : (
        <AdminCard padded={false}>
          {isLoading ? (
            <AdminTableLoading rows={3} columns={5} />
          ) : (
            <AdminTable
              columns={columns}
              rows={leads}
              caption="Enquiries owned by this user"
              empty={
                <AdminEmptyState
                  title="No enquiries"
                  description="This person does not own any enquiries."
                  compact
                />
              }
            />
          )}
        </AdminCard>
      )}
    </UserSection>
  )
}

/**
 * Section 6 — recent replies.
 *
 * There is no per-user reply endpoint. `Conversation` carries an `owner`, so the
 * data exists — but exposing it needs a new admin endpoint, and this phase is a
 * UX upgrade that must not add API surface. The section states that rather than
 * approximating it from something else.
 */
export function UserRepliesSection({ conversationCount, registerRef }) {
  return (
    <UserSection
      id="replies"
      ref={registerRef('replies')}
      title="Replies"
      description="Customer replies on threads this account owns."
    >
      <PendingSection title={`${formatCount(conversationCount)} reply threads owned`}>
        The individual messages are not listed here yet — reading them needs a per-user
        conversation endpoint, which this phase deliberately does not add. The count above is real,
        and every thread is readable in the CRM’s Conversations screen.
      </PendingSection>

      <div className="mt-3">
        <Button as={Link} to={ROUTE_PATHS.DASHBOARD} size="sm" variant="secondary">
          <MessageSquare className="size-3.5" aria-hidden="true" />
          Open Conversations in the CRM
        </Button>
      </div>
    </UserSection>
  )
}

export default UserMailboxesSection
