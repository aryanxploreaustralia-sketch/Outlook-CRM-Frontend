/**
 * Email engine counters.
 *
 * Four figures plus a success rate. The rate is the one that carries meaning on
 * its own — "12 sent" says nothing without knowing how many were attempted — so
 * it gets the prominent treatment and the raw counts sit underneath.
 */

import { Link } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, Clock, FileText, PenSquare } from 'lucide-react'

import { ROUTE_PATHS } from '@/routes/paths'

/**
 * Colour for the success-rate figure.
 *
 * Thresholds are deliberately forgiving at the top: a single failure out of
 * twenty is normal operationally (a full mailbox, a bad address) and should not
 * paint the dashboard red.
 */
function rateTone(rate) {
  if (rate === null) return 'text-slate-400'
  if (rate >= 95) return 'text-emerald-600'
  if (rate >= 80) return 'text-amber-600'
  return 'text-red-600'
}

/** One counter tile. */
function Stat({ icon: Icon, label, value, tone, to }) {
  const content = (
    <>
      <span className={`grid size-7 shrink-0 place-items-center rounded-md ${tone}`}>
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block text-lg font-semibold leading-tight text-slate-900">{value}</span>
        <span className="block truncate text-xs text-slate-500">{label}</span>
      </span>
    </>
  )

  const className =
    'flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-3 py-2.5'

  // Only the counters that lead somewhere useful become links, so a tile that
  // looks clickable always is.
  return to ? (
    <Link to={to} className={`${className} transition-colors hover:border-brand-300 hover:bg-brand-50/40`}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  )
}

/**
 * @param {{ mail?: object }} props
 */
export function MailStatsCard({ mail }) {
  const stats = mail ?? {}
  const rate = stats.successRate ?? null

  return (
    <section className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
      <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-slate-900">Email engine</h2>
          <p className="mt-0.5 text-xs text-slate-500">Delivery outcomes for your mailbox</p>
        </div>

        <Link
          to={ROUTE_PATHS.COMPOSE}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-brand-600 transition-colors hover:bg-brand-50"
        >
          <PenSquare className="size-3.5" aria-hidden="true" />
          Compose
        </Link>
      </header>

      <div className="px-5 py-4">
        {/* --- Success rate ------------------------------------------------ */}
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <p className={`text-3xl font-semibold leading-none ${rateTone(rate)}`}>
              {rate === null ? '—' : `${rate}%`}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {rate === null
                ? 'No messages sent yet'
                : `Success rate across ${stats.totalSent + stats.totalFailed} attempts`}
            </p>
          </div>

          {stats.unavailable && (
            <span className="text-xs text-slate-400">Statistics unavailable</span>
          )}
        </div>

        {/* Bar omitted when nothing has been attempted — a 0%-wide bar reads as
            failure rather than as "no data". */}
        {rate !== null && (
          <div
            className="mb-4 h-1.5 overflow-hidden rounded-full bg-slate-200"
            role="progressbar"
            aria-valuenow={rate}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Send success rate"
          >
            <div
              className={`h-full rounded-full transition-all ${
                rate >= 95 ? 'bg-emerald-500' : rate >= 80 ? 'bg-amber-500' : 'bg-red-500'
              }`}
              style={{ width: `${rate}%` }}
            />
          </div>
        )}

        {/* --- Counters ---------------------------------------------------- */}
        <div className="grid grid-cols-2 gap-2">
          <Stat
            icon={CheckCircle2}
            label="Sent"
            value={stats.totalSent ?? 0}
            tone="bg-emerald-50 text-emerald-600"
            to={`${ROUTE_PATHS.MAIL}`}
          />
          <Stat
            icon={AlertTriangle}
            label="Failed"
            value={stats.totalFailed ?? 0}
            tone="bg-red-50 text-red-600"
            to={`${ROUTE_PATHS.MAIL}`}
          />
          <Stat
            icon={Clock}
            label="Pending"
            value={stats.totalPending ?? 0}
            tone="bg-amber-50 text-amber-600"
          />
          <Stat
            icon={FileText}
            label="Drafts"
            value={stats.totalDrafts ?? 0}
            tone="bg-slate-100 text-slate-600"
          />
        </div>
      </div>
    </section>
  )
}

export default MailStatsCard
