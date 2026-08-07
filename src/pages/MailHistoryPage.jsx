/**
 * Mail history.
 *
 * Lists every send attempt, successful or not. Failures are the reason this view
 * matters: a message that Graph rejected never reaches Outlook's Sent Items, so
 * this is the only place the user can see it happened and read why.
 *
 * The detail body is fetched lazily when a row is expanded rather than shipped
 * with the list — fifty message bodies is a lot of payload for a view where the
 * user opens at most one or two.
 */

import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Inbox,
  Paperclip,
  PenSquare,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react'

import { fetchMailById } from '@/api/services/mail.service'
import { ErrorScreen } from '@/components/common/ErrorScreen'
import { MailStatusBadge } from '@/components/mail/MailStatusBadge'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { formatBytes, MAIL_STATUS_FILTERS } from '@/constants/mail.constants'
import { useMailHistory } from '@/hooks/useMailHistory'
import { ROUTE_PATHS } from '@/routes/paths'
import { resolveErrorVariant } from '@/utils/apiError'

const PAGE_SIZE = 20

/** Formats an ISO timestamp, tolerating null and invalid input. */
function formatDateTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString()
}

/**
 * Expanded detail for one message.
 *
 * Owns its own fetch so opening a row never re-renders the whole list.
 */
function MailDetail({ id }) {
  const [detail, setDetail] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    const controller = new AbortController()

    fetchMailById(id, { signal: controller.signal })
      .then(setDetail)
      .catch((caught) => {
        if (!caught?.isCanceled) setError(caught)
      })

    return () => controller.abort()
  }, [id])

  if (error) {
    return <p className="px-4 py-3 text-xs text-red-600">{error.message}</p>
  }

  if (!detail) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 text-xs text-slate-500">
        <Spinner size="xs" label="" />
        Loading message…
      </div>
    )
  }

  return (
    <div className="space-y-3 border-t border-slate-100 bg-slate-50/60 px-4 py-3">
      <dl className="grid gap-x-4 gap-y-1.5 text-xs sm:grid-cols-[auto_1fr]">
        <dt className="font-medium text-slate-500">From</dt>
        <dd className="text-slate-700">{detail.from ?? '—'}</dd>

        <dt className="font-medium text-slate-500">To</dt>
        <dd className="break-words text-slate-700">{detail.to.join(', ')}</dd>

        {detail.cc?.length > 0 && (
          <>
            <dt className="font-medium text-slate-500">Cc</dt>
            <dd className="break-words text-slate-700">{detail.cc.join(', ')}</dd>
          </>
        )}

        {detail.bcc?.length > 0 && (
          <>
            <dt className="font-medium text-slate-500">Bcc</dt>
            <dd className="break-words text-slate-700">{detail.bcc.join(', ')}</dd>
          </>
        )}

        <dt className="font-medium text-slate-500">Sent</dt>
        <dd className="text-slate-700">{formatDateTime(detail.sentAt)}</dd>

        {detail.graphRequestId && (
          <>
            <dt className="font-medium text-slate-500">Graph request</dt>
            {/* Shown because it is the identifier Microsoft support asks for. */}
            <dd className="break-all font-mono text-[11px] text-slate-500">
              {detail.graphRequestId}
            </dd>
          </>
        )}
      </dl>

      {detail.error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2">
          <p className="text-xs font-medium text-red-800">
            {detail.error.code ?? 'Send failed'}
          </p>
          <p className="mt-0.5 text-xs text-red-700">{detail.error.message}</p>
        </div>
      )}

      {detail.attachments?.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {detail.attachments.map((file, index) => (
            <li
              key={`${file.name}-${index}`}
              className="inline-flex items-center gap-1.5 rounded-md bg-white px-2 py-1 text-[11px] text-slate-600 ring-1 ring-slate-200"
            >
              <Paperclip className="size-3 text-slate-400" aria-hidden="true" />
              {file.name}
              <span className="text-slate-400">{formatBytes(file.size)}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Rendered as text, never as HTML.
          `dangerouslySetInnerHTML` here would execute whatever markup was
          composed — and history is exactly where a hostile body would be opened.
          The plain-text alternative carries the content without the risk. */}
      {detail.text && (
        <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
          <p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-slate-700">
            {detail.text}
          </p>
        </div>
      )}
    </div>
  )
}

export function MailHistoryPage() {
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState(null)

  const { items, pagination, isInitialLoading, isLoading, isError, error, refresh, remove, deletingId } =
    useMailHistory({ page, limit: PAGE_SIZE, status, search })

  /** Debounced so typing does not fire a request per keystroke. */
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(1)
    }, 350)

    return () => clearTimeout(timer)
  }, [searchInput])

  const handleDelete = useCallback(
    async (id, subject) => {
      const label = subject?.trim() ? `“${subject}”` : 'this message'
      if (!window.confirm(`Delete ${label} from your history?`)) return

      if (expandedId === id) setExpandedId(null)
      await remove(id)
    },
    [remove, expandedId],
  )

  if (isError && items.length === 0) {
    return (
      <ErrorScreen
        variant={resolveErrorVariant(error)}
        message={error?.message}
        onRetry={refresh}
      />
    )
  }

  return (
    <div className="space-y-5">
      {/* --- Heading ------------------------------------------------------- */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
            Mail history
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Every message this CRM has sent, including failed attempts.
          </p>
        </div>

        <Button as={Link} to={ROUTE_PATHS.COMPOSE}>
          <PenSquare className="size-4" aria-hidden="true" />
          Compose
        </Button>
      </div>

      {/* --- Filters ------------------------------------------------------- */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[14rem] flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search subject, recipient or body…"
            aria-label="Search mail history"
            className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
          />
        </div>

        <select
          value={status}
          onChange={(event) => {
            setStatus(event.target.value)
            setPage(1)
          }}
          aria-label="Filter by status"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
        >
          {MAIL_STATUS_FILTERS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <Button variant="secondary" onClick={refresh} isLoading={isLoading} loadingLabel="">
          <RefreshCw className="size-4" aria-hidden="true" />
          <span className="sr-only sm:not-sr-only">Refresh</span>
        </Button>
      </div>

      {/* --- List ---------------------------------------------------------- */}
      {isInitialLoading ? (
        <div className="space-y-2" aria-busy="true">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-16 animate-pulse rounded-lg bg-slate-200/70" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white py-12 text-center">
          <Inbox className="mx-auto size-8 text-slate-300" aria-hidden="true" />
          <p className="mt-3 text-sm font-medium text-slate-700">
            {search || status ? 'No messages match these filters.' : 'No messages yet.'}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {search || status
              ? 'Try a different search or status.'
              : 'Messages you send will appear here.'}
          </p>
          {!search && !status && (
            <Button as={Link} to={ROUTE_PATHS.COMPOSE} className="mt-4">
              <PenSquare className="size-4" aria-hidden="true" />
              Compose your first message
            </Button>
          )}
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((mail) => {
            const isExpanded = expandedId === mail.id

            return (
              <li
                key={mail.id}
                className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
              >
                <div className="flex items-center gap-3 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : mail.id)}
                    aria-expanded={isExpanded}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <ChevronDown
                      className={`size-4 shrink-0 text-slate-400 transition-transform ${
                        isExpanded ? 'rotate-180' : ''
                      }`}
                      aria-hidden="true"
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium text-slate-900">
                          {mail.subject?.trim() || '(no subject)'}
                        </p>
                        {mail.attachmentCount > 0 && (
                          <span
                            className="inline-flex shrink-0 items-center gap-0.5 text-[11px] text-slate-400"
                            title={`${mail.attachmentCount} attachment(s)`}
                          >
                            <Paperclip className="size-3" aria-hidden="true" />
                            {mail.attachmentCount}
                          </span>
                        )}
                      </div>

                      <p className="truncate text-xs text-slate-500">
                        {mail.to.join(', ')}
                        {mail.ccCount > 0 && ` · +${mail.ccCount} cc`}
                        {mail.bccCount > 0 && ` · +${mail.bccCount} bcc`}
                      </p>
                    </div>

                    <div className="hidden shrink-0 text-right sm:block">
                      <p className="text-xs text-slate-500">
                        {formatDateTime(mail.sentAt ?? mail.createdAt)}
                      </p>
                    </div>

                    <MailStatusBadge status={mail.status} size="sm" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDelete(mail.id, mail.subject)}
                    disabled={deletingId === mail.id}
                    className="grid size-7 shrink-0 place-items-center rounded text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                    aria-label={`Delete ${mail.subject?.trim() || 'message'}`}
                  >
                    {deletingId === mail.id ? (
                      <Spinner size="xs" label="" />
                    ) : (
                      <Trash2 className="size-4" aria-hidden="true" />
                    )}
                  </button>
                </div>

                {/* A failure is summarised on the collapsed row too — the whole
                    point of this view is that it is visible without digging. */}
                {mail.error && !isExpanded && (
                  <p className="flex items-start gap-1.5 border-t border-red-100 bg-red-50/70 px-4 py-2 text-xs text-red-700">
                    <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate">{mail.error.message}</span>
                  </p>
                )}

                {isExpanded && <MailDetail id={mail.id} />}
              </li>
            )
          })}
        </ul>
      )}

      {/* --- Pagination ---------------------------------------------------- */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            Page {pagination.page} of {pagination.totalPages} · {pagination.total} message
            {pagination.total === 1 ? '' : 's'}
          </p>

          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={!pagination.hasPreviousPage || isLoading}
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
              Previous
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage((current) => current + 1)}
              disabled={!pagination.hasNextPage || isLoading}
            >
              Next
              <ChevronRight className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export default MailHistoryPage
