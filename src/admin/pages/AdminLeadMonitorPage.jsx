/**
 * Lead monitoring, across every user.
 *
 * Backed by `GET /api/v1/admin/leads`.
 *
 * The admin question is not "what are my enquiries" — the CRM answers that. It
 * is *what is falling through*: enquiries nobody owns, and enquiries nobody has
 * touched in weeks. Both are their own stat tile and their own one-click filter,
 * because a problem you have to construct a query to find is a problem that gets
 * found late.
 *
 * ## Two honest limitations, stated in the interface
 *
 * `Lead` has no `assignedTo` field yet — the Phase 14.0 design adds it, and
 * adding a field is a schema change this phase must not make. The column shows
 * the owner, which is the truthful answer to "whose is this" under the current
 * model.
 *
 * `Lead` also records no last-activity timestamp of its own, so staleness is
 * measured from `updatedAt`. That moves on every stage change, edit and
 * auto-mail attempt, which is close enough to "somebody has touched this" to be
 * useful — and the server says which field it used rather than letting the
 * column imply a conversation timestamp.
 */

import { useCallback, useMemo, useState } from 'react'
import { RefreshCw, UserCheck } from 'lucide-react'

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
import { ADMIN_SCOPE_NOTICE, ADMIN_TONE } from '@/admin/constants/admin.constants'
import { useAdminBreadcrumbs, useAdminResource, useDebouncedValue } from '@/admin/hooks'
import { fetchAdminLeads } from '@/admin/services/admin.service'
import { EMPTY, formatCount, formatDate } from '@/admin/utils/format'
import { Button } from '@/components/ui/Button'

/** Tone per stage. The label always carries the meaning as well. */
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

const STAGE_OPTIONS = Object.keys(STAGE_TONE).map((value) => ({
  value,
  label: value.replace(/_/g, ' ').replace(/^./, (character) => character.toUpperCase()),
}))

export function AdminLeadMonitorPage() {
  const breadcrumb = useAdminBreadcrumbs()

  const [searchInput, setSearchInput] = useState('')
  const [stage, setStage] = useState('')
  const [attention, setAttention] = useState('')
  const search = useDebouncedValue(searchInput)

  const loader = useCallback(
    (options) => fetchAdminLeads({ search, stage, attention, ...options }),
    [search, stage, attention],
  )

  const { data, error, isLoading, isRefreshing, refresh } = useAdminResource(loader, {
    deps: [search, stage, attention],
  })

  const items = data?.items ?? []
  const summary = data?.summary
  const staleAfterDays = data?.meta?.staleAfterDays ?? 30
  const activeFilterCount = [search, stage, attention].filter(Boolean).length

  const attentionOptions = [
    { value: 'unassigned', label: 'Unassigned' },
    { value: 'stale', label: `No activity for ${staleAfterDays}+ days` },
  ]

  const resetFilters = () => {
    setSearchInput('')
    setStage('')
    setAttention('')
  }

  const columns = useMemo(
    () => [
      {
        key: 'reference',
        header: 'Reference',
        render: (lead) => (
          <AdminTableIdentity primary={lead.reference} secondary={lead.company ?? 'No company'} />
        ),
      },
      {
        key: 'customer',
        header: 'Customer',
        render: (lead) => (
          <div className="min-w-0">
            <p className="truncate text-slate-700">{lead.customer}</p>
            {lead.email && <p className="truncate text-xs text-slate-500">{lead.email}</p>}
          </div>
        ),
      },
      {
        key: 'stage',
        header: 'Stage',
        render: (lead) => (
          <AdminBadge tone={STAGE_TONE[lead.stage] ?? 'neutral'}>
            {lead.stageLabel ?? lead.stage}
          </AdminBadge>
        ),
      },
      {
        key: 'assignedTo',
        header: 'Owner',
        render: (lead) => lead.assignedTo ?? <AdminBadge tone="warning">Unassigned</AdminBadge>,
      },
      { key: 'market', header: 'Market', cellClassName: 'text-slate-600' },
      {
        key: 'autoMailStatus',
        header: 'Introduction',
        render: (lead) =>
          lead.autoMailStatus ? (
            <AdminBadge
              tone={
                lead.autoMailStatus === 'sent'
                  ? 'success'
                  : lead.autoMailStatus === 'failed'
                    ? 'danger'
                    : 'neutral'
              }
            >
              {lead.autoMailStatus}
            </AdminBadge>
          ) : (
            EMPTY
          ),
      },
      {
        key: 'lastActivityDays',
        header: 'Last activity',
        render: (lead) => (
          <span className={lead.isStale ? 'font-medium text-amber-700' : 'tabular-nums text-slate-600'}>
            {lead.lastActivityDays === 0 ? 'Today' : `${lead.lastActivityDays}d ago`}
          </span>
        ),
      },
      {
        key: 'createdAt',
        header: 'Created',
        render: (lead) => <span className="text-slate-600">{formatDate(lead.createdAt)}</span>,
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
      <Button size="sm" disabled title="Reassignment arrives in a later phase">
        <UserCheck className="size-3.5" aria-hidden="true" />
        Bulk reassign
      </Button>
    </>
  )

  if (error) {
    return (
      <AdminPageContainer
        title="Lead monitor"
        subtitle="Pipeline health across every consultant"
        breadcrumb={breadcrumb}
        actions={actions}
      >
        <AdminErrorState error={error} onRetry={refresh} />
      </AdminPageContainer>
    )
  }

  return (
    <AdminPageContainer
      title="Lead monitor"
      subtitle="Pipeline health across every consultant — what is unowned and what has gone quiet"
      breadcrumb={breadcrumb}
      notice={`${ADMIN_SCOPE_NOTICE} Last activity is the record's last modification, not a conversation timestamp.`}
      isRefreshing={isRefreshing}
      actions={actions}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard label="Enquiries in view" value={formatCount(summary?.total)} isLoading={isLoading} />
        <AdminStatCard
          label="Unassigned"
          value={formatCount(summary?.unassigned)}
          tone={summary?.unassigned > 0 ? ADMIN_TONE.WARNING : ADMIN_TONE.NEUTRAL}
          hint="Nobody is working these"
          isLoading={isLoading}
        />
        <AdminStatCard
          label={`Stale (${staleAfterDays}d+)`}
          value={formatCount(summary?.stale)}
          tone={summary?.stale > 0 ? ADMIN_TONE.DANGER : ADMIN_TONE.NEUTRAL}
          hint="No modification recorded"
          isLoading={isLoading}
        />
        <AdminStatCard
          label="Booked or completed"
          value={formatCount(summary?.won)}
          tone={ADMIN_TONE.SUCCESS}
          isLoading={isLoading}
        />
      </div>

      <AdminCard padded={false}>
        <AdminFilterBar
          activeCount={activeFilterCount}
          onReset={resetFilters}
          search={
            <AdminSearch
              value={searchInput}
              onChange={setSearchInput}
              placeholder="Search reference, customer, company…"
              label="Search enquiries"
            />
          }
        >
          <AdminFilterSelect
            label="Stage"
            value={stage}
            onChange={setStage}
            options={STAGE_OPTIONS}
            allLabel="All stages"
          />
          <AdminFilterSelect
            label="Attention"
            value={attention}
            onChange={setAttention}
            options={attentionOptions}
            allLabel="No attention filter"
          />
        </AdminFilterBar>

        <AdminTable
          columns={columns}
          rows={items}
          isLoading={isLoading}
          caption="Enquiries across every consultant"
          empty={
            activeFilterCount > 0 ? (
              <AdminEmptyState
                variant="filtered"
                title="No enquiries match these filters"
                description="Nothing here is unassigned or stale under the current filters — which may be the answer you wanted."
                actionLabel="Clear filters"
                onAction={resetFilters}
                compact
              />
            ) : (
              <AdminEmptyState
                title="No enquiries yet"
                description="Enquiries created by hand, imported from a workbook, or captured from a reply all appear here."
              />
            )
          }
        />
      </AdminCard>
    </AdminPageContainer>
  )
}

export default AdminLeadMonitorPage
