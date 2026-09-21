/**
 * The register, grouped by the company that sent each enquiry.
 *
 * Backed by `GET /api/v1/admin/companies`.
 *
 * The lead monitor beside this answers "what is falling through". This one
 * answers a different question — *where does the work come from* — which no
 * amount of sorting a list of individual enquiries will show: an agency with
 * 245 queries and one with 3 look identical row by row.
 *
 * ## One row per company, not per company record
 *
 * `Company` is owner-scoped, so the same agency exists as a separate document
 * for every consultant who has quoted for it. The server therefore groups by
 * the name on the lead, case-insensitively, which is the only field that
 * identifies a company the same way across owners. The Owner(s) column is the
 * visible consequence: one row, several people.
 *
 * ## It holds no leads of its own
 *
 * "View queries" hands the company to the lead monitor as a filter on its own
 * URL. That page already owns the register — its table, its columns, its
 * ordering, its pagination — so a company's enquiries are shown by the code
 * that shows every other set of enquiries, not by a second table here that
 * would drift from it.
 *
 * ## Filtering is server-side and lives in the URL
 *
 * The same arrangement as the monitor, for the same reasons: the filters narrow
 * what the server counts, so the totals on screen are the totals of what the
 * filter describes; and the view is linkable, survives a refresh, and Back
 * still means something.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowUpRight, Building2, RefreshCw, X } from 'lucide-react'

import {
  AdminCard,
  AdminEmptyState,
  AdminErrorState,
  AdminFilterSelect,
  AdminPageContainer,
  AdminPagination,
  AdminSearch,
  AdminTable,
  AdminTableIdentity,
} from '@/admin/components'
import { ADMIN_PATHS } from '@/admin/routes/adminPaths'
import { useAdminBreadcrumbs, useAdminResource, useDebouncedValue } from '@/admin/hooks'
import { fetchAdminCompanies, fetchAdminLeads } from '@/admin/services/admin.service'
import { EMPTY, formatCount, formatDate } from '@/admin/utils/format'
import { Button } from '@/components/ui/Button'
import { LEAD_STAGES, MARKETS } from '@/constants/lead.constants'

/** Built from the shared vocabulary, never a local map — see the monitor. */
const STAGE_OPTIONS = LEAD_STAGES.map(({ value, label }) => ({ value, label }))

/** `MARKETS` leads with its own "All markets" entry; the select supplies one. */
const MARKET_OPTIONS = MARKETS.filter((market) => market.value)

/** Named periods, matching the server's `DATE_PRESETS` exactly. */
const DATE_PRESETS = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last7', label: 'Last 7 days' },
  { value: 'last14', label: 'Last 14 days' },
  { value: 'last30', label: 'Last 30 days' },
  { value: 'thisWeek', label: 'This week' },
  { value: 'lastWeek', label: 'Last week' },
  { value: 'thisMonth', label: 'This month' },
  { value: 'lastMonth', label: 'Last month' },
  { value: 'custom', label: 'Custom range…' },
]

/** Which date the range applies to. Every one is a real column on `Lead`. */
const DATE_FIELDS = [
  { value: 'quoteDate', label: 'Query date' },
  { value: 'travelDate', label: 'Travel date' },
  { value: 'createdAt', label: 'Created date' },
  { value: 'updatedAt', label: 'Last activity' },
]

const SORT_OPTIONS = [
  { value: 'queries', label: 'Most queries' },
  { value: 'latest', label: 'Most recent query' },
  { value: 'name', label: 'Company name' },
]

/** Every filter this page owns, so reset and chip-building share one list. */
const FILTER_KEYS = ['search', 'owner', 'city', 'market', 'stage', 'preset', 'from', 'to', 'dateField', 'sort']

export function AdminCompaniesPage() {
  const breadcrumb = useAdminBreadcrumbs()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()

  const read = useCallback((key) => params.get(key) ?? '', [params])

  /** Writes a patch of filters and always returns to page one. */
  const setFilters = useCallback(
    (patch) => {
      const next = new URLSearchParams(params)
      for (const [key, value] of Object.entries(patch)) {
        if (value) next.set(key, value)
        else next.delete(key)
      }
      next.delete('page')
      setParams(next, { replace: true })
    },
    [params, setParams],
  )

  const owner = read('owner')
  const city = read('city')
  const market = read('market')
  const stage = read('stage')
  const dateField = read('dateField') || 'quoteDate'
  const from = read('from')
  const to = read('to')
  const sort = read('sort') || 'queries'
  const urlSearch = read('search')

  // An explicit pair is a custom range, matching the server's own precedence.
  const preset = from || to ? 'custom' : read('preset')

  const page = Number(params.get('page')) || 1
  const limit = Number(params.get('limit')) || 25

  const [searchInput, setSearchInput] = useState(urlSearch)
  const search = useDebouncedValue(searchInput)

  useEffect(() => {
    if (urlSearch === search) return
    const next = new URLSearchParams(params)
    if (search) next.set('search', search)
    else next.delete('search')
    next.delete('page')
    setParams(next, { replace: true })
    // Reacts to the settled term only; re-running on every unrelated parameter
    // would rewrite the URL while the reader is using a different filter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  useEffect(() => {
    if (urlSearch !== search) setSearchInput(urlSearch)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlSearch])

  const query = useMemo(
    () => ({
      search: urlSearch,
      owner,
      city,
      market,
      stage,
      // Only sent alongside a range — on its own it selects nothing.
      dateField: preset || from || to ? dateField : '',
      preset: preset === 'custom' ? '' : preset,
      from,
      to,
      sort,
      page,
      limit,
    }),
    [urlSearch, owner, city, market, stage, dateField, preset, from, to, sort, page, limit],
  )

  const loader = useCallback((options) => fetchAdminCompanies({ ...query, ...options }), [query])
  const { data, error, isLoading, isRefreshing, refresh } = useAdminResource(loader, { deps: [query] })

  /*
   * The owner filter's options.
   *
   * Read from the monitor's own endpoint, which already computes them over the
   * whole register — one request for a facet, rather than a second list of
   * users this page would have to keep in step with that one. `limit: 1`
   * because only `meta.owners` is wanted; the row is discarded.
   */
  const ownerLoader = useCallback(() => fetchAdminLeads({ limit: 1 }), [])
  const { data: ownerFacet } = useAdminResource(ownerLoader, { deps: [] })
  const ownerOptions = ownerFacet?.meta?.owners ?? []

  const items = data?.items ?? []
  const pagination = data?.pagination

  const labelOf = (options, value) => options.find((option) => option.value === value)?.label ?? value

  /** One chip per applied filter, each clearing only itself. */
  const chips = []
  if (urlSearch) chips.push({ key: 'search', label: `“${urlSearch}”`, clear: { search: '' } })
  if (owner) chips.push({ key: 'owner', label: labelOf(ownerOptions, owner), clear: { owner: '' } })
  if (city) chips.push({ key: 'city', label: `City: ${city}`, clear: { city: '' } })
  if (market) chips.push({ key: 'market', label: labelOf(MARKET_OPTIONS, market), clear: { market: '' } })
  if (stage) chips.push({ key: 'stage', label: labelOf(STAGE_OPTIONS, stage), clear: { stage: '' } })
  if (preset) {
    const fieldLabel = labelOf(DATE_FIELDS, dateField)
    chips.push({
      key: 'date',
      label:
        preset === 'custom'
          ? `${fieldLabel}: ${from || '…'} → ${to || '…'}`
          : `${fieldLabel}: ${labelOf(DATE_PRESETS, preset)}`,
      clear: { preset: '', from: '', to: '' },
    })
  }

  const activeFilterCount = chips.length

  const resetFilters = () => {
    setSearchInput('')
    setFilters(Object.fromEntries(FILTER_KEYS.map((key) => [key, ''])))
  }

  /**
   * Opens this company's enquiries on the monitor.
   *
   * The company travels as its own parameter rather than as a search term: the
   * monitor's search also matches a reference, a contact and an email, so a
   * row reading 245 could open a table of 248. The owner and stage filters
   * carry across where they were set, because the count the reader clicked was
   * the count under those filters.
   */
  const viewQueries = (company) => {
    const next = new URLSearchParams({ company: company.name })
    if (owner) next.set('owner', owner)
    if (stage) next.set('stage', stage)
    if (market) next.set('market', market)
    navigate(`${ADMIN_PATHS.LEAD_MONITOR}?${next.toString()}`)
  }

  const columns = useMemo(
    () => [
      {
        key: 'name',
        header: 'Company',
        width: 'w-[26%]',
        render: (row) => (
          <AdminTableIdentity
            primary={row.name}
            leading={
              <span
                className="grid size-7 shrink-0 place-items-center rounded-md bg-brand-50 text-brand-700"
                aria-hidden="true"
              >
                <Building2 className="size-4" />
              </span>
            }
          />
        ),
      },
      {
        key: 'total',
        header: 'Total queries',
        width: 'w-[11%]',
        align: 'right',
        cellClassName: 'metric-figure font-medium text-slate-900',
        render: (row) => formatCount(row.total),
      },
      {
        key: 'active',
        header: 'Active',
        width: 'w-[9%]',
        align: 'right',
        cellClassName: 'metric-figure',
        render: (row) => formatCount(row.active),
      },
      {
        key: 'closed',
        header: 'Closed',
        width: 'w-[9%]',
        align: 'right',
        cellClassName: 'metric-figure',
        render: (row) => formatCount(row.closed),
      },
      {
        key: 'latestQueryAt',
        header: 'Latest query',
        width: 'w-[13%]',
        cellClassName: 'truncate text-slate-600',
        render: (row) => (row.latestQueryAt ? formatDate(row.latestQueryAt) : EMPTY),
      },
      {
        key: 'owners',
        header: 'Owner(s)',
        width: 'w-[18%]',
        cellClassName: 'text-slate-600',
        /*
         * Several people legitimately hold one company's enquiries, which is
         * the whole reason this page groups by name. Two are named and the
         * rest counted, so a company worked by nine consultants does not make
         * its row nine lines tall.
         */
        render: (row) => {
          const owners = row.owners ?? []
          if (owners.length === 0) return <span className="text-slate-400">Unassigned</span>

          const shown = owners.slice(0, 2).map((entry) => entry.name)
          const rest = owners.length - shown.length

          return (
            <span className="block truncate" title={owners.map((entry) => entry.name).join(', ')}>
              {shown.join(', ')}
              {rest > 0 && <span className="text-slate-400"> +{rest}</span>}
            </span>
          )
        },
      },
      {
        key: 'action',
        header: 'Action',
        width: 'w-[14%]',
        align: 'right',
        srOnlyHeader: false,
        render: (row) => (
          <Button variant="secondary" size="sm" onClick={() => viewQueries(row)}>
            View queries
            <ArrowUpRight className="size-3.5" aria-hidden="true" />
          </Button>
        ),
      },
    ],
    // `viewQueries` closes over the current filters, which is deliberate: the
    // link carries the filters the reader is looking at.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [owner, stage, market],
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
        title="Companies"
        subtitle="Which companies send enquiries, and how many"
        breadcrumb={breadcrumb}
        actions={actions}
      >
        <AdminErrorState error={error} onRetry={refresh} />
      </AdminPageContainer>
    )
  }

  return (
    <AdminPageContainer
      title="Companies"
      subtitle="Which companies send enquiries, and how many"
      breadcrumb={breadcrumb}
      isRefreshing={isRefreshing}
      actions={actions}
    >
      <div className="space-y-3">
        {/* --- The controls used daily ---------------------------------- */}
        <div className="rounded-(--radius-card) border border-slate-200 bg-white">
          <div className="flex flex-wrap items-end gap-2.5 p-3">
            <div className="min-w-56 flex-1">
              <AdminSearch
                value={searchInput}
                onChange={setSearchInput}
                placeholder="Search company…"
                label="Search companies"
              />
            </div>

            <AdminFilterSelect
              label="Owner"
              value={owner}
              onChange={(next) => setFilters({ owner: next })}
              options={ownerOptions}
              allLabel="All owners"
              className="w-40"
            />

            <AdminFilterSelect
              label="Destination"
              value={market}
              onChange={(next) => setFilters({ market: next })}
              options={MARKET_OPTIONS}
              allLabel="All destinations"
              className="w-40"
            />

            <AdminFilterSelect
              label="Stage"
              value={stage}
              onChange={(next) => setFilters({ stage: next })}
              options={STAGE_OPTIONS}
              allLabel="All stages"
              className="w-36"
            />

            <AdminFilterSelect
              label="Period"
              value={preset}
              onChange={(next) =>
                setFilters(
                  next === 'custom' ? { preset: 'custom', from: '', to: '' } : { preset: next, from: '', to: '' },
                )
              }
              options={DATE_PRESETS}
              allLabel="Any date"
              className="w-36"
            />

            {preset && (
              <AdminFilterSelect
                label="Date field"
                value={dateField}
                onChange={(next) => setFilters({ dateField: next })}
                options={DATE_FIELDS}
                includeAll={false}
                className="w-36"
              />
            )}

            <AdminFilterSelect
              label="Sort"
              value={sort}
              onChange={(next) => setFilters({ sort: next })}
              options={SORT_OPTIONS}
              includeAll={false}
              className="w-40"
            />

            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" onClick={resetFilters}>
                Clear
              </Button>
            )}
          </div>

          {/* The city filter is free text, so it sits with the custom range
              rather than in the row of dropdowns. */}
          <div className="flex flex-wrap items-end gap-3 border-t border-slate-100 px-3 pb-3 pt-2.5">
            <label className="text-[11px] font-medium text-slate-600">
              City
              <input
                type="text"
                value={city}
                onChange={(event) => setFilters({ city: event.target.value })}
                placeholder="Any city"
                className="mt-1 block rounded-(--radius-control) border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
            </label>

            {preset === 'custom' &&
              [
                { key: 'from', label: 'From' },
                { key: 'to', label: 'To' },
              ].map((bound) => (
                <label key={bound.key} className="text-[11px] font-medium text-slate-600">
                  {bound.label}
                  <input
                    type="date"
                    value={bound.key === 'from' ? from : to}
                    onChange={(event) => setFilters({ [bound.key]: event.target.value })}
                    className="mt-1 block rounded-(--radius-control) border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  />
                </label>
              ))}
          </div>

          {/* Active filters take vertical space only while some are set. */}
          {chips.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-100 px-3 py-2.5">
              <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-slate-500">Active</span>
              {chips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => setFilters(chip.clear)}
                  className="inline-flex max-w-full items-center gap-1 rounded-(--radius-control) bg-slate-100 py-1 pl-2 pr-1.5 text-xs text-slate-700 transition-colors hover:bg-slate-200"
                >
                  <span className="truncate">{chip.label}</span>
                  <X className="size-3 shrink-0 text-slate-500" aria-hidden="true" />
                  <span className="sr-only">Remove this filter</span>
                </button>
              ))}
              <button
                type="button"
                onClick={resetFilters}
                className="ml-auto rounded-(--radius-control) px-2 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
              >
                Clear all
              </button>
            </div>
          )}
        </div>

        {/* How many companies the current filter describes — the whole set,
            from the server, never the length of the page on screen. */}
        <p className="px-1 text-[11px] font-medium uppercase tracking-[0.06em] text-slate-500">
          {isLoading ? (
            <span className="skeleton inline-block h-3 w-28 align-middle" />
          ) : (
            `Showing ${formatCount(pagination?.total ?? 0)} ${pagination?.total === 1 ? 'company' : 'companies'}`
          )}
        </p>

        <AdminCard padded={false} className="overflow-clip!">
          <AdminTable
            /* The monitor's table behaviour: fits its container, sticky
               header, no horizontal scroll. Same recipe, same reasons. */
            className="overflow-x-clip! [&>table]:min-w-0 [&>table]:table-fixed [&_thead_th]:top-(--spacing-topbar) [&_thead_th]:bg-slate-50 [&_thead_th]:backdrop-blur-none [&_thead_th]:shadow-[0_1px_0_0_var(--color-slate-200)]"
            columns={columns}
            rows={items}
            isLoading={isLoading}
            caption="Companies by number of enquiries"
            empty={
              activeFilterCount > 0 ? (
                <AdminEmptyState
                  variant="filtered"
                  title="No companies match your current filters"
                  description="Every filter is combined, so a narrow set of them can exclude everything — which may be the answer you wanted."
                  actionLabel="Clear filters"
                  onAction={resetFilters}
                  compact
                />
              ) : (
                <AdminEmptyState
                  title="No companies yet"
                  description="A company appears here as soon as one of its enquiries is recorded — by hand, from a workbook, or captured from a reply."
                />
              )
            }
          />

          {/* Every page is reachable; totals come from the API. */}
          {!isLoading && pagination?.total > 0 && (
            <div className="border-t border-slate-100 px-4 py-2.5">
              <AdminPagination
                page={pagination.page}
                pageSize={pagination.limit}
                totalItems={pagination.total}
                onPageChange={(next) => {
                  const updated = new URLSearchParams(params)
                  if (next > 1) updated.set('page', String(next))
                  else updated.delete('page')
                  setParams(updated, { replace: true })
                }}
                onPageSizeChange={(next) => setFilters({ limit: String(next) })}
                disabled={isRefreshing}
              />
            </div>
          )}
        </AdminCard>
      </div>
    </AdminPageContainer>
  )
}

export default AdminCompaniesPage
