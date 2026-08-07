/**
 * Campaign list.
 *
 * The section's home: every campaign with its live progress, plus the controls
 * that do not need the detail page (pause, resume, cancel, clone). Holds no
 * transport code — `useCampaignList` owns data and mutations.
 */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Copy,
  Megaphone,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Search,
  Square,
} from 'lucide-react'

import { CampaignProgress } from '@/components/campaigns/CampaignProgress'
import { CampaignStatusBadge } from '@/components/campaigns/CampaignStatusBadge'
import { ErrorScreen } from '@/components/common/ErrorScreen'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { AVAILABLE_CONTROLS, CAMPAIGN_FILTERS, CONTROL_LABELS } from '@/constants/campaign.constants'
import { useCampaignList } from '@/hooks/useCampaigns'
import { ROUTE_PATHS } from '@/routes/paths'
import { resolveErrorVariant } from '@/utils/apiError'

const PAGE_SIZE = 25

const CONTROL_ICONS = { pause: Pause, resume: Play, cancel: Square, archive: Copy }

export function CampaignsPage() {
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')

  const { items, pagination, isInitialLoading, isLoading, isError, error, refresh, action, isBusy, actionError, control, clone } =
    useCampaignList({ page, limit: PAGE_SIZE, status, search })

  /** Debounced so typing does not fire a request per keystroke. */
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(1)
    }, 350)
    return () => clearTimeout(timer)
  }, [searchInput])

  if (isError && items.length === 0) {
    return <ErrorScreen variant={resolveErrorVariant(error)} error={error} onRetry={() => refresh()} />
  }

  const totalPages = pagination?.totalPages ?? 1

  return (
    <div className="space-y-6">
      {/* --- Toolbar ------------------------------------------------------ */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search campaigns"
            aria-label="Search campaigns"
            className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <select
          value={status}
          onChange={(event) => {
            setStatus(event.target.value)
            setPage(1)
          }}
          aria-label="Filter by status"
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        >
          {CAMPAIGN_FILTERS.map((filter) => (
            <option key={filter.value || 'all'} value={filter.value}>
              {filter.label}
            </option>
          ))}
        </select>

        <Button variant="secondary" onClick={() => refresh()} disabled={isLoading}>
          <RefreshCw className={`size-4 ${isLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
          Refresh
        </Button>

        <Button as={Link} to={ROUTE_PATHS.CAMPAIGN_ANALYTICS} variant="secondary">
          <BarChart3 className="size-4" aria-hidden="true" />
          Analytics
        </Button>

        <Button as={Link} to={ROUTE_PATHS.CAMPAIGN_NEW}>
          <Plus className="size-4" aria-hidden="true" />
          New campaign
        </Button>
      </div>

      {actionError && (
        <p role="alert" className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-inset ring-rose-200">
          {actionError?.message ?? 'That action could not be completed.'}
        </p>
      )}

      {/* --- List --------------------------------------------------------- */}
      {isInitialLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
          <Megaphone className="mx-auto size-8 text-slate-300" aria-hidden="true" />
          <h2 className="mt-3 text-base font-semibold text-slate-900">No campaigns yet</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
            A campaign sends one message to many contacts, personalised per recipient, at a rate
            that keeps your mailbox out of trouble.
          </p>
          <Button as={Link} to={ROUTE_PATHS.CAMPAIGN_NEW} className="mt-5">
            <Plus className="size-4" aria-hidden="true" />
            Create your first campaign
          </Button>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((campaign) => {
            const controls = AVAILABLE_CONTROLS[campaign.status] ?? []

            return (
              <li key={campaign.id} className="rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-300">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        to={ROUTE_PATHS.CAMPAIGN_DETAIL.replace(':id', campaign.id)}
                        className="truncate text-sm font-semibold text-slate-900 hover:text-blue-600"
                      >
                        {campaign.name}
                      </Link>
                      <CampaignStatusBadge status={campaign.status} />
                      {campaign.sequenceStep > 0 && (
                        <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-200">
                          Follow-up {campaign.sequenceStep}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-slate-500">{campaign.subject || 'No subject yet'}</p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {controls.map((verb) => {
                      const Icon = CONTROL_ICONS[verb] ?? Play
                      return (
                        <Button
                          key={verb}
                          variant="ghost"
                          size="sm"
                          disabled={isBusy}
                          isLoading={action === `control:${campaign.id}`}
                          onClick={() => control(campaign.id, verb)}
                          title={CONTROL_LABELS[verb]}
                        >
                          <Icon className="size-4" aria-hidden="true" />
                          <span className="sr-only">{CONTROL_LABELS[verb]}</span>
                        </Button>
                      )
                    })}
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={isBusy}
                      isLoading={action === `clone:${campaign.id}`}
                      onClick={() => clone(campaign.id)}
                      title="Duplicate as a new draft"
                    >
                      <Copy className="size-4" aria-hidden="true" />
                      <span className="sr-only">Duplicate</span>
                    </Button>
                  </div>
                </div>

                <div className="mt-3">
                  <CampaignProgress stats={campaign.stats} percentComplete={campaign.percentComplete} />
                </div>

                {campaign.status === 'running' && campaign.estimatedCompletion && (
                  <p className="mt-2 text-xs text-slate-500">
                    {campaign.remaining.toLocaleString()} remaining — estimated finish{' '}
                    {new Date(campaign.estimatedCompletion).toLocaleString()}
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {/* --- Pagination --------------------------------------------------- */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-200 pt-4">
          <p className="text-sm text-slate-500">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="size-4" aria-hidden="true" />
              Previous
            </Button>
            <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
              <ChevronRight className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export default CampaignsPage
