/**
 * Campaign monitoring, across every user.
 *
 * Backed by `GET /api/v1/admin/campaigns`. The CRM's own campaigns page shows a
 * user their own campaigns; this shows an administrator everybody's, which is a
 * different question and needs two columns the CRM view does not have: who owns
 * the campaign, and which mailbox it sends through.
 *
 * Progress counters come from `Campaign.stats`, which the campaign engine
 * maintains as it sends — not recounted from recipients, so this screen and the
 * campaign's own detail page can never show different numbers.
 *
 * Pause and cancel stay disabled. When they are wired in Phase 14.4 they call
 * the campaign module's existing `control` service: an admin pausing a campaign
 * and its owner pausing it must be the same operation, or one of the two paths
 * will eventually leave a campaign half-stopped.
 */

import { useCallback, useMemo, useState } from 'react'
import { Pause, Play, RefreshCw, Square } from 'lucide-react'

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
import { ADMIN_TONE } from '@/admin/constants/admin.constants'
import { useAdminBreadcrumbs, useAdminResource, useDebouncedValue } from '@/admin/hooks'
import { fetchAdminCampaigns } from '@/admin/services/admin.service'
import { formatCount, formatRelative } from '@/admin/utils/format'
import { Button } from '@/components/ui/Button'
import { AuditEventList } from '@/admin/components/audit/AuditEventList'
import { auditLinkFor } from '@/admin/constants/audit.constants'

const STATUS_TONE = {
  draft: 'neutral',
  scheduled: 'info',
  running: 'success',
  paused: 'warning',
  completed: 'neutral',
  cancelled: 'neutral',
  archived: 'neutral',
}

const STATUS_OPTIONS = Object.keys(STATUS_TONE).map((value) => ({
  value,
  label: value.charAt(0).toUpperCase() + value.slice(1),
}))

export function AdminCampaignMonitorPage() {
  const breadcrumb = useAdminBreadcrumbs()

  const [searchInput, setSearchInput] = useState('')
  const [status, setStatus] = useState('')
  const search = useDebouncedValue(searchInput)

  const loader = useCallback(
    (options) => fetchAdminCampaigns({ search, status, ...options }),
    [search, status],
  )

  const { data, error, isLoading, isRefreshing, refresh } = useAdminResource(loader, {
    deps: [search, status],
  })

  const items = data?.items ?? []
  const summary = data?.summary
  const activeFilterCount = [search, status].filter(Boolean).length

  const resetFilters = () => {
    setSearchInput('')
    setStatus('')
  }

  const columns = useMemo(
    () => [
      {
        key: 'name',
        header: 'Campaign',
        render: (campaign) => (
          <AdminTableIdentity
            primary={campaign.name}
            secondary={campaign.mailbox ? `via ${campaign.mailbox}` : 'No sending mailbox set'}
          />
        ),
      },
      {
        key: 'status',
        header: 'Status',
        render: (campaign) => (
          <AdminBadge tone={STATUS_TONE[campaign.status] ?? 'neutral'} dot>
            {campaign.statusLabel ?? campaign.status}
          </AdminBadge>
        ),
      },
      { key: 'owner', header: 'Owner', cellClassName: 'text-slate-600' },
      {
        key: 'progress',
        header: 'Progress',
        width: 'w-48',
        render: (campaign) => {
          const percent =
            campaign.recipients === 0 ? 0 : Math.round((campaign.sent / campaign.recipients) * 100)

          return (
            <div className="min-w-36">
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="tabular-nums text-slate-600">
                  {formatCount(campaign.sent)} / {formatCount(campaign.recipients)}
                </span>
                <span className="tabular-nums text-slate-400">{percent}%</span>
              </div>
              {/* The track is a lighter surface step, not a lighter step of the
                  fill hue, so an empty bar never reads as a partly filled one. */}
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full ${
                    campaign.failed > 0 && campaign.sent === 0 ? 'bg-red-500' : 'bg-brand-600'
                  }`}
                  style={{ width: `${Math.max(percent, campaign.recipients === 0 ? 0 : 1)}%` }}
                />
              </div>
            </div>
          )
        },
      },
      {
        key: 'replies',
        header: 'Replies',
        align: 'right',
        cellClassName: 'tabular-nums',
        render: (campaign) => formatCount(campaign.replies),
      },
      {
        key: 'failed',
        header: 'Failed',
        align: 'right',
        cellClassName: 'tabular-nums',
        render: (campaign) => (
          <span className={campaign.failed > 0 ? 'font-medium text-red-600' : 'text-slate-500'}>
            {formatCount(campaign.failed)}
          </span>
        ),
      },
      {
        key: 'startedAt',
        header: 'Started',
        render: (campaign) => (
          <span className="text-slate-600">
            {campaign.startedAt ? formatRelative(campaign.startedAt) : 'Not started'}
          </span>
        ),
      },
      {
        key: 'actions',
        header: 'Actions',
        srOnlyHeader: true,
        align: 'right',
        width: 'w-28',
        render: (campaign) => (
          <div className="flex items-center justify-end gap-1">
            <Button
              size="sm"
              variant="ghost"
              disabled
              title="Campaign control arrives in a later phase"
              aria-label="Pause or resume campaign"
            >
              {campaign.status === 'paused' ? (
                <Play className="size-3.5" aria-hidden="true" />
              ) : (
                <Pause className="size-3.5" aria-hidden="true" />
              )}
            </Button>
            <Button size="sm" variant="ghost" disabled aria-label="Cancel campaign">
              <Square className="size-3.5" aria-hidden="true" />
            </Button>
          </div>
        ),
      },
    ],
    [],
  )

  const actions = (
    <Button variant="secondary" size="sm" onClick={refresh} isLoading={isRefreshing}>
      <RefreshCw className="size-3.5" aria-hidden="true" />
      Refresh
    </Button>
  )

  if (error) {
    return (
      <AdminPageContainer
        title="Campaign monitor"
        subtitle="Every campaign in the deployment, whoever launched it"
        breadcrumb={breadcrumb}
        actions={actions}
      >
        <AdminErrorState error={error} onRetry={refresh} />
      </AdminPageContainer>
    )
  }

  return (
    <AdminPageContainer
      title="Campaign monitor"
      subtitle="Every campaign in the deployment, whoever launched it"
      breadcrumb={breadcrumb}
      isRefreshing={isRefreshing}
      actions={actions}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard label="Running now" value={formatCount(summary?.running)} tone={ADMIN_TONE.SUCCESS} isLoading={isLoading} />
        <AdminStatCard label="Scheduled" value={formatCount(summary?.scheduled)} tone={ADMIN_TONE.BRAND} isLoading={isLoading} />
        <AdminStatCard label="Total recipients" value={formatCount(summary?.recipients)} isLoading={isLoading} />
        <AdminStatCard
          label="Failed sends"
          value={formatCount(summary?.failed)}
          tone={summary?.failed > 0 ? ADMIN_TONE.DANGER : ADMIN_TONE.NEUTRAL}
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
              placeholder="Search campaign name…"
              label="Search campaigns"
            />
          }
        >
          <AdminFilterSelect
            label="Status"
            value={status}
            onChange={setStatus}
            options={STATUS_OPTIONS}
            allLabel="All statuses"
          />
        </AdminFilterBar>

        <AdminTable
          columns={columns}
          rows={items}
          isLoading={isLoading}
          caption="Campaigns across every user in the deployment"
          empty={
            activeFilterCount > 0 ? (
              <AdminEmptyState
                variant="filtered"
                title="No campaigns match these filters"
                description="Try a different status, or clear the filters."
                actionLabel="Clear filters"
                onAction={resetFilters}
                compact
              />
            ) : (
              <AdminEmptyState
                title="No campaigns yet"
                description="Campaigns launched from anywhere in the CRM appear here while they run."
              />
            )
          }
        />
      </AdminCard>

      {/* Phase 14.7. The table above is live campaign *state*; this is the
          record of who changed it. A campaign that is paused tells you nothing
          about who paused it or when — that answer is only here. */}
      <AdminCard
        title="Recent campaign events"
        description="Creation, edits, starts, pauses and completions across every user"
      >
        <AuditEventList
          filter={{ category: 'campaign' }}
          limit={10}
          emptyMessage="No campaign actions have been recorded since audit recording began."
          viewAllTo={auditLinkFor({ category: 'campaign' })}
        />
      </AdminCard>
    </AdminPageContainer>
  )
}

export default AdminCampaignMonitorPage
