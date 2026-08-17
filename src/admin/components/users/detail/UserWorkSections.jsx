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

import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ExternalLink,
  Inbox,
  MessageSquare,
  Plug,
  RefreshCw,
  Star,
  Trash2,
  UserMinus,
} from 'lucide-react'

import { AdminBadge } from '@/admin/components/AdminBadge'
import { AdminCard } from '@/admin/components/AdminCard'
import { AdminModal } from '@/admin/components/AdminModal'
import { AdminPagination } from '@/admin/components/AdminPagination'
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
export function UserLeadsSection({
  leads,
  total,
  isLoading,
  canSee,
  registerRef,
  canDelete = false,
  onDelete,
  /** Whose register this is. Named in the delete-all confirmation. */
  userName,
  page = 1,
  pageSize = 50,
  onPageChange,
}) {
  /**
   * Selection, and the pending confirmation.
   *
   * `confirm` holds the *intent* rather than a boolean, so the dialog can render
   * one message per shape and the handler has everything it needs.
   */
  const [selected, setSelected] = useState([])
  const [confirm, setConfirm] = useState(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(null)

  const rowIds = leads.map((lead) => lead.id)
  const allChecked = rowIds.length > 0 && rowIds.every((id) => selected.includes(id))

  const toggle = (id) =>
    setSelected((previous) =>
      previous.includes(id) ? previous.filter((x) => x !== id) : [...previous, id],
    )

  /**
   * Runs the confirmed deletion.
   *
   * `busy` gates both the buttons and this function, so a double click cannot
   * send the request twice. Selection is cleared only on success — a failure
   * leaves the rows ticked so the admin can retry without re-selecting.
   */
  const run = async () => {
    if (!confirm || busy) return

    setBusy(true)
    setNotice(null)

    try {
      const payload = confirm.kind === 'all' ? { all: true } : { leadIds: confirm.ids }
      const result = await onDelete(payload)

      setConfirm(null)
      setSelected([])

      // The server's numbers, not the count that was asked for — they differ
      // when an id matched nothing, and that difference is worth showing.
      const skipped = result?.skipped?.length ?? 0
      setNotice(
        `${(result?.deleted ?? 0).toLocaleString()} enquiry/enquiries deleted.` +
          (skipped > 0 ? ` ${skipped} could not be matched and were left alone.` : ''),
      )
    } catch (error) {
      setNotice(error?.message ?? 'The enquiries could not be deleted.')
    } finally {
      setBusy(false)
    }
  }

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

  const selectionColumn = {
    key: '__select',
    header: (
      <input
        type="checkbox"
        aria-label="Select all enquiries on this page"
        className="size-4"
        checked={allChecked}
        onChange={(event) => setSelected(event.target.checked ? rowIds : [])}
      />
    ),
    render: (lead) => (
      <input
        type="checkbox"
        aria-label={`Select ${lead.reference}`}
        className="size-4"
        checked={selected.includes(lead.id)}
        onChange={() => toggle(lead.id)}
      />
    ),
  }

  const deleteColumn = {
    key: '__delete',
    header: '',
    render: (lead) => (
      <button
        type="button"
        onClick={() => setConfirm({ kind: 'one', ids: [lead.id], lead })}
        disabled={busy}
        className="rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
        aria-label={`Delete ${lead.reference}`}
        title="Delete this enquiry"
      >
        <Trash2 className="size-4" aria-hidden="true" />
      </button>
    ),
  }

  // The controls appear only for a caller the server would accept anyway.
  const tableColumns = canDelete ? [selectionColumn, ...columns, deleteColumn] : columns

  return (
    <UserSection
      id="leads"
      ref={registerRef('leads')}
      title="Leads"
      description={
        // The database's count for this person, not the number of preview rows.
        typeof total === 'number'
          ? `${total.toLocaleString()} enquiry/enquiries this account owns. Newest first.`
          : 'Enquiries this account owns, newest first.'
      }
    >
      {!canSee ? (
        <PendingSection title="You cannot view leads">
          This section needs the “View enquiries” and “View cross-user analytics” permissions.
        </PendingSection>
      ) : (
        <AdminCard padded={false}>
          {canDelete && !isLoading && (leads.length > 0 || selected.length > 0) && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-2.5">
              <span className="text-xs text-slate-500">
                {selected.length > 0
                  ? `${selected.length} selected`
                  : 'Select enquiries to delete, or delete the whole register.'}
              </span>
              <div className="flex flex-wrap gap-2">
                {selected.length > 0 && (
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={busy}
                    onClick={() => setConfirm({ kind: 'selected', ids: selected })}
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                    Delete selected ({selected.length})
                  </Button>
                )}
                {/* Deliberately the most destructive control here, and disabled
                    when the register is already empty. */}
                <Button
                  variant="danger"
                  size="sm"
                  disabled={busy || !total}
                  onClick={() => setConfirm({ kind: 'all' })}
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                  Delete all leads
                </Button>
              </div>
            </div>
          )}

          {notice && (
            <p role="status" className="border-b border-slate-100 px-5 py-2 text-xs text-slate-600">
              {notice}
            </p>
          )}

          {isLoading ? (
            <AdminTableLoading rows={3} columns={5} />
          ) : (
            <AdminTable
              columns={tableColumns}
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

          {/* One page is one request; the totals come from the server. */}
          {!isLoading && typeof total === 'number' && total > 0 && (
            <div className="border-t border-slate-100 px-5 py-3">
              <AdminPagination
                page={page}
                pageSize={pageSize}
                totalItems={total}
                onPageChange={onPageChange}
                disabled={busy}
              />
            </div>
          )}
        </AdminCard>
      )}

      <AdminModal
        isOpen={Boolean(confirm)}
        onClose={() => (busy ? null : setConfirm(null))}
        busy={busy}
        title={
          confirm?.kind === 'all'
            ? (userName ? `Delete all leads for ${userName}?` : 'Delete all enquiries?')
            : confirm?.kind === 'selected'
              ? `Delete ${confirm.ids.length} enquiries?`
              : 'Delete this enquiry?'
        }
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setConfirm(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={run} isLoading={busy} loadingLabel="Deleting…">
              {confirm?.kind === 'all' ? 'Delete all' : 'Delete'}
            </Button>
          </>
        }
      >
        {confirm?.kind === 'all' ? (
          <p className="text-sm text-slate-700">
            This will permanently delete{' '}
            <strong>all {(total ?? 0).toLocaleString()} leads</strong> belonging to{' '}
            <strong>{userName ?? 'this user'}</strong>,
            along with their timeline. <strong>This cannot be undone.</strong>
          </p>
        ) : confirm?.kind === 'selected' ? (
          <p className="text-sm text-slate-700">
            This will remove <strong>{confirm.ids.length}</strong> enquiry/enquiries from the CRM.
          </p>
        ) : (
          <p className="text-sm text-slate-700">
            This will remove <strong>{confirm?.lead?.reference}</strong> from the CRM.
          </p>
        )}
      </AdminModal>
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
