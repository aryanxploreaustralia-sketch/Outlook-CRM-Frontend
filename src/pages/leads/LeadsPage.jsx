/**
 * The enquiry register.
 *
 * One row per quotation enquiry, which is what the sales workbook records —
 * not one row per person. A contact with 183 open enquiries appears 183 times
 * here, and that is correct.
 */

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Download,
  Filter,
  Megaphone,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react'

import { deleteAllLeads, exportLeads, fetchPurgePreview } from '@/api/services/lead.service'
import { DeleteAllLeadsDialog } from '@/components/leads/DeleteAllLeadsDialog'
import { LeadStageBadge } from '@/components/leads/LeadStageBadge'
import { ErrorScreen } from '@/components/common/ErrorScreen'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { LEAD_STAGES, MARKETS } from '@/constants/lead.constants'
import { useLeadFacets, useLeadList } from '@/hooks/useLeads'
import { ROUTE_PATHS } from '@/routes/paths'
import { resolveErrorVariant } from '@/utils/apiError'

const PAGE_SIZE = 50

const formatDate = (value) => (value ? new Date(value).toLocaleDateString() : '—')

export function LeadsPage() {
  const [page, setPage] = useState(1)
  const [stage, setStage] = useState('')
  const [city, setCity] = useState('')
  const [market, setMarket] = useState('')
  const [handledBy, setHandledBy] = useState('')
  const [travelMonth, setTravelMonth] = useState('')
  const [campaignEligible, setCampaignEligible] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(() => new Set())
  const [showFilters, setShowFilters] = useState(false)

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
  }, [page, stage, city, market, handledBy, travelMonth, campaignEligible, search])

  const activeFilters = useMemo(
    () => [stage, city, market, handledBy, travelMonth, campaignEligible].filter(Boolean).length,
    [stage, city, market, handledBy, travelMonth, campaignEligible],
  )

  const clearFilters = () => {
    setStage('')
    setCity('')
    setMarket('')
    setHandledBy('')
    setTravelMonth('')
    setCampaignEligible('')
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

        <Button variant={activeFilters > 0 ? 'primary' : 'secondary'} onClick={() => setShowFilters((open) => !open)}>
          <Filter className="size-4" aria-hidden="true" />
          Filters{activeFilters > 0 ? ` (${activeFilters})` : ''}
        </Button>

        <Button variant="secondary" onClick={() => refresh()} disabled={isLoading}>
          <RefreshCw className={`size-4 ${isLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
          Refresh
        </Button>

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
      {showFilters && (
        <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <label className="block text-xs font-medium text-slate-600">
            Stage
            <select
              value={stage}
              onChange={(event) => { setStage(event.target.value); setPage(1) }}
              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-blue-500"
            >
              <option value="">All stages</option>
              {LEAD_STAGES.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <label className="block text-xs font-medium text-slate-600">
            City
            <select
              value={city}
              onChange={(event) => { setCity(event.target.value); setPage(1) }}
              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-blue-500"
            >
              <option value="">All cities</option>
              {facets.cities.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>

          <label className="block text-xs font-medium text-slate-600">
            Market
            <select
              value={market}
              onChange={(event) => { setMarket(event.target.value); setPage(1) }}
              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-blue-500"
            >
              {MARKETS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <label className="block text-xs font-medium text-slate-600">
            Handled by
            <select
              value={handledBy}
              onChange={(event) => { setHandledBy(event.target.value); setPage(1) }}
              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-blue-500"
            >
              <option value="">Anyone</option>
              {facets.handledBy.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>

          <label className="block text-xs font-medium text-slate-600">
            Travel month
            <select
              value={travelMonth}
              onChange={(event) => { setTravelMonth(event.target.value); setPage(1) }}
              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-blue-500"
            >
              <option value="">Any month</option>
              {facets.travelMonths.map((option) => (
                <option key={option.month} value={option.month}>{option.month} ({option.count})</option>
              ))}
            </select>
          </label>

          <label className="block text-xs font-medium text-slate-600">
            Campaign
            <select
              value={campaignEligible}
              onChange={(event) => { setCampaignEligible(event.target.value); setPage(1) }}
              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-blue-500"
            >
              <option value="">All leads</option>
              <option value="true">Campaign-ready only</option>
            </select>
          </label>

          {activeFilters > 0 && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="self-end">
              <X className="size-4" aria-hidden="true" />
              Clear filters
            </Button>
          )}
        </div>
      )}

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
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
          <Megaphone className="mx-auto size-8 text-slate-300" aria-hidden="true" />
          <h2 className="mt-3 text-base font-semibold text-slate-900">No enquiries yet</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
            Upload the sales workbook and every row becomes a lead, with its company and contact
            resolved automatically.
          </p>
          <Button as={Link} to={ROUTE_PATHS.LEAD_IMPORT} className="mt-5">
            <Upload className="size-4" aria-hidden="true" />
            Import the workbook
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
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
                <th scope="col" className="px-3 py-2 font-medium">Reference</th>
                <th scope="col" className="px-3 py-2 font-medium">Contact</th>
                <th scope="col" className="px-3 py-2 font-medium">Company</th>
                <th scope="col" className="px-3 py-2 font-medium">City</th>
                <th scope="col" className="px-3 py-2 font-medium">Query Date</th>
                <th scope="col" className="px-3 py-2 font-medium">Travel</th>
                <th scope="col" className="px-3 py-2 font-medium">Pax</th>
                <th scope="col" className="px-3 py-2 font-medium">Stage</th>
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
                  <td className="whitespace-nowrap px-3 py-2">
                    <Link
                      to={ROUTE_PATHS.LEAD_DETAIL.replace(':id', lead.id)}
                      className="font-mono text-xs font-medium text-blue-600 hover:underline"
                    >
                      {lead.reference}
                    </Link>
                  </td>
                  <td className="max-w-48 px-3 py-2">
                    <span className="block truncate text-slate-900">{lead.contactPerson}</span>
                    <span className="block truncate text-xs text-slate-400">{lead.email}</span>
                  </td>
                  <td className="max-w-48 truncate px-3 py-2 text-slate-600">{lead.companyName ?? '—'}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-600">{lead.city ?? '—'}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-500">{formatDate(lead.quoteDate)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-500">
                    {/* Prose travel dates like "August" are shown as written —
                        the sheet's only timing signal for those enquiries. */}
                    {lead.travelDate ? formatDate(lead.travelDate) : (lead.travelDateText ?? '—')}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-500">{lead.paxText ?? '—'}</td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <LeadStageBadge stage={lead.stage} showEligibility eligible={lead.campaignEligible} />
                  </td>
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
  )
}

export default LeadsPage
