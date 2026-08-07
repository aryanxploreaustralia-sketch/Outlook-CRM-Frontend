/**
 * The email template library.
 *
 * One template is ACTIVE and it is what every new enquiry receives, unattended,
 * every morning. So the page is built around answering "what are we sending?"
 * at a glance: the active template is pinned to the top with a banner above it,
 * and every other card's primary action is to take its place.
 */

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  Archive,
  ArchiveRestore,
  CheckCircle2,
  Copy,
  FileText,
  Pencil,
  Plus,
  Power,
  Search,
  Trash2,
} from 'lucide-react'

import { ErrorScreen } from '@/components/common/ErrorScreen'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import {
  TEMPLATE_CATEGORIES,
  TEMPLATE_STATUS,
  TEMPLATE_STATUS_FILTERS,
  TEMPLATE_STATUS_LABELS,
  TEMPLATE_STATUS_STYLES,
} from '@/constants/template.constants'
import { useTemplateList } from '@/hooks/useTemplates'
import { ROUTE_PATHS } from '@/routes/paths'
import { resolveErrorVariant } from '@/utils/apiError'

const formatDate = (value) => (value ? new Date(value).toLocaleDateString() : '—')

function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${
        TEMPLATE_STATUS_STYLES[status] ?? TEMPLATE_STATUS_STYLES.inactive
      }`}
    >
      {TEMPLATE_STATUS_LABELS[status] ?? status}
    </span>
  )
}

export function TemplatesPage() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [category, setCategory] = useState('')

  const includeArchived = status === TEMPLATE_STATUS.ARCHIVED

  const {
    items,
    isInitialLoading,
    isError,
    error,
    action,
    isBusy,
    actionError,
    notice,
    dismissNotice,
    activate,
    deactivate,
    archive,
    restore,
    duplicate,
    remove,
  } = useTemplateList({ status, category, search, includeArchived })

  const active = useMemo(() => items.find((item) => item.status === TEMPLATE_STATUS.ACTIVE), [items])
  const rest = useMemo(() => items.filter((item) => item.status !== TEMPLATE_STATUS.ACTIVE), [items])

  const handleDelete = async (template) => {
    const confirmed = window.confirm(
      `Delete the draft "${template.name}"? This cannot be undone.`,
    )
    if (confirmed) await remove(template.id)
  }

  const handleArchive = async (template) => {
    if (template.status === TEMPLATE_STATUS.ACTIVE) {
      const confirmed = window.confirm(
        `"${template.name}" is the active template. Archiving it stops new enquiries being emailed automatically until another is activated. Continue?`,
      )
      if (!confirmed) return
    }
    await archive(template.id)
  }

  if (isError) return <ErrorScreen error={error} variant={resolveErrorVariant(error)} />

  return (
    <div className="space-y-6">
      {/* --- What is being sent --------------------------------------------- */}
      {!isInitialLoading && !status && (
        active ? (
          <div className="flex flex-wrap items-center gap-3 rounded-xl bg-emerald-50 px-4 py-3 ring-1 ring-inset ring-emerald-200">
            <CheckCircle2 className="size-5 shrink-0 text-emerald-600" aria-hidden="true" />
            <p className="text-sm text-emerald-900">
              Every new enquiry is emailed <strong>{active.name}</strong> (version {active.version}).
              No template is chosen during a workbook upload.
            </p>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3 rounded-xl bg-amber-50 px-4 py-3 ring-1 ring-inset ring-amber-200">
            <AlertTriangle className="size-5 shrink-0 text-amber-600" aria-hidden="true" />
            <p className="text-sm text-amber-900">
              <strong>No template is active.</strong> New enquiries will not be emailed
              automatically, and a workbook upload with sending switched on will be refused until
              one is activated.
            </p>
          </div>
        )
      )}

      {/* --- Toolbar --------------------------------------------------------- */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search templates"
            aria-label="Search templates"
            className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          aria-label="Filter by status"
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        >
          {TEMPLATE_STATUS_FILTERS.map((item) => (
            <option key={item.value || 'all'} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>

        <select
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          aria-label="Filter by category"
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        >
          <option value="">All categories</option>
          {TEMPLATE_CATEGORIES.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>

        <Button as={Link} to={ROUTE_PATHS.TEMPLATE_NEW} className="ml-auto">
          <Plus className="size-4" aria-hidden="true" />
          New template
        </Button>
      </div>

      {notice && (
        <p
          role="status"
          className="flex items-start justify-between gap-3 rounded-lg bg-blue-50 px-4 py-2.5 text-sm text-blue-900 ring-1 ring-inset ring-blue-200"
        >
          <span>{notice}</span>
          <button type="button" onClick={dismissNotice} className="shrink-0 text-blue-500 hover:text-blue-700">
            Dismiss
          </button>
        </p>
      )}

      {actionError && (
        <p role="alert" className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-inset ring-rose-200">
          {actionError?.response?.data?.message ?? actionError?.message ?? 'That action could not be completed.'}
        </p>
      )}

      {/* --- The library ----------------------------------------------------- */}
      {isInitialLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-48 rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
          <FileText className="mx-auto size-8 text-slate-300" aria-hidden="true" />
          <h2 className="mt-3 text-base font-semibold text-slate-900">
            {search || status || category ? 'Nothing matches those filters' : 'No templates yet'}
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
            {search || status || category
              ? 'Try a broader search.'
              : 'A template is the subject and body sent to every new enquiry, with the enquiry’s own details filled in.'}
          </p>
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[...(active ? [active] : []), ...rest].map((template) => {
            const isThisBusy = isBusy && action?.endsWith(template.id)
            const isActive = template.status === TEMPLATE_STATUS.ACTIVE
            const isArchived = template.status === TEMPLATE_STATUS.ARCHIVED

            return (
              <li
                key={template.id}
                className={`flex flex-col rounded-xl border bg-white p-4 ${
                  isActive ? 'border-emerald-300 ring-1 ring-emerald-100' : 'border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-slate-900" title={template.name}>
                      {template.name}
                    </h3>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {template.categoryLabel} &middot; v{template.version}
                    </p>
                  </div>
                  <StatusBadge status={template.status} />
                </div>

                <p className="mt-3 line-clamp-2 text-sm text-slate-600" title={template.subject}>
                  {template.subject}
                </p>

                {template.description && (
                  <p className="mt-1 line-clamp-2 text-xs text-slate-400">{template.description}</p>
                )}

                <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-100 pt-3 text-xs text-slate-500">
                  <div>
                    <dt className="inline">Sent </dt>
                    <dd className="inline font-medium tabular-nums text-slate-700">
                      {(template.useCount ?? 0).toLocaleString()}×
                    </dd>
                  </div>
                  <div>
                    <dt className="inline">Updated </dt>
                    <dd className="inline text-slate-700">{formatDate(template.updatedAt)}</dd>
                  </div>
                </dl>

                {/* --- Actions ------------------------------------------------ */}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {!isArchived && (
                    <Button as={Link} to={ROUTE_PATHS.TEMPLATE_EDIT.replace(':id', template.id)} variant="secondary" size="sm">
                      <Pencil className="size-3.5" aria-hidden="true" />
                      Edit
                    </Button>
                  )}

                  {!isActive && !isArchived && (
                    <Button size="sm" onClick={() => activate(template.id)} isLoading={isThisBusy}>
                      <Power className="size-3.5" aria-hidden="true" />
                      Activate
                    </Button>
                  )}

                  {isActive && (
                    <Button variant="secondary" size="sm" onClick={() => deactivate(template.id)} isLoading={isThisBusy}>
                      <Power className="size-3.5" aria-hidden="true" />
                      Deactivate
                    </Button>
                  )}

                  {isArchived ? (
                    <Button variant="secondary" size="sm" onClick={() => restore(template.id)} isLoading={isThisBusy}>
                      <ArchiveRestore className="size-3.5" aria-hidden="true" />
                      Restore
                    </Button>
                  ) : (
                    <Button variant="ghost" size="sm" onClick={() => handleArchive(template)} isLoading={isThisBusy}>
                      <Archive className="size-3.5" aria-hidden="true" />
                      Archive
                    </Button>
                  )}

                  <Button variant="ghost" size="sm" onClick={() => duplicate(template.id)} isLoading={isThisBusy}>
                    <Copy className="size-3.5" aria-hidden="true" />
                    Duplicate
                  </Button>

                  {/* Only a draft can be deleted; anything that has been active
                      may have sent mail, and history must stay readable. */}
                  {template.status === TEMPLATE_STATUS.DRAFT && (
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(template)} isLoading={isThisBusy}>
                      <Trash2 className="size-3.5" aria-hidden="true" />
                      Delete
                    </Button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default TemplatesPage
