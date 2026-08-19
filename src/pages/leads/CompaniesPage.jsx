/**
 * B2B partners.
 *
 * A company is identified by its email domain where it has one, so the several
 * spellings of a firm's name in the source sheet collapse to a single row.
 */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2, Trash2, ChevronLeft, ChevronRight, RefreshCw, Search } from 'lucide-react'

import { ErrorScreen } from '@/components/common/ErrorScreen'
import { Button } from '@/components/ui/Button'
import { deleteCompanies } from '@/api/services/lead.service'
import { Skeleton } from '@/components/ui/Skeleton'
import { COMPANY_STATUS_STYLES } from '@/constants/lead.constants'
import { useCompanyList } from '@/hooks/useLeads'
import { ROUTE_PATHS } from '@/routes/paths'
import { resolveErrorVariant } from '@/utils/apiError'

const PAGE_SIZE = 50

export function CompaniesPage() {
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState('-leads')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')

  const { items, pagination, isInitialLoading, isLoading, isError, error, refresh } = useCompanyList({
    page,
    limit: PAGE_SIZE,
    sort,
    search,
  })

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(1)
    }, 350)
    return () => clearTimeout(timer)
  }, [searchInput])

  const totalPages = pagination?.totalPages ?? 1
  const total = pagination?.total ?? 0

  /*
   * Selection is by id and deliberately survives nothing.
   *
   * Changing page, search or sort clears it. Carrying ticks across a filter
   * change means a confirmation dialog that says "delete 5" while showing rows
   * the reader never saw — and the ids would still be sent.
   */
  const [selected, setSelected] = useState(new Set())
  const [confirm, setConfirm] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [notice, setNotice] = useState(null)

  useEffect(() => {
    setSelected(new Set())
  }, [page, search, sort])

  if (isError && items.length === 0) {
    return <ErrorScreen variant={resolveErrorVariant(error)} error={error} onRetry={() => refresh()} />
  }


  const allOnPageSelected = items.length > 0 && items.every((company) => selected.has(company.id))

  const runDelete = async () => {
    setIsDeleting(true)
    setNotice(null)

    try {
      const payload = confirm.mode === 'all' ? { all: true } : { ids: [...selected] }
      const result = await deleteCompanies(payload)

      setSelected(new Set())
      setConfirm(null)
      setNotice({ tone: 'success', text: `${result.deleted} company/companies deleted.` })

      /*
       * Where to land afterwards.
       *
       * Deleting everything goes to page 1 — there is nothing else. Otherwise,
       * if this page held only the rows just removed it no longer exists, so
       * step back one rather than leave the reader on an empty page that reads
       * as "there are no companies".
       *
       * Setting `page` re-runs the fetcher through `useCompanyList`; when the
       * page number does not change, `refresh()` does it. No reload, no timer.
       */
      if (confirm.mode === 'all') {
        if (page === 1) refresh()
        else setPage(1)
      } else if (items.length === result.deleted && page > 1) {
        setPage((current) => current - 1)
      } else {
        refresh()
      }
    } catch (thrown) {
      // A 403 from the server lands here: deletion needs `leads.delete`, and
      // the message it sends is more useful than anything invented locally.
      setNotice({ tone: 'error', text: thrown?.message ?? 'Those companies could not be deleted.' })
      setConfirm(null)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Company name or domain"
            aria-label="Search companies"
            className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <select
          value={sort}
          onChange={(event) => { setSort(event.target.value); setPage(1) }}
          aria-label="Sort companies"
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
        >
          <option value="-leads">Most enquiries</option>
          <option value="-recent">Most recent enquiry</option>
          <option value="name">Name A–Z</option>
          <option value="-name">Name Z–A</option>
        </select>

        <Button variant="secondary" onClick={() => refresh()} disabled={isLoading}>
          <RefreshCw className={`size-4 ${isLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
          Refresh
        </Button>
      </div>

      {notice && (
        <div
          role="status"
          className={`flex items-start gap-2.5 rounded-lg border px-4 py-3 text-sm ${
            notice.tone === 'error'
              ? 'border-amber-200 bg-amber-50 text-amber-900'
              : 'border-emerald-200 bg-emerald-50 text-emerald-900'
          }`}
        >
          <p className="min-w-0 flex-1">{notice.text}</p>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="shrink-0 rounded px-2 py-0.5 text-xs font-medium hover:bg-white/60"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Destructive controls. Hidden entirely when there is nothing to act on,
          so an empty register does not offer to empty itself. */}
      {items.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={allOnPageSelected}
              onChange={(event) =>
                setSelected(event.target.checked ? new Set(items.map((company) => company.id)) : new Set())
              }
              className="size-4 rounded border-slate-300"
            />
            Select all on this page
          </label>

          {selected.size > 0 && (
            <Button
              variant="danger"
              size="sm"
              onClick={() => setConfirm({ mode: 'selected' })}
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
              Delete selected ({selected.size})
            </Button>
          )}

          <Button
            variant="danger"
            size="sm"
            className="ml-auto"
            onClick={() => setConfirm({ mode: 'all' })}
          >
            Delete all companies
          </Button>
        </div>
      )}

      {isInitialLoading ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 9 }, (_, index) => <Skeleton key={index} className="h-28 w-full rounded-xl" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
          <Building2 className="mx-auto size-8 text-slate-300" aria-hidden="true" />
          <h2 className="mt-3 text-base font-semibold text-slate-900">No companies yet</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
            Companies are created automatically when the sales workbook is imported.
          </p>
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {items.map((company) => {
            const status = COMPANY_STATUS_STYLES[company.status] ?? COMPANY_STATUS_STYLES.active

            return (
              <li key={company.id} className="relative">
                {/* Outside the <Link>, or ticking a row would navigate. */}
                <label className="absolute left-3 top-3 z-10 flex cursor-pointer items-center p-1">
                  <span className="sr-only">Select {company.companyName}</span>
                  <input
                    type="checkbox"
                    checked={selected.has(company.id)}
                    onChange={(event) =>
                      setSelected((current) => {
                        const next = new Set(current)
                        if (event.target.checked) next.add(company.id)
                        else next.delete(company.id)
                        return next
                      })
                    }
                    className="size-4 rounded border-slate-300"
                  />
                </label>

                <Link
                  to={ROUTE_PATHS.COMPANY_DETAIL.replace(':id', company.id)}
                  className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-4 transition hover:border-blue-400"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="truncate pl-7 text-sm font-semibold text-slate-900">{company.companyName}</h2>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${status.className}`}
                    >
                      {status.label}
                    </span>
                  </div>

                  {company.emailDomain && (
                    <p className="mt-0.5 truncate font-mono text-xs text-slate-400">{company.emailDomain}</p>
                  )}

                  {company.aliases?.length > 0 && (
                    <p className="mt-1 truncate text-xs text-slate-400" title={company.aliases.join(', ')}>
                      also spelled: {company.aliases.slice(0, 2).join(', ')}
                    </p>
                  )}

                  <dl className="mt-auto flex gap-5 pt-3 text-xs">
                    <div>
                      <dt className="text-slate-500">Enquiries</dt>
                      <dd className="text-base font-semibold tabular-nums text-slate-900">
                        {company.leadCount.toLocaleString()}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">People</dt>
                      <dd className="text-base font-semibold tabular-nums text-slate-900">{company.contactCount}</dd>
                    </div>
                    {company.city && (
                      <div className="ml-auto self-end">
                        <dd className="text-slate-500">{company.city}</dd>
                      </div>
                    )}
                  </dl>
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      {/*
        One dialog for both destructive actions.
        The count is stated in the sentence, not just in the button, because the
        button is what gets clicked without reading.
      */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-6">
          <div className="w-full max-w-md rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl">
            <h2 className="text-base font-semibold text-slate-900">
              {confirm.mode === 'all' ? 'Delete all companies?' : 'Delete selected companies?'}
            </h2>

            <p className="mt-2 text-sm text-slate-600">
              {confirm.mode === 'all' ? (
                <>
                  All <span className="font-semibold text-slate-900">{total.toLocaleString()}</span>{' '}
                  companies in the CRM will be deleted — not only the ones on this page.
                </>
              ) : (
                <>
                  You are about to delete{' '}
                  <span className="font-semibold text-slate-900">{selected.size}</span>{' '}
                  {selected.size === 1 ? 'company' : 'companies'}.
                </>
              )}{' '}
              This action cannot be undone.
            </p>

            {/* Stated plainly, because it is the question anybody hesitating is
                actually asking. */}
            <p className="mt-2 text-xs text-slate-500">
              Enquiries belonging to {confirm.mode === 'all' ? 'these companies' : 'them'} are kept.
            </p>

            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setConfirm(null)} disabled={isDeleting}>
                Cancel
              </Button>
              <Button variant="danger" size="sm" onClick={runDelete} isLoading={isDeleting} disabled={isDeleting}>
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-200 pt-4">
          <p className="text-sm text-slate-500">
            Page {page} of {totalPages} — {pagination?.total?.toLocaleString()} companies
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

export default CompaniesPage
