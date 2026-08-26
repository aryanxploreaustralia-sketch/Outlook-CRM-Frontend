/**
 * The month grid: what is happening, and when.
 *
 * ## It complements Travel soon rather than repeating it
 *
 * Travel soon answers "who is going next", as a list, over a rolling window.
 * This answers "which dates are busy", as a shape, over a named month — the
 * question a list of five rows cannot answer at all. Neither reads the other's
 * data: this one calls the calendar endpoint, which returns counts.
 *
 * ## Counts come down, records do not
 *
 * The grid renders about 150 integers. Fetching the enquiries behind them to
 * count in the browser would mean downloading every departure in the month to
 * draw thirty dots, so the grouping happens in MongoDB. Records are fetched for
 * exactly one date, when somebody opens it.
 *
 * ## Dates are strings here, deliberately
 *
 * Every day is keyed by its `YYYY-MM-DD`, which is what the server groups by.
 * Comparing `Date` objects across a month boundary means thinking about
 * timezones on every comparison; comparing `'2026-08-29'` does not, and cannot
 * drift. `Date` is used only to walk the calendar, never to identify a cell.
 */

import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'

import { AdminCard } from '@/admin/components/AdminCard'
import { AdminErrorState } from '@/admin/components/AdminErrorState'
import { AdminModal } from '@/admin/components/AdminModal'
import { useAdminResource } from '@/admin/hooks'
import { ADMIN_PATHS } from '@/admin/routes/adminPaths'
import { fetchAdminCalendar, fetchAdminCalendarDay } from '@/admin/services/admin.service'
import { EMPTY } from '@/admin/utils/format'
import { Button } from '@/components/ui/Button'
import { buildMonthGrid, describeKey, MONTHS, todayKey, WEEKDAYS } from '@/admin/utils/calendarGrid'
import { formatTime } from '@/utils/datetime'

/**
 * The four kinds, in the order they are counted and listed.
 *
 * Travel leads because this is a travel CRM: it is the question the calendar
 * exists to answer, so its indicator is the one that reads first. The others
 * are the same size and weight as each other — priority, not dominance.
 */
const KINDS = [
  { key: 'travel', label: 'Travel', dot: 'bg-violet-500', text: 'text-violet-700', soft: 'bg-violet-50' },
  { key: 'followUp', label: 'Follow-ups', dot: 'bg-emerald-500', text: 'text-emerald-700', soft: 'bg-emerald-50' },
  { key: 'activity', label: 'Activities', dot: 'bg-sky-500', text: 'text-sky-700', soft: 'bg-sky-50' },
  { key: 'task', label: 'Tasks', dot: 'bg-amber-500', text: 'text-amber-700', soft: 'bg-amber-50' },
]

/** The reader's IANA zone, for grouping task due-times server-side. */
const readerTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

// ---------------------------------------------------------------------------
// The day drawer
// ---------------------------------------------------------------------------

/**
 * One date's records.
 *
 * Fetched only when opened, and only for that date. Every lead links to the
 * console's existing enquiry page — there is no second lead detail here.
 */
function DayDetail({ date, onClose }) {
  const loader = useCallback(
    (options) => fetchAdminCalendarDay(date, { tz: readerTimezone(), ...options }),
    [date],
  )
  const { data, error, isLoading, refresh } = useAdminResource(loader, { deps: [date] })

  // Long form for the heading, the CRM's `DD/MM/YYYY` beneath it.
  const { short, long } = describeKey(date)

  return (
    <AdminModal isOpen onClose={onClose} title={long} description={short} size="lg">
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }, (_, index) => (
            <span key={index} className="skeleton block h-8 w-full" />
          ))}
        </div>
      ) : error ? (
        <AdminErrorState error={error} onRetry={refresh} compact />
      ) : (
        <div className="space-y-5">
          {KINDS.every((kind) => (data?.[kind.key]?.total ?? 0) === 0) && (
            <p className="text-sm text-slate-500">Nothing is scheduled on this date.</p>
          )}

          {KINDS.map((kind) => {
            const section = data?.[kind.key]
            if (!section || section.total === 0) return null

            return (
              <section key={kind.key}>
                <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">
                  <span className={`size-1.5 rounded-full ${kind.dot}`} aria-hidden="true" />
                  {kind.label}
                  <span className="tabular-nums text-slate-400">{section.total}</span>
                </h3>

                <ul className="mt-2 divide-y divide-slate-100 border-t border-slate-100">
                  {kind.key === 'travel'
                    ? section.items.map((lead) => (
                        <li key={lead.id}>
                          <Link
                            to={ADMIN_PATHS.LEAD_DETAIL.replace(':id', lead.id)}
                            onClick={onClose}
                            className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-2 transition-colors hover:bg-slate-50"
                          >
                            <span className="w-24 shrink-0 font-mono text-xs font-medium text-brand-700">
                              {lead.reference}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-sm text-slate-700">
                              {lead.customer ?? EMPTY}
                            </span>
                            <span className="shrink-0 text-xs text-slate-500">{lead.market ?? EMPTY}</span>
                            <span className="w-32 shrink-0 truncate text-right text-xs text-slate-500">
                              {lead.owner ?? 'Unassigned'}
                            </span>
                          </Link>
                        </li>
                      ))
                    : section.items.map((item) => (
                        <li
                          key={item.id}
                          className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-2"
                        >
                          {/* No time is invented. A record without one reads as
                              all-day, which is what it is. */}
                          <span className="w-14 shrink-0 text-xs tabular-nums text-slate-500">
                            {item.dueAt ? formatTime(item.dueAt) : 'All day'}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm text-slate-700">{item.title}</span>
                          <span className="w-32 shrink-0 truncate text-right text-xs text-slate-500">
                            {item.owner ?? 'Unassigned'}
                          </span>
                        </li>
                      ))}
                </ul>

                {section.total > section.items.length && (
                  <p className="mt-1.5 text-xs text-slate-400">
                    Showing {section.items.length} of {section.total}.
                    {kind.key === 'travel' && (
                      <>
                        {' '}
                        <Link
                          to={`${ADMIN_PATHS.LEAD_MONITOR}?dateField=travelDate&from=${date}&to=${date}`}
                          onClick={onClose}
                          className="font-medium text-brand-700 hover:underline"
                        >
                          View all {section.total} in the Lead monitor
                        </Link>
                      </>
                    )}
                  </p>
                )}
              </section>
            )
          })}
        </div>
      )}
    </AdminModal>
  )
}

// ---------------------------------------------------------------------------
// The calendar
// ---------------------------------------------------------------------------

export function AdminCalendar() {
  const now = new Date()
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() })
  const [kindFilter, setKindFilter] = useState('all')
  const [openDate, setOpenDate] = useState(null)

  const cells = useMemo(() => buildMonthGrid(cursor.year, cursor.month), [cursor])

  // The grid's own span, so padding days are counted too — a departure on the
  // 31st of last month is visible in this month's first row and must be real.
  const from = cells[0].key
  const to = cells[cells.length - 1].key

  const loader = useCallback(
    (options) => fetchAdminCalendar({ from, to, tz: readerTimezone(), ...options }),
    [from, to],
  )
  const { data, error, isLoading, refresh } = useAdminResource(loader, { deps: [from, to] })

  /** Counts by date, for O(1) lookup while rendering cells. */
  const byDate = useMemo(
    () => new Map((data?.days ?? []).map((day) => [day.date, day])),
    [data],
  )

  const visibleKinds = kindFilter === 'all' ? KINDS : KINDS.filter((kind) => kind.key === kindFilter)
  const today = todayKey()

  const step = (delta) =>
    setCursor(({ year, month }) => {
      const next = new Date(year, month + delta, 1)
      return { year: next.getFullYear(), month: next.getMonth() }
    })

  const goToday = () => setCursor({ year: now.getFullYear(), month: now.getMonth() })

  const isThisMonth = cursor.year === now.getFullYear() && cursor.month === now.getMonth()

  /** Counts for a cell, after the filter. */
  const countsFor = (dateKey) => {
    const day = byDate.get(dateKey)
    if (!day) return []
    return visibleKinds
      .map((kind) => ({ ...kind, count: day[kind.key] ?? 0 }))
      .filter((entry) => entry.count > 0)
  }

  const monthHasAnything = (data?.days ?? []).some((day) =>
    visibleKinds.some((kind) => (day[kind.key] ?? 0) > 0),
  )

  return (
    <AdminCard
      title={
        <span className="flex items-center gap-2">
          <CalendarDays className="size-4 text-slate-400" aria-hidden="true" />
          Calendar
        </span>
      }
      description="Travel dates, follow-ups and activities, by date."
      action={
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="calendar-kind" className="sr-only">
            Filter by type
          </label>
          <select
            id="calendar-kind"
            value={kindFilter}
            onChange={(event) => setKindFilter(event.target.value)}
            className="rounded-(--radius-control) border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          >
            <option value="all">All types</option>
            {KINDS.map((kind) => (
              <option key={kind.key} value={kind.key}>
                {kind.label}
              </option>
            ))}
          </select>

          <Button variant="secondary" size="sm" onClick={goToday} disabled={isThisMonth}>
            Today
          </Button>
        </div>
      }
      padded={false}
    >
      {/* --- Month navigation ------------------------------------------------ */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-2.5">
        <button
          type="button"
          onClick={() => step(-1)}
          aria-label="Previous month"
          className="rounded-(--radius-control) p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </button>

        {/* `aria-live` so stepping months is announced — the heading is the only
            thing that changes, and a screen reader would otherwise be silent. */}
        <h3 aria-live="polite" className="text-sm font-semibold text-slate-900">
          {MONTHS[cursor.month]} {cursor.year}
        </h3>

        <button
          type="button"
          onClick={() => step(1)}
          aria-label="Next month"
          className="rounded-(--radius-control) p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </button>
      </div>

      {error ? (
        <div className="p-4">
          <AdminErrorState error={error} onRetry={refresh} compact />
        </div>
      ) : (
        <>
          {/* --- The grid ---------------------------------------------------- */}
          <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/60">
            {WEEKDAYS.map((weekday) => (
              <div
                key={weekday}
                className="px-1 py-1.5 text-center text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500"
              >
                {/* One letter on a narrow screen; the full abbreviation once
                    there is room for it. */}
                <span className="sm:hidden">{weekday[0]}</span>
                <span className="hidden sm:inline">{weekday}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {cells.map((cell) => {
              const counts = countsFor(cell.key)
              const isToday = cell.key === today
              const hasEvents = counts.length > 0

              const spoken = describeKey(cell.key).long
              const summary = hasEvents
                ? `${spoken}, ${counts.map((c) => `${c.count} ${c.label.toLowerCase()}`).join(', ')}`
                : `${spoken}, nothing scheduled`

              const Cell = hasEvents ? 'button' : 'div'

              return (
                <Cell
                  key={cell.key}
                  {...(hasEvents
                    ? {
                        type: 'button',
                        onClick: () => setOpenDate(cell.key),
                        'aria-label': summary,
                      }
                    : { 'aria-label': summary, role: 'gridcell' })}
                  className={`min-h-16 border-b border-r border-slate-100 px-1.5 py-1 text-left transition-colors last:border-r-0 sm:min-h-20 ${
                    hasEvents
                      ? 'cursor-pointer hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500/40'
                      : ''
                  } ${cell.isCurrentMonth ? '' : 'bg-slate-50/40'}`}
                >
                  {/* Today is a ring, not a filled disc: the grid is dense and a
                      solid brand circle would outweigh every event on it. */}
                  <span
                    className={`inline-flex size-5 items-center justify-center rounded-full text-xs tabular-nums ${
                      isToday
                        ? 'font-semibold text-brand-700 ring-1 ring-brand-500'
                        : cell.isCurrentMonth
                          ? 'text-slate-700'
                          : 'text-slate-300'
                    }`}
                  >
                    {cell.day}
                  </span>

                  {isLoading ? (
                    <span className="skeleton mt-1 block h-3 w-8" />
                  ) : (
                    hasEvents && (
                      <span className="mt-0.5 flex flex-col gap-0.5">
                        {counts.slice(0, 3).map((entry) => (
                          <span
                            key={entry.key}
                            className="flex items-center gap-1 text-[11px] leading-tight"
                          >
                            <span className={`size-1.5 shrink-0 rounded-full ${entry.dot}`} aria-hidden="true" />
                            {/* The count is the text, never colour alone. */}
                            <span className={`tabular-nums ${entry.text}`}>{entry.count}</span>
                            <span className="hidden truncate text-slate-400 lg:inline">{entry.label}</span>
                          </span>
                        ))}
                        {counts.length > 3 && (
                          <span className="text-[10px] text-slate-400">+{counts.length - 3} more</span>
                        )}
                      </span>
                    )
                  )}
                </Cell>
              )
            })}
          </div>

          {/* --- Legend and empty month -------------------------------------- */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-2.5 text-[11px] text-slate-500">
            {visibleKinds.map((kind) => (
              <span key={kind.key} className="flex items-center gap-1.5">
                <span className={`size-1.5 rounded-full ${kind.dot}`} aria-hidden="true" />
                {kind.label}
                <span className="tabular-nums text-slate-400">{data?.totals?.[kind.key] ?? 0}</span>
              </span>
            ))}

            {!isLoading && !monthHasAnything && (
              <span className="ml-auto text-slate-400">No scheduled items for this month.</span>
            )}
          </div>
        </>
      )}

      {openDate && <DayDetail date={openDate} onClose={() => setOpenDate(null)} />}
    </AdminCard>
  )
}

export default AdminCalendar
