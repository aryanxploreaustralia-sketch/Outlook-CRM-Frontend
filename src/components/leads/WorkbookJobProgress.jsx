/**
 * Live progress for a queued workbook run.
 *
 * The operator has just handed over a file and been told "it's running". This
 * has to answer the two questions that follow — how far along, and how much
 * longer — without them having to refresh anything.
 *
 * Deliberately names the phase rather than showing a bar alone: the slow part
 * is almost always `mailing`, which is paced to protect the mailbox, and a bar
 * that appears stuck at 100% while messages go out one every two seconds reads
 * as a hang. Saying "sending introductions" makes the same wait legible.
 */

import { AlertTriangle, Ban, CheckCircle2, Clock, Loader2, Mail } from 'lucide-react'

import { Button } from '@/components/ui/Button'

/** What each phase is doing, in the operator's terms. */
const PHASE_LABELS = Object.freeze({
  queued: 'Waiting to start',
  comparing: 'Reading the workbook',
  creating: 'Creating enquiries',
  mailing: 'Sending introductions',
  finalising: 'Finishing up',
  done: 'Done',
})

const STATUS_STYLES = Object.freeze({
  queued: { bar: 'bg-slate-400', ring: 'ring-slate-200', tint: 'bg-slate-50' },
  running: { bar: 'bg-blue-500', ring: 'ring-blue-200', tint: 'bg-blue-50' },
  completed: { bar: 'bg-emerald-500', ring: 'ring-emerald-200', tint: 'bg-emerald-50' },
  partial: { bar: 'bg-amber-500', ring: 'ring-amber-200', tint: 'bg-amber-50' },
  failed: { bar: 'bg-rose-500', ring: 'ring-rose-200', tint: 'bg-rose-50' },
  cancelled: { bar: 'bg-slate-400', ring: 'ring-slate-200', tint: 'bg-slate-50' },
})

const formatDuration = (ms) => {
  if (!ms || ms < 1000) return null
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
}

/**
 * @param {{ job: ?object, onCancel: () => void, isCancelling: boolean }} props
 */
export function WorkbookJobProgress({ job, onCancel, isCancelling }) {
  if (!job) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-5">
        <Loader2 className="size-5 animate-spin text-slate-400" aria-hidden="true" />
        <p className="text-sm text-slate-600">Queueing the workbook…</p>
      </div>
    )
  }

  const style = STATUS_STYLES[job.status] ?? STATUS_STYLES.running
  const isInFlight = job.status === 'queued' || job.status === 'running'
  const duration = formatDuration(job.durationMs)

  /**
   * Indeterminate until there is something real to measure.
   *
   * A bar reading 0% during the comparison phase suggests nothing is happening;
   * a moving stripe says "working, no estimate yet", which is the truth.
   */
  const isIndeterminate = isInFlight && job.rowsTotal === 0

  return (
    <div className={`rounded-xl border border-slate-200 p-5 ${style.tint}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          {job.status === 'completed' || job.status === 'partial' ? (
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" aria-hidden="true" />
          ) : job.status === 'failed' ? (
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-rose-600" aria-hidden="true" />
          ) : job.status === 'cancelled' ? (
            <Ban className="mt-0.5 size-5 shrink-0 text-slate-500" aria-hidden="true" />
          ) : job.status === 'queued' ? (
            <Clock className="mt-0.5 size-5 shrink-0 text-slate-500" aria-hidden="true" />
          ) : (
            <Loader2 className="mt-0.5 size-5 shrink-0 animate-spin text-blue-600" aria-hidden="true" />
          )}

          <div>
            <p className="text-sm font-semibold text-slate-900">
              {job.statusLabel ?? job.status}
              {isInFlight && job.step && (
                <span className="font-normal text-slate-600"> — {PHASE_LABELS[job.step] ?? job.step}</span>
              )}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              {job.filename}
              {job.sheet && ` · ${job.sheet}`}
              {duration && ` · ${duration}`}
              {job.attempts > 1 && ` · resumed (attempt ${job.attempts})`}
            </p>
          </div>
        </div>

        {isInFlight && (
          <Button variant="ghost" size="sm" onClick={onCancel} isLoading={isCancelling}>
            <Ban className="size-3.5" aria-hidden="true" />
            {job.cancelRequested ? 'Stopping…' : 'Cancel'}
          </Button>
        )}
      </div>

      {/* --- Bar ------------------------------------------------------------ */}
      <div
        className="mt-4 h-2 overflow-hidden rounded-full bg-white/70"
        role="progressbar"
        aria-valuenow={isIndeterminate ? undefined : job.percentComplete}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Import progress"
      >
        {isIndeterminate ? (
          <div className={`h-full w-1/3 animate-pulse rounded-full ${style.bar}`} />
        ) : (
          <div
            className={`h-full rounded-full transition-[width] duration-500 ${style.bar}`}
            style={{ width: `${job.percentComplete}%` }}
          />
        )}
      </div>

      {/* --- Counters -------------------------------------------------------- */}
      <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-600">
        {job.rowsTotal > 0 && (
          <div>
            <dt className="inline">Rows </dt>
            <dd className="inline font-medium tabular-nums text-slate-900">
              {job.rowsProcessed.toLocaleString()} / {job.rowsTotal.toLocaleString()}
            </dd>
          </div>
        )}

        <div>
          <dt className="inline">
            <Mail className="mr-1 inline size-3" aria-hidden="true" />
            Emails sent{' '}
          </dt>
          <dd className="inline font-medium tabular-nums text-slate-900">
            {(job.emailsSent ?? 0).toLocaleString()}
          </dd>
        </div>

        {job.errorCount > 0 && (
          <div>
            <dt className="inline">Problem rows </dt>
            <dd className="inline font-medium tabular-nums text-amber-700">
              {job.errorCount.toLocaleString()}
            </dd>
          </div>
        )}
      </dl>

      {isInFlight && (
        <p className="mt-3 text-xs text-slate-500">
          This runs on the server. You can leave this page — the import carries on, and its
          result appears in the upload history.
        </p>
      )}

      {job.lastError?.message && (
        <p
          role={job.status === 'failed' ? 'alert' : 'status'}
          className={`mt-3 rounded-lg px-3 py-2 text-xs ring-1 ring-inset ${
            job.status === 'failed'
              ? 'bg-rose-50 text-rose-700 ring-rose-200'
              : 'bg-slate-100 text-slate-600 ring-slate-200'
          }`}
        >
          {job.lastError.message}
        </p>
      )}
    </div>
  )
}

export default WorkbookJobProgress
