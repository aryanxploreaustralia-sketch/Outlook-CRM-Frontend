/**
 * Mailbox administration.
 *
 * Backed by `GET /api/v1/admin/mailboxes`. Since Phase 14.5 the registry is also
 * where assignment happens: which people may send through each mailbox, and
 * whose default it is.
 *
 * ## No token material reaches this screen
 *
 * The endpoint never selects `sourceAccount`, so the link to the encrypted OAuth
 * grant is not even loaded, and the DTO builds its response field by field from
 * an allowlist. Two independent reasons for the same outcome.
 *
 * ## Health is derived, and the screen says so
 *
 * The server does not probe Microsoft per mailbox — that would be a call into
 * the mailbox engine on every render. Health is inferred from the connection
 * status and the last recorded successful sync, and is labelled as inference
 * rather than presented as a live check.
 */

import { useCallback, useMemo, useState } from 'react'
import { Plug, RefreshCw, Star, UserPlus, Users } from 'lucide-react'

import {
  AdminBadge,
  AdminCard,
  AdminEmptyState,
  AdminErrorState,
  AdminFilterBar,
  AdminFilterSelect,
  AdminPageContainer,
  AdminSearch,
  AdminStatCard,
  AdminTable,
  AdminTableIdentity,
} from '@/admin/components'
import { MailboxDetailDrawer } from '@/admin/components/mailboxes/MailboxDetailDrawer'
import { ADMIN_SCOPE_NOTICE, ADMIN_TONE } from '@/admin/constants/admin.constants'
import {
  MAILBOX_HEALTH_LABELS,
  MAILBOX_HEALTH_OPTIONS,
  MAILBOX_HEALTH_TONE,
  MAILBOX_STATUS_OPTIONS,
} from '@/admin/constants/mailbox.constants'
import { useAdminBreadcrumbs, useAdminResource, useDebouncedValue } from '@/admin/hooks'
import { fetchAdminMailboxes } from '@/admin/services/admin.service'
import { formatCount, formatDate, formatRelative } from '@/admin/utils/format'
import { StatusBadge } from '@/components/common/StatusBadge'
import { UserAvatar } from '@/components/common/UserAvatar'
import { Button } from '@/components/ui/Button'

const NO_FILTERS = { search: '', status: '', provider: '', health: '' }

export function AdminMailboxesPage() {
  const breadcrumb = useAdminBreadcrumbs()

  const [filters, setFilters] = useState(NO_FILTERS)
  const [detailId, setDetailId] = useState(null)

  const search = useDebouncedValue(filters.search)

  const query = useMemo(
    () => ({ search, status: filters.status, provider: filters.provider, health: filters.health }),
    [search, filters.status, filters.provider, filters.health],
  )

  const loader = useCallback((options) => fetchAdminMailboxes({ ...query, ...options }), [query])

  const { data, error, isLoading, isRefreshing, refresh } = useAdminResource(loader, {
    deps: [query],
  })

  const items = data?.items ?? []
  const summary = data?.summary

  const setFilter = (key) => (value) => setFilters((previous) => ({ ...previous, [key]: value }))
  const resetFilters = () => setFilters(NO_FILTERS)

  const activeFilterCount = Object.values(filters).filter(Boolean).length

  const providerOptions = useMemo(
    () => (data?.providers ?? []).map((value) => ({ value, label: value })),
    [data?.providers],
  )

  const columns = useMemo(
    () => [
      {
        key: 'emailAddress',
        header: 'Mailbox',
        render: (mailbox) => (
          <AdminTableIdentity
            primary={mailbox.emailAddress ?? mailbox.displayName ?? 'Unnamed mailbox'}
            secondary={mailbox.providerLabel}
          />
        ),
      },
      {
        key: 'status',
        header: 'Status',
        render: (mailbox) => (
          <div className="space-y-1">
            <StatusBadge state={mailbox.status} size="sm" />
            {mailbox.statusReason && (
              <p className="max-w-48 text-xs text-slate-500">{mailbox.statusReason}</p>
            )}
          </div>
        ),
      },
      {
        key: 'health',
        header: 'Health',
        render: (mailbox) => (
          <div className="min-w-0 space-y-1">
            <AdminBadge tone={MAILBOX_HEALTH_TONE[mailbox.health.state] ?? 'neutral'} dot>
              {MAILBOX_HEALTH_LABELS[mailbox.health.state] ?? mailbox.health.state}
            </AdminBadge>
            <p className="max-w-56 text-xs text-slate-500">{mailbox.health.detail}</p>
          </div>
        ),
      },
      {
        key: 'connectedBy',
        header: 'Connected by',
        render: (mailbox) =>
          mailbox.connectedBy ? (
            <div className="flex min-w-0 items-center gap-2">
              <UserAvatar
                name={mailbox.connectedBy.displayName}
                email={mailbox.connectedBy.email}
                size="xs"
              />
              <div className="min-w-0">
                <p className="truncate text-slate-700">
                  {mailbox.connectedBy.displayName ?? mailbox.connectedBy.email}
                </p>
                <p className="truncate text-xs text-slate-400">
                  {formatDate(mailbox.connectedAt)}
                </p>
              </div>
            </div>
          ) : (
            <span className="text-xs text-slate-400">Owner not found</span>
          ),
      },
      {
        key: 'lastSyncAt',
        header: 'Last sync',
        render: (mailbox) => (
          <div>
            <p className="text-slate-600">{formatRelative(mailbox.lastSyncAt)}</p>
            <p className="text-xs text-slate-400">
              {mailbox.syncEnabled ? 'Sync enabled' : 'Sync disabled'}
            </p>
          </div>
        ),
      },
      {
        key: 'assignedUserCount',
        header: 'Users',
        align: 'right',
        render: (mailbox) => (
          <div className="flex items-center justify-end gap-2.5">
            <span
              className="flex items-center gap-1 tabular-nums text-slate-600"
              title="People who may send through this mailbox, besides the person who connected it"
            >
              <Users className="size-3.5 text-slate-400" aria-hidden="true" />
              {mailbox.assignedUserCount}
            </span>
            {mailbox.defaultUserCount > 0 && (
              <span
                className="flex items-center gap-1 tabular-nums text-amber-600"
                title="People for whom this is their default sending mailbox"
              >
                <Star className="size-3.5 fill-current" aria-hidden="true" />
                {mailbox.defaultUserCount}
              </span>
            )}
          </div>
        ),
      },
      {
        key: 'actions',
        header: 'Actions',
        srOnlyHeader: true,
        align: 'right',
        width: 'w-32',
        render: (mailbox) => (
          <Button size="sm" variant="ghost" onClick={() => setDetailId(mailbox.id)}>
            <UserPlus className="size-3.5" aria-hidden="true" />
            Manage
          </Button>
        ),
      },
    ],
    [],
  )

  const actions = (
    <>
      <Button variant="secondary" size="sm" onClick={refresh} isLoading={isRefreshing}>
        <RefreshCw className="size-3.5" aria-hidden="true" />
        Refresh
      </Button>
      <Button size="sm" disabled title="Mailboxes are connected from the CRM's Account screen">
        <Plug className="size-3.5" aria-hidden="true" />
        Connect mailbox
      </Button>
    </>
  )

  if (error) {
    return (
      <AdminPageContainer
        title="Mailboxes"
        subtitle="Who may send through each connected mailbox"
        breadcrumb={breadcrumb}
        actions={actions}
      >
        <AdminErrorState error={error} onRetry={refresh} />
      </AdminPageContainer>
    )
  }

  return (
    <AdminPageContainer
      title="Mailboxes"
      subtitle="Who may send through each connected mailbox"
      breadcrumb={breadcrumb}
      notice={`${ADMIN_SCOPE_NOTICE} Health is inferred from recorded sync outcomes, not from a live provider probe.`}
      isRefreshing={isRefreshing}
      actions={actions}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard label="Total mailboxes" value={formatCount(summary?.total)} isLoading={isLoading} />
        <AdminStatCard
          label="Connected"
          value={formatCount(summary?.connected)}
          tone={ADMIN_TONE.SUCCESS}
          isLoading={isLoading}
        />
        <AdminStatCard
          label="Needs attention"
          value={formatCount(summary?.needsAttention)}
          tone={summary?.needsAttention > 0 ? ADMIN_TONE.DANGER : ADMIN_TONE.NEUTRAL}
          isLoading={isLoading}
        />
        <AdminStatCard
          label="Nobody assigned"
          value={formatCount(summary?.unassigned)}
          tone={summary?.unassigned > 0 ? ADMIN_TONE.WARNING : ADMIN_TONE.NEUTRAL}
          hint="Only the person who connected it can send"
          isLoading={isLoading}
        />
      </div>

      <AdminCard padded={false}>
        <AdminFilterBar
          activeCount={activeFilterCount}
          onReset={resetFilters}
          search={
            <AdminSearch
              value={filters.search}
              onChange={setFilter('search')}
              placeholder="Search address or name…"
              label="Search mailboxes"
            />
          }
        >
          <AdminFilterSelect
            label="Status"
            value={filters.status}
            onChange={setFilter('status')}
            options={MAILBOX_STATUS_OPTIONS}
            allLabel="All statuses"
          />
          <AdminFilterSelect
            label="Health"
            value={filters.health}
            onChange={setFilter('health')}
            options={MAILBOX_HEALTH_OPTIONS}
            allLabel="All health states"
          />
          <AdminFilterSelect
            label="Provider"
            value={filters.provider}
            onChange={setFilter('provider')}
            options={providerOptions}
            allLabel="All providers"
          />
        </AdminFilterBar>

        <AdminTable
          columns={columns}
          rows={items}
          isLoading={isLoading}
          onRowClick={(mailbox) => setDetailId(mailbox.id)}
          caption="Mailboxes connected to this deployment"
          empty={
            activeFilterCount > 0 ? (
              <AdminEmptyState
                variant="filtered"
                title="No mailboxes match these filters"
                description="Try a different status, health state or provider."
                actionLabel="Clear filters"
                onAction={resetFilters}
                compact
              />
            ) : (
              <AdminEmptyState
                title="No mailboxes connected"
                description="Mailboxes are connected from the CRM's Account screen. Until one is, the CRM cannot send or read mail."
              />
            )
          }
        />
      </AdminCard>

      <MailboxDetailDrawer
        mailboxId={detailId}
        isOpen={Boolean(detailId)}
        onClose={() => setDetailId(null)}
        onChanged={refresh}
      />
    </AdminPageContainer>
  )
}

export default AdminMailboxesPage
