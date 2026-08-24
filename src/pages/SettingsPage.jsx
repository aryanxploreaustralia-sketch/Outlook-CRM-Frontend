/**
 * Workspace settings — the morning scheduler.
 *
 * ## What this screen is for
 *
 * The scheduler decides when a few hundred customers are written to, without
 * anybody watching. That makes four controls genuinely consequential — on/off,
 * the time, the timezone and whether sending is allowed — and everything on
 * this page is arranged so none of them can be changed by accident or changed
 * without the operator seeing what it currently does.
 *
 * ## Why the form does not save as you type
 *
 * An autosaving toggle that moves the run from 09:00 to 19:00 on a mistyped
 * digit is a bad trade for one click. Changes are staged, the Save button
 * appears only when something differs, and Discard puts it back.
 *
 * The one exception is the on/off switch, which saves immediately: switching
 * the automation off is the thing an operator does *urgently*, usually because
 * something is going wrong, and asking them to then find a Save button is the
 * wrong behaviour at the worst moment.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  CircleSlash,
  Clock,
  FolderInput,
  Inbox,
  Loader2,
  Play,
  RefreshCw,
  RotateCw,
  Save,
  Undo2,
} from 'lucide-react'

import {
  fetchScheduler,
  runSchedulerNow,
  syncRepliesNow,
  updateScheduler,
} from '@/api/services/scheduler.service'
import { ErrorScreen } from '@/components/common/ErrorScreen'
import { Button } from '@/components/ui/Button'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { useApiResource } from '@/hooks/useApiResource'
import { useAuth } from '@/hooks/useAuth'
import { ROUTE_PATHS } from '@/routes/paths'
import { resolveErrorVariant } from '@/utils/apiError'
import { formatDateTime } from '@/utils/datetime'

/** Absent renders as nothing here; the callers supply their own wording. */
const displayDateTimeOrNull = (value) => formatDateTime(value, { empty: null })

/**
 * Roles allowed to change the schedule.
 *
 * Mirrors the server's `DESTRUCTIVE_ROLES` exactly. This is presentation only —
 * hiding a control a user cannot use — and the route guard is what actually
 * enforces it. A UI check that were the only check would be no check at all.
 */
const ADMIN_ROLES = new Set(['owner', 'admin'])

/** Formats an ISO timestamp, tolerating null and invalid input. */
/** Bytes as something a person reads. */
function formatBytes(bytes) {
  if (!bytes) return null
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * The zones this browser knows, newest API first.
 *
 * `supportedValuesOf` has been in every current browser for some time, but a
 * settings screen that renders an empty dropdown on an older one is worse than
 * one that offers a sensible shortlist, so there is a fallback.
 */
function timeZoneOptions(current) {
  let zones = []

  try {
    zones = Intl.supportedValuesOf('timeZone')
  } catch {
    zones = [
      'Asia/Kolkata',
      'Asia/Dubai',
      'Asia/Singapore',
      'Europe/London',
      'Europe/Berlin',
      'America/New_York',
      'America/Los_Angeles',
      'Australia/Sydney',
      'UTC',
    ]
  }

  // A zone configured before the browser knew about it must still be selectable,
  // or opening this page would silently change it on the next save.
  return current && !zones.includes(current) ? [current, ...zones] : zones
}

const STATUS_PRESENTATION = {
  queued: { icon: CheckCircle2, tone: 'bg-emerald-50 text-emerald-600' },
  running: { icon: Loader2, tone: 'bg-blue-50 text-blue-600' },
  skipped: { icon: CircleSlash, tone: 'bg-slate-100 text-slate-500' },
  retrying: { icon: RotateCw, tone: 'bg-amber-50 text-amber-600' },
  failed: { icon: AlertTriangle, tone: 'bg-red-50 text-red-600' },
  idle: { icon: Clock, tone: 'bg-slate-100 text-slate-500' },
}

/** Reduces the server payload to just the fields this form owns. */
function toFormState(settings) {
  return {
    runTime: settings?.runTime ?? '09:00',
    timezone: settings?.timezone ?? 'Asia/Kolkata',
    sendMail: settings?.sendMail ?? true,
    maxRetries: settings?.retry?.maxRetries ?? 3,
    retryDelaySeconds: Math.round((settings?.retry?.delayMs ?? 300_000) / 1000),

    /** Reply sync (Phase H4). Staged the same way as everything above. */
    replyIntervalMinutes: settings?.replySync?.intervalMinutes ?? 5,
    replyDownloadAttachments: settings?.replySync?.downloadAttachments ?? true,
  }
}

/** How the reply sync's last run is presented. */
const REPLY_SYNC_PRESENTATION = {
  ok: { icon: CheckCircle2, tone: 'bg-emerald-50 text-emerald-600' },
  running: { icon: Loader2, tone: 'bg-blue-50 text-blue-600' },
  skipped: { icon: CircleSlash, tone: 'bg-slate-100 text-slate-500' },
  failed: { icon: AlertTriangle, tone: 'bg-red-50 text-red-600' },
  idle: { icon: Clock, tone: 'bg-slate-100 text-slate-500' },
}

/** One labelled field. */
function Field({ label, hint, htmlFor, children }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-800">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs leading-relaxed text-slate-500">{hint}</p>}
    </div>
  )
}

/** One row in the recent-attempts list. */
function RunRow({ run }) {
  const presentation = STATUS_PRESENTATION[run.status] ?? STATUS_PRESENTATION.idle
  const Icon = presentation.icon

  return (
    <li className="flex items-start gap-3 px-5 py-3">
      <span className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-md ${presentation.tone}`}>
        <Icon className="size-4" aria-hidden="true" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-sm font-medium text-slate-900">{run.statusLabel}</span>
          <span className="text-xs text-slate-500">
            {displayDateTimeOrNull(run.startedAt)}
            {run.manual && ' · run manually'}
            {run.attempt > 1 && ` · attempt ${run.attempt}`}
          </span>
        </div>

        <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{run.message}</p>

        {run.workbook && (
          <p className="mt-1 truncate text-[11px] text-slate-400">
            {run.workbook.filename}
            {run.workbook.sheet && ` · sheet "${run.workbook.sheet}"`}
            {formatBytes(run.workbook.size) && ` · ${formatBytes(run.workbook.size)}`}
          </p>
        )}
      </div>
    </li>
  )
}

export function SettingsPage() {
  const { user } = useAuth()
  const canManage = ADMIN_ROLES.has(user?.role)

  const fetcher = useCallback(({ signal }) => fetchScheduler({ signal }), [])
  const { data, isInitialLoading, isError, error, refresh } = useApiResource(fetcher)

  const [form, setForm] = useState(() => toFormState(null))
  const [isSaving, setIsSaving] = useState(false)
  const [isToggling, setIsToggling] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isTogglingSync, setIsTogglingSync] = useState(false)
  const [notice, setNotice] = useState(null)

  // Re-seeded whenever the server's view changes, so a save, a manual run or a
  // background refresh all leave the form describing what is actually stored.
  useEffect(() => {
    if (data) setForm(toFormState(data))
  }, [data])

  const zones = useMemo(() => timeZoneOptions(data?.timezone), [data?.timezone])

  const isDirty = useMemo(() => {
    if (!data) return false
    const saved = toFormState(data)

    return Object.keys(saved).some((key) => saved[key] !== form[key])
  }, [data, form])

  const set = (key) => (value) => setForm((previous) => ({ ...previous, [key]: value }))

  /** Applies a change and refreshes, so `nextRunAt` is the server's answer. */
  const save = useCallback(
    async (changes, successFallback) => {
      setNotice(null)

      try {
        const result = await updateScheduler(changes)
        await refresh({ isBackground: true })
        setNotice({ tone: 'success', message: result.message ?? successFallback })
      } catch (caught) {
        setNotice({
          tone: 'error',
          message: caught?.message ?? 'The settings could not be saved.',
        })
      }
    },
    [refresh],
  )

  const handleSave = async () => {
    setIsSaving(true)
    await save(
      {
        runTime: form.runTime,
        timezone: form.timezone,
        sendMail: form.sendMail,
        maxRetries: form.maxRetries,
        retryDelaySeconds: form.retryDelaySeconds,
        replySync: {
          intervalMinutes: form.replyIntervalMinutes,
          downloadAttachments: form.replyDownloadAttachments,
        },
      },
      'Saved.',
    )
    setIsSaving(false)
  }

  const handleToggleReplySync = async () => {
    setIsTogglingSync(true)
    await save({ replySync: { enabled: !data.replySync.enabled } }, 'Saved.')
    setIsTogglingSync(false)
  }

  /**
   * Reads the inbox now.
   *
   * The message reports what actually happened — "3 replies matched", "nothing
   * new", "no mailbox connected" — rather than a generic success. That is the
   * point of the button: it tells an operator what the automatic sync is doing.
   */
  const handleSyncNow = async () => {
    setIsSyncing(true)
    setNotice(null)

    try {
      const result = await syncRepliesNow()
      await refresh({ isBackground: true })
      setNotice({ tone: result.ok ? 'success' : 'info', message: result.message })
    } catch (caught) {
      setNotice({ tone: 'error', message: caught?.message ?? 'The replies could not be synced.' })
    } finally {
      setIsSyncing(false)
    }
  }

  const handleToggle = async () => {
    setIsToggling(true)
    await save({ enabled: !data.enabled }, 'Saved.')
    setIsToggling(false)
  }

  /**
   * Runs today's scheduler.
   *
   * The response is not always "queued" — "no workbook" and "already processed"
   * are equally normal answers, and the notice reports whichever it was rather
   * than claiming success. That honesty is the whole point of the button: it
   * tells an operator what the automatic run would have done.
   */
  const handleRunNow = async () => {
    setIsRunning(true)
    setNotice(null)

    try {
      const result = await runSchedulerNow()
      await refresh({ isBackground: true })
      setNotice({ tone: result.queued ? 'success' : 'info', message: result.message })
    } catch (caught) {
      setNotice({ tone: 'error', message: caught?.message ?? 'The scheduler could not be run.' })
    } finally {
      setIsRunning(false)
    }
  }

  if (isError && !data) {
    return (
      <ErrorScreen variant={resolveErrorVariant(error)} message={error?.message} onRetry={refresh} />
    )
  }

  if (isInitialLoading) {
    return (
      <div className="space-y-5" aria-busy="true">
        <SkeletonCard rows={4} />
        <SkeletonCard rows={3} />
      </div>
    )
  }

  const lastRun = data?.lastRun
  const lastPresentation = STATUS_PRESENTATION[lastRun?.status] ?? STATUS_PRESENTATION.idle
  const LastIcon = lastPresentation.icon

  /**
   * Whether this workspace owns the daily workbook run.
   *
   * One office, one workbook, one automation — so exactly one workspace runs
   * it, however many people sign in. Reply sync is unaffected: every user reads
   * their own mailbox.
   */
  const isPrimary = data?.isPrimary ?? false

  const replySync = data?.replySync
  const replyPresentation =
    REPLY_SYNC_PRESENTATION[replySync?.status] ?? REPLY_SYNC_PRESENTATION.idle
  const ReplyIcon = replyPresentation.icon

  return (
    <div className="space-y-5">
      {notice && (
        <div
          role="status"
          className={`rounded-lg border px-4 py-3 text-sm ${
            notice.tone === 'error'
              ? 'border-red-200 bg-red-50 text-red-800'
              : notice.tone === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-slate-200 bg-slate-50 text-slate-700'
          }`}
        >
          {notice.message}
        </div>
      )}

      {/* --- The switch, the status and Run now ----------------------------- */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-600/10">
              <CalendarClock className="size-[18px]" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-slate-900">The morning run</h2>
              <p className="text-xs leading-relaxed text-slate-500">
                Each morning the newest workbook in the inbox folder is imported through the same
                queue a manual upload uses. New enquiries are created and emailed once; anything
                already seen is left alone.
              </p>
              {!isPrimary && (
                <p className="mt-1.5 flex items-start gap-1.5 text-xs leading-relaxed text-amber-700">
                  <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
                  <span>
                    Another workspace runs the daily workbook. One office processes one workbook, so
                    the settings below do not apply here — customer replies still sync to your own
                    mailbox as normal.
                  </span>
                </p>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {data?.enabled ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                On
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                Off
              </span>
            )}

            {canManage && (
              <Button
                type="button"
                size="sm"
                variant={data?.enabled ? 'secondary' : 'primary'}
                onClick={handleToggle}
                isLoading={isToggling}
              >
                {data?.enabled ? 'Disable' : 'Enable'}
              </Button>
            )}
          </div>
        </header>

        <div className="grid gap-3 px-5 py-4 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-200 px-3 py-2.5">
            <span className="block text-xs text-slate-500">Last scheduled run</span>
            <span className="mt-0.5 block truncate text-sm font-medium text-slate-900">
              {displayDateTimeOrNull(lastRun?.at) ?? 'Never'}
            </span>
          </div>

          <div className="rounded-lg border border-slate-200 px-3 py-2.5">
            <span className="block text-xs text-slate-500">Next scheduled run</span>
            <span className="mt-0.5 block truncate text-sm font-medium text-slate-900">
              {displayDateTimeOrNull(data?.nextRunAt) ?? '—'}
            </span>
          </div>

          <div className="flex items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2.5 sm:col-span-2">
            <span className={`grid size-7 shrink-0 place-items-center rounded-md ${lastPresentation.tone}`}>
              <LastIcon className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <span className="block text-sm font-medium text-slate-900">
                {lastRun?.statusLabel ?? 'Not run yet'}
              </span>
              <span className="block text-xs leading-relaxed text-slate-500">
                {lastRun?.message ?? 'The scheduler has not run for this workspace yet.'}
              </span>
              {lastRun?.nextAttemptAt && (
                <span className="mt-0.5 block text-xs text-amber-700">
                  Next attempt at {displayDateTimeOrNull(lastRun.nextAttemptAt)}.
                </span>
              )}
            </div>
          </div>
        </div>

        {canManage && (
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3">
            <Button
              type="button"
              size="sm"
              onClick={handleRunNow}
              isLoading={isRunning}
              // Only the scheduling workspace may run the workbook. The server
              // enforces it; disabling here explains it rather than 403-ing.
              disabled={!isPrimary}
            >
              <Play className="size-3.5" aria-hidden="true" />
              Run now
            </Button>
            <p className="text-xs text-slate-500">
              {isPrimary
                ? 'Does exactly what the automatic run does, including its duplicate checks — pressing it twice cannot email anybody twice.'
                : 'Only the scheduling workspace can run the daily workbook.'}
            </p>
          </div>
        )}
      </section>

      {/* --- Configuration --------------------------------------------------- */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
        <header className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-900">Schedule</h2>
          <p className="text-xs text-slate-500">When the run starts, and what it does if it fails.</p>
        </header>

        <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
          <Field
            label="Run time"
            htmlFor="scheduler-run-time"
            hint="24-hour, in the timezone below."
          >
            <input
              id="scheduler-run-time"
              type="time"
              value={form.runTime}
              disabled={!canManage}
              onChange={(event) => set('runTime')(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 disabled:bg-slate-50 disabled:text-slate-500"
            />
          </Field>

          <Field
            label="Timezone"
            htmlFor="scheduler-timezone"
            hint="The run happens at this local time whatever the server's own clock is set to."
          >
            <select
              id="scheduler-timezone"
              value={form.timezone}
              disabled={!canManage}
              onChange={(event) => set('timezone')(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 disabled:bg-slate-50 disabled:text-slate-500"
            >
              {zones.map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Retry attempts"
            htmlFor="scheduler-max-retries"
            hint="Extra attempts if the run cannot be queued. A morning with no workbook is not a failure and is never retried."
          >
            <input
              id="scheduler-max-retries"
              type="number"
              min={0}
              max={10}
              value={form.maxRetries}
              disabled={!canManage}
              onChange={(event) => set('maxRetries')(Number(event.target.value))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 disabled:bg-slate-50 disabled:text-slate-500"
            />
          </Field>

          <Field
            label="Retry delay (seconds)"
            htmlFor="scheduler-retry-delay"
            hint="How long to wait before trying again."
          >
            <input
              id="scheduler-retry-delay"
              type="number"
              min={10}
              max={21_600}
              step={10}
              value={form.retryDelaySeconds}
              disabled={!canManage}
              onChange={(event) => set('retryDelaySeconds')(Number(event.target.value))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 disabled:bg-slate-50 disabled:text-slate-500"
            />
          </Field>

          <div className="sm:col-span-2">
            <label className="flex items-start gap-2.5 rounded-lg border border-slate-200 px-3 py-2.5">
              <input
                type="checkbox"
                checked={form.sendMail}
                disabled={!canManage}
                onChange={(event) => set('sendMail')(event.target.checked)}
                className="mt-0.5 size-4 rounded border-slate-300"
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-slate-800">
                  Email new enquiries automatically
                </span>
                <span className="block text-xs leading-relaxed text-slate-500">
                  Uncheck to import without sending. Useful for a first morning: the run creates the
                  enquiries so you can check them, and writes to nobody. The wording itself is set
                  on the{' '}
                  <Link to={ROUTE_PATHS.TEMPLATES} className="font-medium underline">
                    Email templates
                  </Link>{' '}
                  screen.
                </span>
              </span>
            </label>
          </div>
        </div>

        {canManage && (
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3">
            <Button type="button" size="sm" onClick={handleSave} disabled={!isDirty} isLoading={isSaving}>
              <Save className="size-3.5" aria-hidden="true" />
              Save changes
            </Button>
            {isDirty && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setForm(toFormState(data))}
              >
                <Undo2 className="size-3.5" aria-hidden="true" />
                Discard
              </Button>
            )}
            {!isDirty && <span className="text-xs text-slate-500">No unsaved changes.</span>}
          </div>
        )}

        {!canManage && (
          <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-3">
            <p className="flex items-start gap-1.5 text-xs text-slate-500">
              <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
              <span>Only an owner or administrator can change the schedule or run it manually.</span>
            </p>
          </div>
        )}
      </section>

      {/* --- Reply sync ------------------------------------------------------
          The other half of the automation: the workbook goes out, the replies
          come back. Kept as its own card because the two run on completely
          different cadences and either can be off while the other is on. */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-600/10">
              <Inbox className="size-[18px]" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-slate-900">Customer replies</h2>
              <p className="text-xs leading-relaxed text-slate-500">
                Reads the connected Outlook mailbox and files each reply against the enquiry it
                belongs to — updating the lead, the timeline and the notification bell. Nobody has
                to watch the inbox.
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {replySync?.enabled ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                On
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                Off
              </span>
            )}

            {canManage && (
              <Button
                type="button"
                size="sm"
                variant={replySync?.enabled ? 'secondary' : 'primary'}
                onClick={handleToggleReplySync}
                isLoading={isTogglingSync}
              >
                {replySync?.enabled ? 'Disable' : 'Enable'}
              </Button>
            )}
          </div>
        </header>

        <div className="grid gap-3 px-5 py-4 sm:grid-cols-2">
          <Field
            label="Check every (minutes)"
            htmlFor="reply-sync-interval"
            hint="Five is the default. The read is incremental, so a longer gap costs latency and nothing else."
          >
            <input
              id="reply-sync-interval"
              type="number"
              min={1}
              max={1440}
              value={form.replyIntervalMinutes}
              disabled={!canManage}
              onChange={(event) => set('replyIntervalMinutes')(Number(event.target.value))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 disabled:bg-slate-50 disabled:text-slate-500"
            />
          </Field>

          <Field label="Last checked" htmlFor="reply-sync-last">
            <p
              id="reply-sync-last"
              className="rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2 text-sm text-slate-700"
            >
              {displayDateTimeOrNull(replySync?.lastRunAt) ?? 'Never'}
              {replySync?.enabled && replySync?.nextRunAt && (
                <span className="block text-xs text-slate-400">
                  next {displayDateTimeOrNull(replySync.nextRunAt)}
                </span>
              )}
            </p>
          </Field>

          <div className="sm:col-span-2">
            <label className="flex items-start gap-2.5 rounded-lg border border-slate-200 px-3 py-2.5">
              <input
                type="checkbox"
                checked={form.replyDownloadAttachments}
                disabled={!canManage}
                onChange={(event) => set('replyDownloadAttachments')(event.target.checked)}
                className="mt-0.5 size-4 rounded border-slate-300"
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-slate-800">
                  Download attachments customers send
                </span>
                <span className="block text-xs leading-relaxed text-slate-500">
                  The file list is always recorded either way; this controls whether the bytes are
                  fetched and stored. Blocked file types are refused whatever this is set to.
                </span>
              </span>
            </label>
          </div>

          <div className="flex items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2.5 sm:col-span-2">
            <span
              className={`grid size-7 shrink-0 place-items-center rounded-md ${replyPresentation.tone}`}
            >
              <ReplyIcon className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <span className="block text-sm font-medium text-slate-900">
                {replySync?.statusLabel ?? 'Not run yet'}
              </span>
              <span className="block text-xs leading-relaxed text-slate-500">
                {replySync?.message ?? 'The mailbox has not been read for this workspace yet.'}
              </span>
              {(replySync?.lastResult?.matched > 0 || replySync?.lastResult?.unmatched > 0) && (
                <span className="mt-0.5 block text-[11px] text-slate-400">
                  Last run: {replySync.lastResult.created} new ·{' '}
                  {replySync.lastResult.matched} matched · {replySync.lastResult.unmatched} unmatched
                  · {replySync.lastResult.duplicates} already seen
                </span>
              )}
              {replySync?.consecutiveFailures > 0 && (
                <span className="mt-0.5 block text-[11px] text-amber-700">
                  {replySync.consecutiveFailures} consecutive failure(s) — checks are being spaced
                  out until one succeeds.
                </span>
              )}
            </div>
          </div>
        </div>

        {canManage && (
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3">
            <Button type="button" size="sm" onClick={handleSyncNow} isLoading={isSyncing}>
              <RefreshCw className="size-3.5" aria-hidden="true" />
              Sync replies now
            </Button>
            <p className="text-xs text-slate-500">
              Uses the same worker as the automatic check. A reply already filed is never filed
              twice, so pressing this is always safe.
            </p>
          </div>
        )}
      </section>

      {/* --- Where the workbook comes from ---------------------------------- */}
      <section className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-card">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500">
            <FolderInput className="size-[18px]" aria-hidden="true" />
          </span>
          <div className="min-w-0 text-xs leading-relaxed text-slate-600">
            <p className="text-sm font-medium text-slate-900">Where the workbook comes from</p>
            <p className="mt-1">
              Drop the day&apos;s export into the server&apos;s workbook inbox folder — the newest{' '}
              <code className="rounded bg-slate-100 px-1">.xlsx</code> in it is the one that runs. If
              several are there, the most recently modified wins. The folder is set by the server
              administrator (<code className="rounded bg-slate-100 px-1">WORKBOOK_INBOX_DIR</code>)
              rather than here, so nobody can point the automation at an arbitrary path from a
              browser.
            </p>
            <p className="mt-1.5">
              Files are left in place after a run. The same file is never imported twice, so leaving
              yesterday&apos;s workbook there is harmless. You can still upload a workbook by hand at
              any time on the{' '}
              <Link to={ROUTE_PATHS.LEAD_IMPORT} className="font-medium underline">
                Import workbook
              </Link>{' '}
              screen — that path is unchanged.
            </p>
          </div>
        </div>
      </section>

      {/* --- History --------------------------------------------------------- */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
        <header className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-900">Recent attempts</h2>
          <p className="text-xs text-slate-500">
            Every check, including the mornings that found nothing to do.
          </p>
        </header>

        {data?.recentRuns?.length ? (
          <ul className="divide-y divide-slate-100">
            {data.recentRuns.map((run) => (
              <RunRow key={run.id} run={run} />
            ))}
          </ul>
        ) : (
          <p className="px-5 py-8 text-center text-sm text-slate-500">
            The scheduler has not run yet.
          </p>
        )}
      </section>
    </div>
  )
}

export default SettingsPage
