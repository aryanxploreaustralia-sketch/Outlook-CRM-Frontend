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
 * ## Filtering is server-side, and lives in the URL
 *
 * Every filter is a query parameter on this page's own address, for the reason
 * `useDateRange` gives for the reporting period: a filtered register that cannot
 * be linked to is a view only the person who built it can see, and Back stops
 * meaning anything. Refresh, Back and a pasted link all reproduce the same rows.
 *
 * The filters go to the server rather than narrowing an array here. The register
 * runs to thousands of enquiries and the page holds fifty of them, so filtering
 * what arrived would filter the current page — the total would keep saying
 * 1,671 while the table showed three rows out of the fifty that happened to load.
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

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { RefreshCw, UserCheck, X } from 'lucide-react'

import {
  AdminBadge,
  AdminCard,
  AdminEmptyState,
  AdminErrorState,
  AdminFilterBar,
  AdminFilterSelect,
  AdminPageContainer,
  AdminPagination,
  AdminSearch,
  AdminStatCard,
  AdminTable,
  AdminTableIdentity,
} from '@/admin/components'
import { ADMIN_SCOPE_NOTICE, ADMIN_TONE } from '@/admin/constants/admin.constants'
import { ADMIN_PATHS } from '@/admin/routes/adminPaths'
import { useAdminBreadcrumbs, useAdminResource, useDebouncedValue } from '@/admin/hooks'
import { fetchAdminLeads } from '@/admin/services/admin.service'
import { EMPTY, formatCount, formatDate } from '@/admin/utils/format'
import { RemarkCell } from '@/components/leads/RemarkCell'
import { Button } from '@/components/ui/Button'
import { LEAD_STAGES, MARKETS } from '@/constants/lead.constants'

/**
 * The Stage filter's options, derived from the shared vocabulary.
 *
 * Never from a local map. This file used to carry a `STAGE_TONE` table listing
 * the ten stages the CRM used before the register was reduced to the workbook's
 * own words; building the filter from its keys offered ten dead options and none
 * of the live ones — a filter that could only return nothing. The map went with
 * the Stage column it coloured, but the rule it taught is the reason this line
 * reads from `LEAD_STAGES`.
 *
 * The filter itself is unaffected by the column's removal: it narrows the query,
 * and the stage is still on every row of the response and on the lead's detail.
 */
const STAGE_OPTIONS = LEAD_STAGES.map(({ value, label }) => ({ value, label }))

/** `MARKETS` leads with its own "All markets" entry; the select supplies one. */
const MARKET_OPTIONS = MARKETS.filter((market) => market.value)

/**
 * Named periods, matching the server's `DATE_PRESETS` exactly.
 *
 * Only the name travels. The server resolves it, so "last 7 days" has one
 * boundary for everybody rather than one per browser timezone — the same
 * reasoning `AdminDateRange` documents for the analytics period.
 *
 * There is no default. An absent preset means no date clause at all, which is
 * what a register should show: asking for "the enquiries" and silently getting
 * the last thirty days of them is a lie about how many exist.
 */
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

/**
 * Which date the range applies to.
 *
 * Every one of these is a real column on `Lead`. `quoteDate` is the enquiry's
 * own date and is labelled "Query date", the term the rest of the CRM uses for
 * it. There is deliberately no follow-up option: the model records no follow-up
 * date, and an option that quietly filtered something else would be worse than
 * its absence.
 *
 * **Travel date is first, and is the default.** It is the enquiry's operative
 * business date and the one the table now shows; defaulting to `createdAt`
 * meant the column read "travel date" while the range silently narrowed on when
 * the record was written. The other three stay available — they answer real
 * questions ("what came in last week?") and a saved URL naming one still works.
 */
const DATE_FIELDS = [
  { value: 'travelDate', label: 'Travel date' },
  { value: 'quoteDate', label: 'Query date' },
  { value: 'createdAt', label: 'Created date' },
  { value: 'updatedAt', label: 'Last activity' },
]

const ACTIVITY_OPTIONS = [
  { value: 'recent', label: 'Recently active' },
  { value: 'quiet', label: 'No recent activity' },
  { value: 'replied', label: 'Replied' },
  { value: 'awaiting', label: 'Awaiting reply' },
]

/** Every filter this page owns, so reset and chip-building share one list. */
const FILTER_KEYS = [
  'search',
  'stage',
  'market',
  'introduction',
  'owner',
  'attention',
  'activity',
  'preset',
  'from',
  'to',
  'dateField',
]

export function AdminLeadMonitorPage() {
  const breadcrumb = useAdminBreadcrumbs()
  const [params, setParams] = useSearchParams()

  const read = useCallback((key) => params.get(key) ?? '', [params])

  /**
   * Writes a patch of filters, and always returns to page one.
   *
   * Page 7 of an unfiltered register is rarely page 7 of a search, and an empty
   * table reads as "no enquiries" rather than "no page 7" — so the page number
   * is dropped on every filter change rather than left to be wrong.
   *
   * `replace` for the same reason `useDateRange` uses it: refining a view is not
   * navigation, and Back should leave the monitor rather than step back through
   * every dropdown that was tried.
   */
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

  const stage = read('stage')
  const market = read('market')
  const introduction = read('introduction')
  const owner = read('owner')
  const attention = read('attention')
  const activity = read('activity')
  const dateField = read('dateField') || 'travelDate'
  const from = read('from')
  const to = read('to')
  const urlSearch = read('search')

  // An explicit pair is a custom range; the preset name is dropped when one is
  // set, matching the server's own precedence.
  const preset = from || to ? 'custom' : read('preset')

  const page = Number(params.get('page')) || 1
  const limit = Number(params.get('limit')) || 50

  /**
   * The search box types locally and settles into the URL.
   *
   * Writing every keystroke to the address would put a history entry and a
   * request behind each letter. The debounce is the existing `useDebouncedValue`
   * the page already used — the only change is where the settled value lands.
   */
  const [searchInput, setSearchInput] = useState(urlSearch)
  const search = useDebouncedValue(searchInput)

  useEffect(() => {
    if (urlSearch === search) return
    const next = new URLSearchParams(params)
    if (search) next.set('search', search)
    else next.delete('search')
    next.delete('page')
    setParams(next, { replace: true })
    // `params` is deliberately absent: this effect reacts to the settled search
    // term, and re-running it on every unrelated parameter change would rewrite
    // the URL while the reader is using a different filter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  /*
   * Back, forward and pasted links move the URL underneath the input.
   *
   * Guarded against the page's own writes: while a slow typist is mid-word the
   * URL holds the previous settled term, and syncing unconditionally would snap
   * the box back to it and eat the letters just typed. When the URL differs from
   * what this page last settled on, the change came from outside.
   */
  useEffect(() => {
    if (urlSearch !== search) setSearchInput(urlSearch)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlSearch])

  const query = useMemo(
    () => ({
      search: urlSearch,
      stage,
      market,
      introduction,
      owner,
      attention,
      activity,
      // Only sent alongside a range — on its own it selects nothing and would
      // just be noise in the request.
      dateField: preset || from || to ? dateField : '',
      preset: preset === 'custom' ? '' : preset,
      from,
      to,
      page,
      limit,
    }),
    [urlSearch, stage, market, introduction, owner, attention, activity, dateField, preset, from, to, page, limit],
  )

  const loader = useCallback((options) => fetchAdminLeads({ ...query, ...options }), [query])

  // `useAdminResource` aborts the superseded request and guards the response by
  // id, so changing three filters quickly cannot land an older answer last.
  const { data, error, isLoading, isRefreshing, refresh } = useAdminResource(loader, {
    deps: [query],
  })

  const items = data?.items ?? []
  const summary = data?.summary
  const pagination = data?.pagination
  const meta = data?.meta
  const staleAfterDays = meta?.staleAfterDays ?? 30
  const activeWithinDays = meta?.activeWithinDays ?? 7

  /*
   * Owners come from the response, not a constant.
   *
   * They are whoever holds an enquiry today, which no client-side list can know.
   * The server computes them over the whole register rather than the current
   * filter, so choosing an owner does not remove every other owner from the
   * dropdown you would use to change your mind.
   */
  const ownerOptions = meta?.owners ?? []
  const introductionOptions = meta?.introductionStatuses ?? []

  const attentionOptions = [
    { value: 'unassigned', label: 'Unassigned' },
    { value: 'stale', label: `No activity for ${staleAfterDays}+ days` },
  ]

  const activityOptions = ACTIVITY_OPTIONS.map((option) =>
    option.value === 'recent'
      ? { ...option, label: `Active in ${activeWithinDays} days` }
      : option.value === 'quiet'
        ? { ...option, label: `Quiet for ${activeWithinDays}+ days` }
        : option,
  )

  const labelOf = (options, value) => options.find((option) => option.value === value)?.label ?? value

  /**
   * One chip per applied filter, each clearing only itself.
   *
   * A custom range is a single chip over two parameters, because "from" without
   * "to" is half a thought — removing one and leaving the other would apply a
   * filter the reader believed they had just cleared.
   */
  const chips = []
  if (urlSearch) chips.push({ key: 'search', label: `“${urlSearch}”`, clear: { search: '' } })
  if (stage) chips.push({ key: 'stage', label: labelOf(STAGE_OPTIONS, stage), clear: { stage: '' } })
  if (market) chips.push({ key: 'market', label: labelOf(MARKET_OPTIONS, market), clear: { market: '' } })
  if (owner) chips.push({ key: 'owner', label: labelOf(ownerOptions, owner), clear: { owner: '' } })
  if (introduction) {
    chips.push({
      key: 'introduction',
      label: `Introduction: ${labelOf(introductionOptions, introduction)}`,
      clear: { introduction: '' },
    })
  }
  if (attention) {
    chips.push({ key: 'attention', label: labelOf(attentionOptions, attention), clear: { attention: '' } })
  }
  if (activity) {
    chips.push({ key: 'activity', label: labelOf(activityOptions, activity), clear: { activity: '' } })
  }
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

  const columns = useMemo(
    () => [
      {
        key: 'reference',
        header: 'Reference',
        /*
         * The reference opens the enquiry, addressed by id rather than by the
         * text in the cell. Two enquiries can carry the same reference — the
         * workbook is typed by hand — and `_id` is what the detail endpoint
         * loads, so resolving the displayed string back to a record would be
         * both slower and capable of opening the wrong one.
         */
        render: (lead) => (
          <AdminTableIdentity
            primary={lead.reference}
            secondary={lead.company ?? 'No company'}
            to={ADMIN_PATHS.LEAD_DETAIL.replace(':id', lead.id)}
          />
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
        key: 'assignedTo',
        header: 'Owner',
        render: (lead) => lead.assignedTo ?? <AdminBadge tone="warning">Unassigned</AdminBadge>,
      },
      { key: 'market', header: 'Market', cellClassName: 'text-slate-600' },
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
        key: 'remarks',
        header: 'Remarks',
        // Truncated to one line; clicking opens the whole remark.
        width: 'max-w-64',
        render: (lead) => (
          <RemarkCell
            remarks={lead.remarks}
            reference={lead.reference}
            className="max-w-64 text-slate-600"
            emptyFallback={<span className="text-slate-400">{EMPTY}</span>}
          />
        ),
      },
      {
        key: 'travelDate',
        header: 'Travel date',
        // Prose travel dates are shown as written. Created is still a filter
        // option above, and still shown on the lead's detail page.
        render: (lead) => (
          <span className="text-slate-600">
            {lead.travelDate ? formatDate(lead.travelDate) : (lead.travelDateText ?? EMPTY)}
          </span>
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
              placeholder="Search reference, customer, company, email, phone…"
              label="Search enquiries"
            />
          }
        >
          <AdminFilterSelect
            label="Stage"
            value={stage}
            onChange={(next) => setFilters({ stage: next })}
            options={STAGE_OPTIONS}
            allLabel="All stages"
          />
          <AdminFilterSelect
            label="Owner"
            value={owner}
            onChange={(next) => setFilters({ owner: next })}
            options={ownerOptions}
            allLabel="All owners"
          />
          <AdminFilterSelect
            label="Market"
            value={market}
            onChange={(next) => setFilters({ market: next })}
            options={MARKET_OPTIONS}
            allLabel="All markets"
          />
          <AdminFilterSelect
            label="Introduction"
            value={introduction}
            onChange={(next) => setFilters({ introduction: next })}
            options={introductionOptions}
            allLabel="Any introduction"
          />
          <AdminFilterSelect
            label="Attention"
            value={attention}
            onChange={(next) => setFilters({ attention: next })}
            options={attentionOptions}
            allLabel="No attention filter"
          />
          <AdminFilterSelect
            label="Activity"
            value={activity}
            onChange={(next) => setFilters({ activity: next })}
            options={activityOptions}
            allLabel="Any activity"
          />
          <AdminFilterSelect
            label="Period"
            value={preset}
            onChange={(next) =>
              // Leaving custom clears the explicit pair, or it would keep
              // overriding the named period the reader just chose.
              setFilters(
                next === 'custom'
                  ? { preset: 'custom', from: '', to: '' }
                  : { preset: next, from: '', to: '' },
              )
            }
            options={DATE_PRESETS}
            allLabel="Any date"
          />

          {/*
            The date field only appears once a period is chosen. On its own it
            selects nothing, and a permanently visible control that does nothing
            is how a filter row stops being read.
          */}
          {preset && (
            <AdminFilterSelect
              label="Date field"
              value={dateField}
              onChange={(next) => setFilters({ dateField: next })}
              options={DATE_FIELDS}
              /*
                No "all" row. `dateField` always holds one of DATE_FIELDS —
                it coalesces to 'travelDate' — so an empty option could never
                be selected, and labelling it duplicated the first entry.
              */
              includeAll={false}
            />
          )}
        </AdminFilterBar>

        {/*
          The custom pair, on its own row so two date inputs do not have to fit
          a filter track sized for a dropdown.
        */}
        {preset === 'custom' && (
          <div className="flex flex-wrap items-end gap-3 border-b border-slate-100 px-6 py-3">
            {[
              { key: 'from', label: 'From' },
              { key: 'to', label: 'To' },
            ].map((bound) => (
              <label key={bound.key} className="min-w-0 text-xs font-medium text-slate-600">
                {bound.label}
                <input
                  type="date"
                  value={bound.key === 'from' ? from : to}
                  onChange={(event) => setFilters({ [bound.key]: event.target.value })}
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </label>
            ))}
            <p className="py-2 text-xs text-slate-500">
              Applied to {labelOf(DATE_FIELDS, dateField).toLowerCase()}. Either bound may be left open.
            </p>
          </div>
        )}

        {/* Active filters, each removable on its own. */}
        {chips.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-6 py-3">
            <span className="text-xs font-medium text-slate-500">Active filters</span>
            {chips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={() => setFilters(chip.clear)}
                className="inline-flex max-w-full items-center gap-1 rounded-full border border-slate-200 bg-slate-50 py-1 pl-2.5 pr-2 text-xs text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30"
              >
                <span className="truncate">{chip.label}</span>
                <X className="size-3 shrink-0 text-slate-400" aria-hidden="true" />
                <span className="sr-only">Remove this filter</span>
              </button>
            ))}
            <button
              type="button"
              onClick={resetFilters}
              className="ml-auto rounded-md px-2 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              Clear all
            </button>
          </div>
        )}

        <AdminTable
          columns={columns}
          rows={items}
          isLoading={isLoading}
          caption="Enquiries across every consultant"
          empty={
            activeFilterCount > 0 ? (
              <AdminEmptyState
                variant="filtered"
                title="No leads match your current filters"
                description="Every filter is combined, so a narrow set of them can exclude everything — which may be the answer you wanted."
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

        {/* Every page is reachable; totals come from the API, never the row count. */}
        {!isLoading && pagination?.total > 0 && (
          <div className="border-t border-slate-100 px-5 py-3">
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
    </AdminPageContainer>
  )
}

export default AdminLeadMonitorPage
