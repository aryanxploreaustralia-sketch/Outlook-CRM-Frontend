/**
 * Contacts list.
 *
 * Grid and list views, search, filters, bulk selection and the sync/import/export
 * entry points. Deliberately holds no transport code — `useContacts` owns data
 * and mutations, so this file is layout and interaction only.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Download,
  LayoutGrid,
  List,
  RefreshCw,
  Search,
  Star,
  Tag as TagIcon,
  Trash2,
  Upload,
  UserPlus,
  Users,
  X,
} from 'lucide-react'

import { updateContact } from '@/api/services/contact.service'
import { ErrorScreen } from '@/components/common/ErrorScreen'
import { ContactCard } from '@/components/contacts/ContactCard'
import { Button } from '@/components/ui/Button'
import { CONTACT_FILTERS, SORT_OPTIONS, TRANSFER_FORMATS } from '@/constants/contact.constants'
import { useContacts } from '@/hooks/useContacts'
import { ROUTE_PATHS } from '@/routes/paths'
import { DEFAULT_PAGE_SIZE, Pagination } from '@/components/ui/Pagination'
import { resolveErrorVariant } from '@/utils/apiError'

export function ContactsPage() {
  const [view, setView] = useState('list')
  const [page, setPage] = useState(1)
  // Rows per page is the reader's choice, not a constant. Changing it returns to
  // page one: page 8 of a 25-row list is past the end of a 50-row one, and landing
  // on an empty page reads as lost data.
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [sort, setSort] = useState('-created')
  const [filter, setFilter] = useState('')
  const [company, setCompany] = useState('')
  const [country, setCountry] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(() => new Set())

  const {
    items,
    facets,
    pagination,
    isInitialLoading,
    isLoading,
    isError,
    error,
    refresh,
    action,
    isBusy,
    actionError,
    runBulk,
    sync,
    exportAll,
  } = useContacts({ page, limit: pageSize, sort, search, filter, company, country })

  /** Debounced so typing does not fire a request per keystroke. */
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(1)
    }, 350)
    return () => clearTimeout(timer)
  }, [searchInput])

  // Selection is cleared when the visible set changes, or a hidden contact could
  // be silently included in a bulk delete.
  useEffect(() => {
    setSelected(new Set())
  }, [page, filter, search, company, country, sort])

  const toggleSelect = useCallback((id, next) => {
    setSelected((current) => {
      const updated = new Set(current)
      if (next) updated.add(id)
      else updated.delete(id)
      return updated
    })
  }, [])

  const allSelected = items.length > 0 && items.every((item) => selected.has(item.id))

  const toggleSelectAll = useCallback(() => {
    setSelected(allSelected ? new Set() : new Set(items.map((item) => item.id)))
  }, [allSelected, items])

  const handleFavorite = useCallback(
    async (contact) => {
      await updateContact(contact.id, { favorite: !contact.favorite })
      await refresh({ isBackground: true })
    },
    [refresh],
  )

  const handleBulkDelete = useCallback(async () => {
    const count = selected.size
    if (!window.confirm(`Delete ${count} contact${count === 1 ? '' : 's'}? They can be restored later.`)) return

    await runBulk({ ids: [...selected], action: 'delete' })
    setSelected(new Set())
  }, [selected, runBulk])

  const handleBulkTag = useCallback(async () => {
    const tag = window.prompt('Tag to apply to the selected contacts:')
    if (!tag?.trim()) return

    await runBulk({ ids: [...selected], action: 'tag', value: tag.trim().toLowerCase() })
    setSelected(new Set())
  }, [selected, runBulk])

  const handleExport = useCallback(
    async (format) => {
      await exportAll({
        format,
        // Exporting the selection when there is one is what a user means by
        // "export" after ticking boxes; otherwise the current filter applies.
        ids: selected.size > 0 ? [...selected] : undefined,
        filter: selected.size > 0 ? undefined : filter || undefined,
        search: selected.size > 0 ? undefined : search || undefined,
      })
    },
    [exportAll, selected, filter, search],
  )

  const activeFilters = useMemo(
    () => [filter, company, country].filter(Boolean).length,
    [filter, company, country],
  )

  const clearFilters = useCallback(() => {
    setFilter('')
    setCompany('')
    setCountry('')
    setSearchInput('')
    setPage(1)
  }, [])

  if (isError && items.length === 0) {
    return (
      <ErrorScreen variant={resolveErrorVariant(error)} message={error?.message} onRetry={refresh} />
    )
  }

  return (
    <div className="space-y-4">
      {/* --- Heading -------------------------------------------------------- */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
            Contacts
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {pagination?.total ?? 0} contact{pagination?.total === 1 ? '' : 's'} in your address book.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button as={Link} to={ROUTE_PATHS.CONTACT_GROUPS} variant="secondary" size="sm">
            <Users className="size-4" aria-hidden="true" />
            Groups
          </Button>
          <Button as={Link} to={ROUTE_PATHS.CONTACT_IMPORT} variant="secondary" size="sm">
            <Upload className="size-4" aria-hidden="true" />
            Import
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => sync()}
            isLoading={action === 'sync'}
            disabled={isBusy}
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            Sync
          </Button>
          <Button as={Link} to={ROUTE_PATHS.CONTACT_NEW} size="sm">
            <UserPlus className="size-4" aria-hidden="true" />
            New contact
          </Button>
        </div>
      </div>

      {actionError && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800">
          {actionError.message}
        </p>
      )}

      {/* --- Toolbar -------------------------------------------------------- */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3">
        <div className="relative min-w-[14rem] flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search name, company, email, phone, tags or notes…"
            aria-label="Search contacts"
            className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
          />
        </div>

        <select
          value={filter}
          onChange={(event) => { setFilter(event.target.value); setPage(1) }}
          aria-label="Filter contacts"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
        >
          {CONTACT_FILTERS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>

        <select
          value={company}
          onChange={(event) => { setCompany(event.target.value); setPage(1) }}
          aria-label="Filter by company"
          className="max-w-[12rem] rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
        >
          <option value="">All companies</option>
          {facets.companies.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>

        <select
          value={country}
          onChange={(event) => { setCountry(event.target.value); setPage(1) }}
          aria-label="Filter by country"
          className="max-w-[10rem] rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
        >
          <option value="">All countries</option>
          {facets.countries.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>

        <select
          value={sort}
          onChange={(event) => setSort(event.target.value)}
          aria-label="Sort contacts"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>

        {activeFilters > 0 && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="size-3.5" aria-hidden="true" />
            Clear
          </Button>
        )}

        {/* View toggle */}
        <div className="ml-auto flex overflow-hidden rounded-lg border border-slate-300">
          {[
            { value: 'list', icon: List, label: 'List view' },
            { value: 'grid', icon: LayoutGrid, label: 'Grid view' },
          ].map(({ value, icon: Icon, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setView(value)}
              aria-label={label}
              aria-pressed={view === value}
              className={`grid size-9 place-items-center transition-colors ${
                view === value ? 'bg-brand-50 text-brand-700' : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              <Icon className="size-4" aria-hidden="true" />
            </button>
          ))}
        </div>
      </div>

      {/* --- Bulk action bar ------------------------------------------------ */}
      {selected.size > 0 && (
        <div
          role="region"
          aria-label="Bulk actions"
          className="flex flex-wrap items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-4 py-2.5"
        >
          <span className="text-sm font-medium text-brand-900">
            {selected.size} selected
          </span>

          <div className="ml-auto flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => runBulk({ ids: [...selected], action: 'favorite' })} disabled={isBusy}>
              <Star className="size-3.5" aria-hidden="true" />
              Favorite
            </Button>
            <Button variant="secondary" size="sm" onClick={handleBulkTag} disabled={isBusy}>
              <TagIcon className="size-3.5" aria-hidden="true" />
              Tag
            </Button>
            <Button variant="secondary" size="sm" onClick={() => handleExport('csv')} isLoading={action === 'export'}>
              <Download className="size-3.5" aria-hidden="true" />
              Export
            </Button>
            <Button variant="danger" size="sm" onClick={handleBulkDelete} disabled={isBusy}>
              <Trash2 className="size-3.5" aria-hidden="true" />
              Delete
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* --- Results -------------------------------------------------------- */}
      {isInitialLoading ? (
        <div className="space-y-2" aria-busy="true">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="h-14 animate-pulse rounded-lg bg-slate-200/70" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white py-12 text-center">
          <Users className="mx-auto size-8 text-slate-300" aria-hidden="true" />
          <p className="mt-3 text-sm font-medium text-slate-700">
            {search || activeFilters > 0 ? 'No contacts match these filters.' : 'No contacts yet.'}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {search || activeFilters > 0
              ? 'Try a different search or clear the filters.'
              : 'Add one by hand, import a file, or sync from Outlook.'}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {search || activeFilters > 0 ? (
              <Button variant="secondary" onClick={clearFilters}>Clear filters</Button>
            ) : (
              <>
                <Button as={Link} to={ROUTE_PATHS.CONTACT_NEW}>
                  <UserPlus className="size-4" aria-hidden="true" />
                  New contact
                </Button>
                <Button as={Link} to={ROUTE_PATHS.CONTACT_IMPORT} variant="secondary">
                  <Upload className="size-4" aria-hidden="true" />
                  Import
                </Button>
              </>
            )}
          </div>
        </div>
      ) : view === 'grid' ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((contact) => (
            <ContactCard
              key={contact.id}
              contact={contact}
              view="grid"
              selected={selected.has(contact.id)}
              onSelect={toggleSelect}
              onToggleFavorite={handleFavorite}
            />
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50/60 px-4 py-2">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleSelectAll}
              aria-label="Select all contacts on this page"
              className="size-4 cursor-pointer rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            <span className="text-xs font-medium text-slate-600">
              {allSelected ? 'Deselect all' : 'Select all on this page'}
            </span>
          </div>

          {items.map((contact) => (
            <ContactCard
              key={contact.id}
              contact={contact}
              view="list"
              selected={selected.has(contact.id)}
              onSelect={toggleSelect}
              onToggleFavorite={handleFavorite}
            />
          ))}
        </div>
      )}

      {/* --- Pagination ----------------------------------------------------- */}
      <Pagination
        page={page}
        pageSize={pageSize}
        totalItems={pagination?.total ?? 0}
        onPageChange={setPage}
        onPageSizeChange={(next) => { setPageSize(next); setPage(1) }}
        noun="contacts"
        disabled={isLoading}
      />

      {/* Export formats, when nothing is selected. */}
      {selected.size === 0 && items.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span>Export as:</span>
          {TRANSFER_FORMATS.map((format) => (
            <button
              key={format.value}
              type="button"
              onClick={() => handleExport(format.value)}
              title={format.hint}
              className="rounded-md px-2 py-1 font-medium text-brand-600 transition-colors hover:bg-brand-50"
            >
              {format.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default ContactsPage
