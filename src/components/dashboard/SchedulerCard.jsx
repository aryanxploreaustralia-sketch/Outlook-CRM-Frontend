/**
 * The morning scheduler card.
 *
 * Answers the three questions the brief asks for, and only those: when did the
 * automation last run, when does it run next, and how did the last one end.
 *
 * Unlike `ContactsCard`, it takes its data from the dashboard payload rather
 * than fetching its own. The values are three fields on a document the server
 * has already read, so a second round trip would cost more than it saves — and
 * it keeps the card describing the same instant as everything beside it.
 */

import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  CircleSlash,
  Clock,
  Loader2,
  PauseCircle,
  RotateCw,
} from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { ROUTE_PATHS } from '@/routes/paths'
import { formatDateTime } from '@/utils/datetime'

/** Absent renders as nothing here; the callers supply their own wording. */
const displayDateTimeOrNull = (value) => formatDateTime(value, { empty: null })

/** Formats an ISO timestamp, tolerating null and invalid input. */
/**
 * How each outcome is presented.
 *
 * `skipped` is amber-free on purpose. "No workbook was exported this morning"
 * is the system working, and a warning colour on an ordinary day trains people
 * to ignore the one morning it matters.
 */
const STATUS_PRESENTATION = {
  queued: { icon: CheckCircle2, tone: 'bg-emerald-50 text-emerald-600', label: 'Queued' },
  running: { icon: Loader2, tone: 'bg-blue-50 text-blue-600', label: 'Running' },
  skipped: { icon: CircleSlash, tone: 'bg-slate-100 text-slate-500', label: 'Skipped' },
  retrying: { icon: RotateCw, tone: 'bg-amber-50 text-amber-600', label: 'Retrying' },
  failed: { icon: AlertTriangle, tone: 'bg-red-50 text-red-600', label: 'Failed' },
  idle: { icon: Clock, tone: 'bg-slate-100 text-slate-500', label: 'Not run yet' },
}

/** @param {{ scheduler: ?object }} props */
export function SchedulerCard({ scheduler }) {
  // Null when the collection could not be read, or when this workspace has no
  // settings document yet. Rendering nothing is better than rendering "off",
  // which would be a claim the card cannot support.
  if (!scheduler) return null

  const status = scheduler.lastStatus ?? 'idle'
  const presentation = STATUS_PRESENTATION[status] ?? STATUS_PRESENTATION.idle
  const StatusIcon = presentation.icon

  const lastRunAt = displayDateTimeOrNull(scheduler.lastRunAt)
  const nextRunAt = displayDateTimeOrNull(scheduler.nextRunAt)

  return (
    <section className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
      <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-600/10">
            <CalendarClock className="size-[18px]" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-slate-900">Morning run</h2>
            <p className="truncate text-xs text-slate-500">
              {scheduler.enabled
                ? `Every day at ${scheduler.runTime} · ${scheduler.timezone}`
                : 'Automatic running is switched off'}
            </p>
          </div>
        </div>

        {scheduler.enabled ? (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
            <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
            On
          </span>
        ) : (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
            <PauseCircle className="size-3.5" aria-hidden="true" />
            Off
          </span>
        )}
      </header>

      <div className="flex-1 space-y-3 px-5 py-4">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
            <span className="block text-xs text-slate-500">Last scheduled run</span>
            <span className="mt-0.5 block truncate text-sm font-medium text-slate-900">
              {lastRunAt ?? 'Never'}
            </span>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
            <span className="block text-xs text-slate-500">Next scheduled run</span>
            <span className="mt-0.5 block truncate text-sm font-medium text-slate-900">
              {/* Null whenever the schedule is off — there is no next run to name. */}
              {nextRunAt ?? '—'}
            </span>
          </div>
        </div>

        <div className="flex items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2.5">
          <span className={`grid size-7 shrink-0 place-items-center rounded-md ${presentation.tone}`}>
            <StatusIcon
              className={`size-4 ${status === 'running' ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
          </span>
          <div className="min-w-0">
            <span className="block text-sm font-medium text-slate-900">
              {scheduler.lastStatusLabel ?? presentation.label}
            </span>
            <span className="block text-xs leading-relaxed text-slate-500">
              {scheduler.lastMessage ?? 'The scheduler has not run for this workspace yet.'}
            </span>
          </div>
        </div>

        {scheduler.sendMail === false && (
          <p className="flex items-start gap-1.5 text-xs text-amber-700">
            <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
            <span>
              Automatic emailing is off for scheduled runs. New enquiries are created but nobody is
              written to.
            </span>
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3">
        <Button as={Link} to={ROUTE_PATHS.SETTINGS} size="sm" variant="secondary">
          <CalendarClock className="size-3.5" aria-hidden="true" />
          Scheduler settings
        </Button>
        {scheduler.lastImportJob && (
          <Button as={Link} to={ROUTE_PATHS.LEAD_IMPORT} size="sm" variant="ghost">
            View the last import
          </Button>
        )}
      </div>
    </section>
  )
}

export default SchedulerCard
