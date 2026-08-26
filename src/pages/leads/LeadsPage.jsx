/**
 * The enquiry register.
 *
 * One row per quotation enquiry, which is what the sales workbook records —
 * not one row per person. A contact with 183 open enquiries appears 183 times
 * here, and that is correct.
 */

import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Download,
  Filter,
  Megaphone,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react'

import { deleteAllLeads, exportLeads, fetchPurgePreview } from '@/api/services/lead.service'
import { DeleteAllLeadsDialog } from '@/components/leads/DeleteAllLeadsDialog'
import { AdminFilterSelect } from '@/admin/components/AdminFilter'
import { DateRangeFilter } from '@/components/filters/DateRangeFilter'
import { FilterPopover } from '@/components/filters/FilterPopover'
import { LeadStageBadge } from '@/components/leads/LeadStageBadge'
import { RemarkCell } from '@/components/leads/RemarkCell'
import { ErrorScreen } from '@/components/common/ErrorScreen'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { STORAGE_KEYS } from '@/constants/app.constants'
import { LEAD_STAGES, MARKETS } from '@/constants/lead.constants'

/**
 * Destinations, without the "all" entry — `AdminFilterSelect` supplies that
 * itself from `allLabel`, and leaving the source's blank option in would show
 * it twice.
 */
const MARKET_OPTIONS = MARKETS.filter((market) => market.value)

/**
 * The two date filters face opposite directions.
 *
 * Travel is ahead of the consultant and a quote is behind them, so the presets
 * differ even though the control is the same. Every key here is one
 * `DATE_WINDOWS` knows how to resolve.
 */
const TRAVEL_PRESETS = [
  { value: 'today', label: 'Today' },
  { value: 'tomorrow', label: 'Tomorrow' },
  { value: 'next7', label: 'Next 7 days' },
  { value: 'next14', label: 'Next 14 days' },
  { value: 'next30', label: 'Next 30 days' },
  { value: 'next60', label: 'Next 60 days' },
]

const QUOTE_PRESETS = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last7', label: 'Last 7 days' },
  { value: 'last30', label: 'Last 30 days' },
  { value: 'thisMonth', label: 'This month' },
  { value: 'lastMonth', label: 'Last month' },
]

/** The empty window, so "cleared" means one thing in every place it is used. */
const NO_RANGE = { preset: '', from: '', to: '' }
import { useColumnOrder } from '@/hooks/useColumnOrder'
import { useLeadFacets, useLeadList } from '@/hooks/useLeads'
import { ROUTE_PATHS } from '@/routes/paths'
import { resolveErrorVariant } from '@/utils/apiError'
import { formatDate } from '@/utils/datetime'

const PAGE_SIZE = 50


export function LeadsPage() {
  const [page, setPage] = useState(1)
  const [stage, setStage] = useState('')
  const [city, setCity] = useState('')
  const [market, setMarket] = useState('')
  const [handledBy, setHandledBy] = useState('')
  const [travelMonth, setTravelMonth] = useState('')
  /*
   * Seeded from the URL, so the dashboard's "Campaign ready" figure can open
   * the enquiries behind it.
   *
   * The initialiser runs once, which is what makes this a deep link rather
   * than a lock: clearing the filter afterwards works normally and the URL is
   * not rewritten. `1` and `true` are both accepted — the dashboard sends the
   * former, the select below uses the latter — and anything else is ignored,
   * so a stray parameter cannot put the page into a state its own controls
   * cannot describe.
   */
  /*
   * Seeded from the URL, so the dashboard's "Campaign ready" figure can open
   * the enquiries behind it.
   *
   * Read through the router rather than `window.location`, which keeps this
   * testable and cannot throw where there is no `window`.
   *
   * The initialiser runs once, which is what makes this a deep link rather
   * than a lock: clearing the filter afterwards works normally and the URL is
   * not rewritten. `1` and `true` are both accepted — the dashboard sends the
   * former, the select below uses the latter — and anything else is ignored,
   * so a stray parameter cannot put the page into a state its own controls
   * cannot describe.
   */
  const [searchParams] = useSearchParams()
  const [travelRange, setTravelRange] = useState(NO_RANGE)
  const [quoteRange, setQuoteRange] = useState(NO_RANGE)

  const [campaignEligible, setCampaignEligible] = useState(() => {
    const requested = searchParams.get('campaignEligible')
    return requested === '1' || requested === 'true' ? 'true' : ''
  })
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(() => new Set())

  const { facets, refresh: refreshFacets } = useLeadFacets()

  const { items, pagination, isInitialLoading, isLoading, isError, error, refresh, isBusy, actionError, moveStage } =
    useLeadList({
      page,
      limit: PAGE_SIZE,
      stage,
      city,
      market,
      handledBy,
      travelMonth,
      campaignEligible,
      /*
       * Two independent windows, as plain calendar dates.
       *
       * Undefined when unset, and `fetchLeads` drops undefined keys — so a
       * register with no date filter sends no date parameters at all and the
       * server adds no date clause.
       */
      travelFrom: travelRange.from || undefined,
      travelTo: travelRange.to || undefined,
      quoteFrom: quoteRange.from || undefined,
      quoteTo: quoteRange.to || undefined,
      search,
    })

  // --- Delete all -----------------------------------------------------------
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [purgeCounts, setPurgeCounts] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(null)
  const [deleteNotice, setDeleteNotice] = useState(null)

  /** Opens the dialog, fetching a measured count to show inside it. */
  const openDeleteDialog = async () => {
    setDeleteError(null)
    setPurgeCounts(null)
    setIsDeleteOpen(true)

    try {
      setPurgeCounts(await fetchPurgePreview())
    } catch {
      // A missing count is not a reason to block the dialog — it falls back to
      // wording that does not name a number.
      setPurgeCounts(null)
    }
  }

  const confirmDelete = async () => {
    setIsDeleting(true)
    setDeleteError(null)

    try {
      const result = await deleteAllLeads()

      setIsDeleteOpen(false)
      setDeleteNotice(result.message ?? 'All Leads deleted successfully.')
      setSelected(new Set())
      setPage(1)

      // Filters selecting values that have just ceased to exist would leave the
      // page looking empty for the wrong reason. Cleared before the refetch, so
      // the request that follows is the one worth making.
      clearFilters()

      // The register and its filter facets are both stale now — the dropdowns
      // are built from the rows, so without this they keep offering cities and
      // agents that no longer match anything.
      await Promise.all([refresh(), refreshFacets()])

      // The dashboard reads its own counters; a full reload is heavy, so the
      // notice tells the user where the numbers will catch up.
      setTimeout(() => setDeleteNotice(null), 8000)
    } catch (error) {
      setDeleteError(
        error?.response?.data?.message ??
          error?.message ??
          'The leads could not be deleted.',
      )
    } finally {
      setIsDeleting(false)
    }
  }

  // --- Export ---------------------------------------------------------------
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState(null)

  /**
   * Downloads the register as it is currently filtered.
   *
   * The same criteria the list is reading with, minus pagination — an export is
   * every matching row, not the visible page. The browser saves the file; there
   * is nothing to navigate to afterwards.
   */
  const handleExport = async () => {
    setIsExporting(true)
    setExportError(null)

    try {
      const result = await exportLeads({
        stage,
        city,
        market,
        handledBy,
        travelMonth,
        campaignEligible,
        // The date windows too, or the workbook would hold a different set of
        // rows from the one on screen — the exact mismatch this export avoids.
        travelFrom: travelRange.from || undefined,
        travelTo: travelRange.to || undefined,
        quoteFrom: quoteRange.from || undefined,
        quoteTo: quoteRange.to || undefined,
        search,
      })

      if (result.truncated) {
        setExportError(
          `The workbook contains the first ${result.count.toLocaleString()} leads. ` +
            'Narrow the filters to export the rest.',
        )
      }
    } catch (caught) {
      setExportError(caught?.message ?? 'The workbook could not be generated.')
    } finally {
      setIsExporting(false)
    }
  }

  /** Debounced so typing does not fire a request per keystroke. */
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(1)
    }, 350)
    return () => clearTimeout(timer)
  }, [searchInput])

  // Selection is cleared when the visible set changes, or a hidden lead could
  // be silently included in a bulk stage change.
  useEffect(() => {
    setSelected(new Set())
  }, [page, stage, city, market, handledBy, travelMonth, campaignEligible, travelRange, quoteRange, search])

  const activeFilters = useMemo(
    () =>
      [stage, city, market, handledBy, travelMonth, campaignEligible, travelRange.preset, quoteRange.preset]
        .filter(Boolean).length,
    [stage, city, market, handledBy, travelMonth, campaignEligible, travelRange.preset, quoteRange.preset],
  )

  /*
   * How many of the filters live behind "More filters" are set.
   *
   * Destination and the period sit on the bar itself, so counting them in the
   * button's badge would promise filters the drawer does not contain.
   */
  const drawerFilterCount = useMemo(
    () => [city, handledBy, travelMonth, campaignEligible].filter(Boolean).length,
    [city, handledBy, travelMonth, campaignEligible],
  )

  /*
   * The register's columns, in their default order.
   *
   * Each entry owns both its heading and its cell, so the two cannot drift
   * apart when the reader reorders them — `useColumnOrder` returns these same
   * objects in a different sequence and the table maps over that one array
   * twice. Selection stays pinned outside this list.
   *
   * Static, so the memo has no dependencies: every cell reads from the `lead`
   * it is handed rather than from anything in scope.
   */
  const columnDefs = useMemo(
    () => [
      {
        key: 'reference',
        header: 'Reference',
        cellClassName: 'whitespace-nowrap px-3 py-2',
        render: (lead) => (
          <Link
            to={ROUTE_PATHS.LEAD_DETAIL.replace(':id', lead.id)}
            className="font-mono text-xs font-medium text-blue-600 hover:underline"
          >
            {lead.reference}
          </Link>
        ),
      },
      {
        key: 'contact',
        header: 'Contact',
        cellClassName: 'max-w-48 px-3 py-2',
        render: (lead) => (
          <>
            <span className="block truncate text-slate-900">{lead.contactPerson}</span>
            <span className="block truncate text-xs text-slate-400">{lead.email}</span>
          </>
        ),
      },
      {
        key: 'company',
        header: 'Company',
        cellClassName: 'max-w-48 truncate px-3 py-2 text-slate-600',
        render: (lead) => lead.companyName ?? '—',
      },
      {
        key: 'travel',
        header: 'Travel',
        cellClassName: 'whitespace-nowrap px-3 py-2 text-slate-500',
        // Prose travel dates like "August" are shown as written — the sheet's
        // only timing signal for those enquiries.
        render: (lead) =>
          lead.travelDate ? formatDate(lead.travelDate) : (lead.travelDateText ?? '—'),
      },
      {
        key: 'pax',
        header: 'Pax',
        cellClassName: 'whitespace-nowrap px-3 py-2 text-slate-500',
        render: (lead) => lead.paxText ?? '—',
      },
      {
        key: 'remarks',
        header: 'Remarks',
        // One truncated line keeps the row height fixed; clicking it opens the
        // whole remark. Column width is unchanged.
        cellClassName: 'max-w-56 px-3 py-2 text-slate-500',
        render: (lead) => <RemarkCell remarks={lead.internalNotes} reference={lead.reference} />,
      },
      {
        key: 'stage',
        header: 'Stage',
        cellClassName: 'whitespace-nowrap px-3 py-2',
        render: (lead) => (
          <LeadStageBadge stage={lead.stage} showEligibility eligible={lead.campaignEligible} />
        ),
      },
    ],
    [],
  )

  const columnOrder = useColumnOrder(STORAGE_KEYS.LEAD_COLUMNS_CRM, columnDefs)

  /*
   * The rail's control class. One height, one radius, one focus ring for every
   * select in the panel — which is most of what makes a filter list read as a
   * list rather than as six unrelated controls.
   */
  const FIELD =
    'mt-1 w-full rounded-(--radius-control) border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20'

  const label = (text) => (
    <span className="block text-[11px] font-medium text-slate-500">{text}</span>
  )

  /*
   * Every control below is the one that was in the toolbar, unchanged: same
   * state, same `onChange`, same `setPage(1)`. Only the container is new.
   */
  const advancedFilterGroups = [
    {
      id: 'status',
      title: 'Lead status',
      /* Stage moved to the filter bar. Leaving a second control here bound to
         the same state would give one filter two homes. */
      content: (
        <>
          <label className="block">
            {label('Campaign')}
            <select
              value={campaignEligible}
              onChange={(event) => { setCampaignEligible(event.target.value); setPage(1) }}
              className={FIELD}
            >
              <option value="">All leads</option>
              <option value="true">Campaign-ready only</option>
            </select>
          </label>
        </>
      ),
    },
    {
      id: 'ownership',
      title: 'Ownership',
      content: (
        <label className="block">
          {label('Handled by')}
          <select
            value={handledBy}
            onChange={(event) => { setHandledBy(event.target.value); setPage(1) }}
            className={FIELD}
          >
            <option value="">Anyone</option>
            {facets.handledBy.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>
      ),
    },
    {
      id: 'destination',
      title: 'Departure',
      /* Destination moved to the filter bar, for the same reason as Stage. */
      content: (
        <>
          <label className="block">
            {label('Departure city')}
            <select
              value={city}
              onChange={(event) => { setCity(event.target.value); setPage(1) }}
              className={FIELD}
            >
              <option value="">All cities</option>
              {facets.cities.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>
        </>
      ),
    },
    {
      id: 'dates',
      title: 'Dates',
      content: (
        <label className="block">
          {label('Travel month')}
          <select
            value={travelMonth}
            onChange={(event) => { setTravelMonth(event.target.value); setPage(1) }}
            className={FIELD}
          >
            <option value="">Any month</option>
            {facets.travelMonths.map((option) => (
              <option key={option.month} value={option.month}>{option.month} ({option.count})</option>
            ))}
          </select>
        </label>
      ),
    },
  ]

  /*
   * One chip per set filter. Clearing a chip calls the same setter the control
   * does, so the two can never disagree about what is applied.
   */
  const filterChips = [
    stage && { key: 'stage', label: `Stage: ${LEAD_STAGES.find((o) => o.value === stage)?.label ?? stage}`, onClear: () => { setStage(''); setPage(1) } },
    campaignEligible && { key: 'campaign', label: 'Campaign-ready only', onClear: () => { setCampaignEligible(''); setPage(1) } },
    handledBy && { key: 'handledBy', label: `Handled by: ${handledBy}`, onClear: () => { setHandledBy(''); setPage(1) } },
    market && { key: 'market', label: `Destination: ${MARKETS.find((o) => o.value === market)?.label ?? market}`, onClear: () => { setMarket(''); setPage(1) } },
    city && { key: 'city', label: `City: ${city}`, onClear: () => { setCity(''); setPage(1) } },
    travelMonth && { key: 'travelMonth', label: `Travel: ${travelMonth}`, onClear: () => { setTravelMonth(''); setPage(1) } },
    travelRange.preset && {
      key: 'travelRange',
      label: `Travel date: ${
        TRAVEL_PRESETS.find((o) => o.value === travelRange.preset)?.label ?? 'Custom range'
      }`,
      onClear: () => { setTravelRange(NO_RANGE); setPage(1) },
    },
    quoteRange.preset && {
      key: 'quoteRange',
      label: `Quote date: ${
        QUOTE_PRESETS.find((o) => o.value === quoteRange.preset)?.label ?? 'Custom range'
      }`,
      onClear: () => { setQuoteRange(NO_RANGE); setPage(1) },
    },
  ].filter(Boolean)

  /*
   * The advanced filters, rendered flat for the popover.
   *
   * The same group definitions the rail used — each group's heading and its
   * controls, unchanged and still bound to the page's own state. Flattened
   * here rather than rewritten so there is one definition of what an advanced
   * filter is.
   */
  const advancedFilters = advancedFilterGroups.map((group) => (
    <section key={group.id}>
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">
        {group.title}
      </h3>
      <div className="mt-1.5 space-y-2.5">{group.content}</div>
    </section>
  ))

  const clearFilters = () => {
    setStage('')
    setCity('')
    setMarket('')
    setHandledBy('')
    setTravelMonth('')
    setCampaignEligible('')
    setTravelRange(NO_RANGE)
    setQuoteRange(NO_RANGE)
    setPage(1)
  }

  if (isError && items.length === 0) {
    return <ErrorScreen variant={resolveErrorVariant(error)} error={error} onRetry={() => refresh()} />
  }

  const totalPages = pagination?.totalPages ?? 1

  return (
    <div className="space-y-5">
      {/* --- Toolbar ------------------------------------------------------ */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Reference, person, company, email, city"
            aria-label="Search leads"
            className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>

        {/*
          Destination and the period, on the bar; everything else behind "More
          filters". The same split the Lead monitor makes, for the same reason:
          these two are set daily and the rest are not.

          There is deliberately no owner control. This register only ever
          contains the signed-in person's own enquiries — the server decides
          that from the session — so a selector offering "all owners" would
          promise something the API will not honour.
        */}
        {/*
          The four filters a consultant actually reaches for, on the bar; the
          rest behind "More filters".

          There is deliberately no owner control. This register only ever holds
          the signed-in person's own enquiries — the server decides that from
          the session — so a selector offering other owners would promise
          something the API will not honour.
        */}
        <DateRangeFilter
          label="Travel date"
          presets={TRAVEL_PRESETS}
          value={travelRange}
          onChange={(next) => { setTravelRange(next); setPage(1) }}
        />

        <DateRangeFilter
          label="Quote date"
          presets={QUOTE_PRESETS}
          value={quoteRange}
          onChange={(next) => { setQuoteRange(next); setPage(1) }}
        />

        <AdminFilterSelect
          label="Stage"
          value={stage}
          onChange={(next) => { setStage(next); setPage(1) }}
          options={LEAD_STAGES}
          allLabel="All stages"
          className="w-36"
        />

        <AdminFilterSelect
          label="Destination"
          value={market}
          onChange={(next) => { setMarket(next); setPage(1) }}
          options={MARKET_OPTIONS}
          allLabel="All destinations"
          className="w-40"
        />

        <FilterPopover activeCount={drawerFilterCount} onReset={clearFilters}>
          {advancedFilters}
        </FilterPopover>

        {activeFilters > 0 && (
          <Button variant="ghost" onClick={clearFilters}>
            Reset filters
          </Button>
        )}
      </div>

      {/*
        The active filters, as chips.

        They used to live at the top of the rail. With the rail gone they sit
        under the bar, because the one thing a popover cannot do is show what
        is applied while it is closed.
      */}
      {filterChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {filterChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={chip.onClear}
              className="inline-flex max-w-full items-center gap-1 rounded-(--radius-control) bg-slate-100 py-1 pl-2.5 pr-1.5 text-xs text-slate-700 transition-colors hover:bg-slate-200"
            >
              <span className="truncate">{chip.label}</span>
              <X className="size-3 shrink-0 text-slate-500" aria-hidden="true" />
            </button>
          ))}
        </div>
      )}

      {/* --- Actions -------------------------------------------------------
          Split from the filters above: one row decides what the register
          shows, the other acts on it. They shared a row while the rail held
          the filters, which made a nine-button line nobody could scan. */}
      <div className="flex flex-wrap items-center gap-3">

        <Button variant="secondary" onClick={() => refresh()} disabled={isLoading}>
          <RefreshCw className={`size-4 ${isLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
          Refresh
        </Button>

        {/* Only once the order has been changed. A permanent reset button on a
            default table is clutter that explains nothing. */}
        {columnOrder.isCustomised && (
          <Button variant="secondary" onClick={columnOrder.reset}>
            <RotateCcw className="size-4" aria-hidden="true" />
            Reset columns
          </Button>
        )}

        <Button as={Link} to={ROUTE_PATHS.LEAD_PIPELINE} variant="secondary">
          <ClipboardList className="size-4" aria-hidden="true" />
          Pipeline
        </Button>

        {/*
          Exports what the screen is showing. The current filters and search are
          passed straight through, and the server resolves them with the same
          filter builder the list uses — so the workbook can never contain a
          different set of rows from the one being looked at.
        */}
        <Button
          variant="secondary"
          onClick={handleExport}
          isLoading={isExporting}
          loadingLabel="Preparing…"
          title={
            activeFilters > 0 || search
              ? 'Download the filtered leads as an Excel workbook'
              : 'Download all leads as an Excel workbook'
          }
        >
          <Download className="size-4" aria-hidden="true" />
          Export leads
        </Button>

        <Button as={Link} to={ROUTE_PATHS.LEAD_IMPORT} variant="secondary">
          <Upload className="size-4" aria-hidden="true" />
          Import workbook
        </Button>

        {/* The primary action: most enquiries now arrive one at a time. */}
        <Button as={Link} to={ROUTE_PATHS.LEAD_NEW}>
          <Plus className="size-4" aria-hidden="true" />
          Create lead
        </Button>

        {/*
          Deliberately the last item and visually quiet until hovered. It sits
          with the import actions because that is where it is used — clear the
          register, import again — but it should never be the thing the eye
          lands on first.
        */}
        <Button variant="ghost" onClick={openDeleteDialog} title="Delete every lead record">
          <Trash2 className="size-4 text-rose-600" aria-hidden="true" />
          <span className="text-rose-700">Delete all</span>
        </Button>
      </div>

      {/* --- Filters ------------------------------------------------------ */}
      {deleteNotice && (
        <p
          role="status"
          className="rounded-lg bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800 ring-1 ring-inset ring-emerald-200"
        >
          {deleteNotice} Dashboard counters refresh when you next open it.
        </p>
      )}

      {actionError && (
        <p role="alert" className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-inset ring-rose-200">
          {actionError?.response?.data?.message ?? actionError?.message ?? 'That action could not be completed.'}
        </p>
      )}

      {/* Covers both a failed download and a truncated one — the second is not
          an error but the user must still be told the file is incomplete. */}
      {exportError && (
        <p role="alert" className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-inset ring-amber-200">
          {exportError}
        </p>
      )}

      {/*
        The register, full width.

        The rail that used to sit beside it is gone — its filters are in the
        "More filters" popover above. `min-w-0` is kept because the table's own
        `overflow-x-auto` needs it: without it a wide register pushes the page
        sideways instead of scrolling inside its own frame.
      */}
      <div className="min-w-0 space-y-4">
          {/* --- Bulk actions -------------------------------------------------- */}
          {selected.size > 0 && (
            <div className="flex flex-wrap items-center gap-3 rounded-lg bg-brand-50 px-4 py-2.5 ring-1 ring-inset ring-brand-200">
              <span className="text-sm font-medium text-brand-900">{selected.size} selected</span>
              <select
                defaultValue=""
                disabled={isBusy}
                onChange={async (event) => {
                  const next = event.target.value
                  if (!next) return
                  await moveStage([...selected], next, 'Bulk update from the register')
                  setSelected(new Set())
                  event.target.value = ''
                }}
                className="rounded-lg border border-brand-200 bg-white px-2 py-1.5 text-sm outline-none"
                aria-label="Move selected leads to a stage"
              >
                <option value="">Move to stage…</option>
                {LEAD_STAGES.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>Clear</Button>
            </div>
          )}

          {/* --- Table --------------------------------------------------------- */}
          {isInitialLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 8 }, (_, index) => <Skeleton key={index} className="h-12 w-full rounded-lg" />)}
            </div>
          ) : items.length === 0 ? (
            /*
             * Two different empty registers, two different answers.
             *
             * "Import the workbook" is the right prompt for somebody who has no
             * enquiries at all. Shown to somebody whose filters simply matched
             * nothing it is misleading — it suggests their data is missing when
             * it is merely hidden — so a filtered miss offers the way back out
             * instead.
             */
            <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
              {activeFilters > 0 || search ? (
                <>
                  <Filter className="mx-auto size-8 text-slate-300" aria-hidden="true" />
                  <h2 className="mt-3 text-base font-semibold text-slate-900">No leads found</h2>
                  <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
                    No enquiries match the current filters. Try adjusting them.
                  </p>
                  <Button
                    variant="secondary"
                    className="mt-5"
                    onClick={() => { clearFilters(); setSearchInput('') }}
                  >
                    Clear filters
                  </Button>
                </>
              ) : (
                <>
                  <Megaphone className="mx-auto size-8 text-slate-300" aria-hidden="true" />
                  <h2 className="mt-3 text-base font-semibold text-slate-900">No enquiries yet</h2>
                  <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
                    Upload the sales workbook and every row becomes a lead, with its company and
                    contact resolved automatically.
                  </p>
                  <Button as={Link} to={ROUTE_PATHS.LEAD_IMPORT} className="mt-5">
                    <Upload className="size-4" aria-hidden="true" />
                    Import the workbook
                  </Button>
                </>
              )}
            </div>
          ) : (
            <div className="scroll-x overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    {/* Selection is pinned to the leading edge. It is a control, not
                        a field, and a checkbox adrift in the middle of the register
                        would read as data. */}
                    <th scope="col" className="w-10 px-3 py-2">
                      <input
                        type="checkbox"
                        aria-label="Select all on this page"
                        checked={items.length > 0 && items.every((item) => selected.has(item.id))}
                        onChange={(event) =>
                          setSelected(event.target.checked ? new Set(items.map((item) => item.id)) : new Set())
                        }
                        className="size-4 rounded border-slate-300"
                      />
                    </th>
                    {columnOrder.columns.map((column) => (
                      <th
                        key={column.key}
                        scope="col"
                        {...columnOrder.headerProps(column.key)}
                        title="Drag to reorder · Ctrl+← / Ctrl+→"
                        className="cursor-grab select-none px-3 py-2 font-medium outline-none data-dragging:opacity-40 data-drop-target:bg-brand-100 data-drop-target:text-brand-700 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500/40"
                      >
                        {column.header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((lead) => (
                    <tr key={lead.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          aria-label={`Select ${lead.reference}`}
                          checked={selected.has(lead.id)}
                          onChange={(event) =>
                            setSelected((current) => {
                              const next = new Set(current)
                              if (event.target.checked) next.add(lead.id)
                              else next.delete(lead.id)
                              return next
                            })
                          }
                          className="size-4 rounded border-slate-300"
                        />
                      </td>
                      {/* The same array as the header row above, so a header can
                          never sit over another column's data. */}
                      {columnOrder.columns.map((column) => (
                        <td key={column.key} className={column.cellClassName}>
                          {column.render(lead)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <DeleteAllLeadsDialog
            isOpen={isDeleteOpen}
            counts={purgeCounts}
            isDeleting={isDeleting}
            error={deleteError}
            onCancel={() => setIsDeleteOpen(false)}
            onConfirm={confirmDelete}
          />

          {/* --- Pagination ---------------------------------------------------- */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-200 pt-4">
              <p className="text-sm text-slate-500">
                Page {page} of {totalPages} — {pagination?.total?.toLocaleString()} enquiries
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
    </div>
  )
}

export default LeadsPage
