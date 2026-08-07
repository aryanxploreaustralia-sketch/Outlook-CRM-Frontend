/**
 * B2B partners.
 *
 * A company is identified by its email domain where it has one, so the several
 * spellings of a firm's name in the source sheet collapse to a single row.
 */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2, ChevronLeft, ChevronRight, RefreshCw, Search } from 'lucide-react'

import { ErrorScreen } from '@/components/common/ErrorScreen'
import { Button } from '@/components/ui/Button'
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

  if (isError && items.length === 0) {
    return <ErrorScreen variant={resolveErrorVariant(error)} error={error} onRetry={() => refresh()} />
  }

  const totalPages = pagination?.totalPages ?? 1

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
              <li key={company.id}>
                <Link
                  to={ROUTE_PATHS.COMPANY_DETAIL.replace(':id', company.id)}
                  className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-4 transition hover:border-blue-400"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="truncate text-sm font-semibold text-slate-900">{company.companyName}</h2>
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
