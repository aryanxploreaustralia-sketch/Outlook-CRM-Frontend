/**
 * Follow-ups — enquiries that were emailed and never answered.
 *
 * ## Nothing here decides who is eligible
 *
 * The queue, the counts and every refusal come from `GET /v1/leads/follow-up`.
 * This page selects and composes; the server decides. That matters more than
 * usual because the decision is "may we email this customer again", and the
 * answer can change between the list loading and the operator pressing send —
 * a reply arriving is exactly the case the feature exists to respect.
 *
 * So the send response, not the local selection, is what the results panel
 * reports. A lead the server skipped is shown as skipped with its reason, even
 * though it was ticked here a moment earlier.
 *
 * ## Sending is always a deliberate act
 *
 * Selecting rows sends nothing. The composer opens with the default wording,
 * the operator can edit it, and only the confirm button in that dialog reaches
 * the API. There is no scheduler and no automatic sequence behind this screen.
 */

import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Check, Mail, RefreshCw, Search, X } from 'lucide-react'

import { fetchFollowUps, sendFollowUps } from '@/api/services/followUp.service'
import { ErrorScreen } from '@/components/common/ErrorScreen'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { useApiResource } from '@/hooks/useApiResource'
// Lives under `admin/hooks` but is a generic utility with nothing admin about
// it. Imported rather than copied: two debounce hooks is how two screens end up
// with different delays and neither is the one anybody tuned.
import { useDebouncedValue } from '@/admin/hooks/useDebouncedValue'
import { RemarkCell } from '@/components/leads/RemarkCell'
import { ROUTE_PATHS } from '@/routes/paths'
import { formatDate } from '@/utils/datetime'

const PAGE_SIZE = 50

/** Mirrors the server's `REPLY_STATUS`. Labels only; the values are the API's. */
const REPLY_STATUS_OPTIONS = [
  { value: '', label: 'No reply (eligible)' },
  { value: 'replied', label: 'Replied' },
  { value: 'failed', label: 'Send failed' },
  { value: 'skipped', label: 'Never sent' },
]

const FOLLOW_UP_STATUS_OPTIONS = [
  { value: '', label: 'Any follow-up state' },
  { value: 'sent', label: 'Follow-up sent' },
]

const WAITING_OPTIONS = [
  { value: '', label: 'Any wait' },
  { value: '2', label: '2+ days' },
  { value: '3', label: '3+ days' },
  { value: '5', label: '5+ days' },
  { value: '7', label: '7+ days' },
  { value: '14', label: '14+ days' },
]

const STATUS_TONE = {
  no_reply: 'bg-amber-50 text-amber-700 ring-amber-200',
  replied: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  failed: 'bg-rose-50 text-rose-700 ring-rose-200',
  skipped: 'bg-slate-100 text-slate-600 ring-slate-200',
  not_sent: 'bg-slate-100 text-slate-600 ring-slate-200',
}

const STATUS_LABEL = {
  no_reply: 'No reply',
  replied: 'Replied',
  failed: 'Failed',
  skipped: 'Not sent',
  not_sent: 'Not sent',
}

function Pill({ status }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
        STATUS_TONE[status] ?? STATUS_TONE.not_sent
      }`}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  )
}

function Stat({ label, value, tone = 'text-slate-900' }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${tone}`}>{value ?? '—'}</p>
    </div>
  )
}


export function FollowUpPage() {
  const [searchInput, setSearchInput] = useState('')
  const search = useDebouncedValue(searchInput)

  const [replyStatus, setReplyStatus] = useState('')
  const [followUpStatus, setFollowUpStatus] = useState('')
  const [market, setMarket] = useState('')
  const [minWaitingDays, setMinWaitingDays] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)

  const [selected, setSelected] = useState(new Set())
  const [composer, setComposer] = useState(null)
  const [isSending, setIsSending] = useState(false)
  const [outcome, setOutcome] = useState(null)

  const query = useMemo(
    () => ({ search, replyStatus, followUpStatus, market, minWaitingDays, from, to, page, limit: PAGE_SIZE }),
    [search, replyStatus, followUpStatus, market, minWaitingDays, from, to, page],
  )

  const fetcher = useCallback(({ signal }) => fetchFollowUps(query, { signal }), [query])
  const { data, error, isInitialLoading, refresh } = useApiResource(fetcher)

  const items = data?.items ?? []
  const summary = data?.summary
  const pagination = data?.pagination
  const meta = data?.meta

  /** Only eligible rows may be ticked — the rest are shown for context. */
  const selectable = items.filter((row) => row.followUpStatus === 'eligible')
  const chosen = items.filter((row) => selected.has(row.leadId))

  const resetFilters = () => {
    setSearchInput('')
    setReplyStatus('')
    setFollowUpStatus('')
    setMarket('')
    setMinWaitingDays('')
    setFrom('')
    setTo('')
    setPage(1)
  }

  const activeFilters = [search, replyStatus, followUpStatus, market, minWaitingDays, from, to].filter(Boolean).length

  const openComposer = () => {
    setOutcome(null)
    setComposer({
      subject: meta?.defaultTemplate?.subject ?? '',
      body: meta?.defaultTemplate?.body ?? '',
    })
  }

  const confirmSend = async () => {
    setIsSending(true)
    try {
      const result = await sendFollowUps({
        leadIds: chosen.map((row) => row.leadId),
        subject: composer.subject,
        body: composer.body,
      })

      setOutcome(result)
      setComposer(null)
      setSelected(new Set())
      // The queue has changed for anything that went out, so it is re-read
      // rather than patched locally — the server is the authority on who is
      // still waiting.
      refresh()
    } catch (thrown) {
      setOutcome({ error: thrown?.message ?? 'The follow-up could not be sent.' })
      setComposer(null)
    } finally {
      setIsSending(false)
    }
  }

  if (error) return <ErrorScreen error={error} onRetry={refresh} />

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-slate-900">Follow-ups</h1>
          <p className="mt-0.5 text-sm text-slate-600">
            Enquiries introduced by email that have not been answered
            {meta?.waitDays ? ` for ${meta.waitDays}+ days` : ''}. Replies are detected from the mailbox,
            so an enquiry leaves this list on its own once the customer writes back.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={refresh}>
          <RefreshCw className="size-3.5" aria-hidden="true" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Awaiting a reply" value={summary?.eligible} tone="text-amber-700" />
        <Stat label="In this view" value={summary?.inView} />
        <Stat label="Follow-up sent" value={summary?.followedUp} />
        <Stat label="Replied" value={summary?.replied} tone="text-emerald-700" />
      </div>

      {/* --- Results of the last send ------------------------------------ */}
      {outcome && (
        <div
          role="status"
          className={`rounded-xl border p-4 text-sm ${
            outcome.error || outcome.failed > 0
              ? 'border-amber-200 bg-amber-50'
              : 'border-emerald-200 bg-emerald-50'
          }`}
        >
          <div className="flex items-start gap-2.5">
            {outcome.error || outcome.failed > 0 ? (
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden="true" />
            ) : (
              <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden="true" />
            )}
            <div className="min-w-0 flex-1">
              {outcome.error ? (
                <p className="font-medium text-amber-900">{outcome.error}</p>
              ) : (
                <>
                  <p className="font-medium text-slate-900">
                    {outcome.sent} sent
                    {outcome.skipped > 0 ? `, ${outcome.skipped} skipped` : ''}
                    {outcome.failed > 0 ? `, ${outcome.failed} failed` : ''}
                  </p>
                  {/* Every non-send is named. A batch reported only as a total
                      is how somebody concludes all ten were emailed. */}
                  <ul className="mt-1.5 space-y-0.5 text-xs text-slate-700">
                    {(outcome.results ?? [])
                      .filter((entry) => entry.outcome !== 'sent')
                      .map((entry) => (
                        <li key={entry.leadId}>
                          <span className="font-medium">{entry.reference ?? entry.leadId}</span>
                          {' — '}
                          {entry.reasonLabel ?? entry.error ?? entry.outcome}
                        </li>
                      ))}
                  </ul>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={() => setOutcome(null)}
              className="shrink-0 rounded px-2 py-0.5 text-xs font-medium text-slate-600 hover:bg-white/60"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* --- Filters ------------------------------------------------------ */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="relative sm:col-span-2">
            <span className="sr-only">Search enquiries</span>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchInput}
              onChange={(event) => {
                setSearchInput(event.target.value)
                setPage(1)
              }}
              placeholder="Reference, customer, company or email…"
              className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </label>

          {[
            { value: replyStatus, set: setReplyStatus, options: REPLY_STATUS_OPTIONS, label: 'Reply status' },
            { value: followUpStatus, set: setFollowUpStatus, options: FOLLOW_UP_STATUS_OPTIONS, label: 'Follow-up status' },
            {
              value: market,
              set: setMarket,
              options: [{ value: '', label: 'All markets' }, ...(meta?.markets ?? [])],
              label: 'Market',
            },
            { value: minWaitingDays, set: setMinWaitingDays, options: WAITING_OPTIONS, label: 'Waiting time' },
          ].map((control) => (
            <label key={control.label} className="min-w-0">
              <span className="sr-only">{control.label}</span>
              <select
                value={control.value}
                onChange={(event) => {
                  control.set(event.target.value)
                  setPage(1)
                }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              >
                {control.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          ))}

          {/* The window applies to the introduction, which is the date this
              page is actually asked about. */}
          {[
            { label: 'Emailed from', value: from, set: setFrom },
            { label: 'Emailed to', value: to, set: setTo },
          ].map((bound) => (
            <label key={bound.label} className="min-w-0 text-xs font-medium text-slate-600">
              {bound.label}
              <input
                type="date"
                value={bound.value}
                onChange={(event) => {
                  bound.set(event.target.value)
                  setPage(1)
                }}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
            </label>
          ))}
        </div>

        {activeFilters > 0 && (
          <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">
            <span className="text-xs text-slate-500">
              {activeFilters} filter{activeFilters === 1 ? '' : 's'} applied
            </span>
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
            >
              <X className="size-3.5" aria-hidden="true" />
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* --- Selection toolbar -------------------------------------------- */}
      {chosen.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-brand-200 bg-brand-50/60 px-4 py-3">
          <span className="text-sm font-medium text-slate-900">
            {chosen.length} lead{chosen.length === 1 ? '' : 's'} selected
          </span>
          <Button size="sm" onClick={openComposer}>
            <Mail className="size-3.5" aria-hidden="true" />
            Send follow-up
          </Button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-white"
          >
            Clear selection
          </button>
        </div>
      )}

      {/* --- The queue ----------------------------------------------------- */}
      {isInitialLoading ? (
        <div className="flex justify-center py-24">
          <Spinner label="Loading follow-ups" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-sm font-medium text-slate-900">
            {activeFilters > 0 ? 'No enquiries match these filters' : 'Nobody is waiting on a reply'}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            {activeFilters > 0
              ? 'Clear the filters to see the whole queue.'
              : 'Every enquiry that was emailed has either been answered or already followed up.'}
          </p>
          {activeFilters > 0 && (
            <Button variant="secondary" size="sm" className="mt-4" onClick={resetFilters}>
              Clear filters
            </Button>
          )}
        </div>
      ) : (
        <div className="scroll-x overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="w-10 px-3 py-2">
                  <input
                    type="checkbox"
                    aria-label="Select every eligible enquiry on this page"
                    disabled={selectable.length === 0}
                    checked={selectable.length > 0 && selectable.every((row) => selected.has(row.leadId))}
                    onChange={(event) =>
                      setSelected(
                        event.target.checked ? new Set(selectable.map((row) => row.leadId)) : new Set(),
                      )
                    }
                    className="size-4 rounded border-slate-300"
                  />
                </th>
                <th scope="col" className="px-3 py-2">Reference</th>
                <th scope="col" className="px-3 py-2">Customer</th>
                <th scope="col" className="px-3 py-2">Market</th>
                <th scope="col" className="px-3 py-2">Remarks</th>
                <th scope="col" className="px-3 py-2">Quoted</th>
                <th scope="col" className="px-3 py-2">Introduced</th>
                <th scope="col" className="px-3 py-2" title="Whole days since the quote date">
                  Waiting
                </th>
                <th scope="col" className="px-3 py-2">Reply</th>
                <th scope="col" className="px-3 py-2">Follow-up</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {items.map((row) => {
                const isEligible = row.followUpStatus === 'eligible'

                return (
                  <tr key={row.leadId} className="hover:bg-slate-50/70">
                    <td className="px-3 py-2.5">
                      <input
                        type="checkbox"
                        aria-label={`Select ${row.reference}`}
                        // Only eligible rows can be chosen. The rest are here
                        // for context — the server would refuse them anyway.
                        disabled={!isEligible}
                        checked={selected.has(row.leadId)}
                        onChange={(event) =>
                          setSelected((current) => {
                            const next = new Set(current)
                            if (event.target.checked) next.add(row.leadId)
                            else next.delete(row.leadId)
                            return next
                          })
                        }
                        className="size-4 rounded border-slate-300 disabled:cursor-not-allowed disabled:opacity-40"
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <Link
                        to={ROUTE_PATHS.LEAD_DETAIL.replace(':id', row.leadId)}
                        className="font-medium text-slate-900 no-underline hover:text-brand-700 hover:underline"
                      >
                        {row.reference}
                      </Link>
                      <p className="truncate text-xs text-slate-500">{row.company ?? 'No company'}</p>
                    </td>
                    <td className="px-3 py-2.5">
                      <p className="truncate text-slate-700">{row.customerName}</p>
                      <p className="truncate text-xs text-slate-500">{row.email}</p>
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">{row.market ?? '—'}</td>
                    {/* Truncated to one line so the queue stays scannable;
                        clicking opens the whole remark. */}
                    <td className="max-w-56 px-3 py-2.5 text-slate-600">
                      <RemarkCell remarks={row.remarks} reference={row.reference} />
                    </td>
                    {/* The reference date the follow-up clock runs from. */}
                    <td className="px-3 py-2.5 text-slate-600">{formatDate(row.quoteDate)}</td>
                    <td className="px-3 py-2.5 text-slate-600">{formatDate(row.initialEmailSentAt)}</td>
                    <td
                      className="px-3 py-2.5 tabular-nums text-slate-700"
                      title={row.quoteDate ? 'Days since the quote date' : 'This enquiry has no quote date'}
                    >
                      {/* Server-computed. Nothing here re-derives the age — the
                          counts and the list would drift apart if it did. */}
                      {row.waitingDays === null ? '—' : `${row.waitingDays}d`}
                    </td>
                    <td className="px-3 py-2.5"><Pill status={row.replyStatus} /></td>
                    <td className="px-3 py-2.5 text-slate-600">
                      {row.followUpCount > 0
                        ? `Sent ${formatDate(row.lastFollowUpAt)}`
                        : isEligible
                          ? 'Eligible'
                          : 'Not eligible'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {pagination?.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-slate-600">
            Page {pagination.page} of {pagination.totalPages} · {pagination.total} enquiries
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={!pagination.hasPrevious}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={!pagination.hasNext}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* --- Composer ------------------------------------------------------ */}
      {composer && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-6">
          <div className="flex max-h-[90svh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-sm font-semibold text-slate-900">Send follow-up</h2>
              <p className="mt-0.5 text-xs text-slate-600">
                {chosen.length} recipient{chosen.length === 1 ? '' : 's'}. Each lead is re-checked as it is
                sent — anyone who has replied since this list loaded will be skipped.
              </p>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
              <label className="block">
                <span className="text-xs font-medium text-slate-600">Subject</span>
                <input
                  type="text"
                  value={composer.subject}
                  onChange={(event) => setComposer((c) => ({ ...c, subject: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </label>

              <label className="block">
                <span className="text-xs font-medium text-slate-600">Message</span>
                <textarea
                  rows={12}
                  value={composer.body}
                  onChange={(event) => setComposer((c) => ({ ...c, body: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs leading-relaxed focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </label>

              <p className="text-xs text-slate-500">
                Personalised per recipient:{' '}
                <code className="rounded bg-slate-100 px-1">{'{{customerName}}'}</code>{' '}
                <code className="rounded bg-slate-100 px-1">{'{{companyName}}'}</code>{' '}
                <code className="rounded bg-slate-100 px-1">{'{{reference}}'}</code>{' '}
                <code className="rounded bg-slate-100 px-1">{'{{senderName}}'}</code>
              </p>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-medium text-slate-600">Recipients</p>
                <ul className="mt-1 max-h-32 space-y-0.5 overflow-y-auto text-xs text-slate-600">
                  {chosen.map((row) => (
                    <li key={row.leadId}>
                      {row.reference} — {row.customerName} &lt;{row.email}&gt;
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
              <Button variant="secondary" size="sm" onClick={() => setComposer(null)} disabled={isSending}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={confirmSend}
                isLoading={isSending}
                disabled={isSending || !composer.subject.trim() || !composer.body.trim()}
              >
                <Mail className="size-3.5" aria-hidden="true" />
                Send to {chosen.length}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default FollowUpPage
