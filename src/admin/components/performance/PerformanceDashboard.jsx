/**
 * One person's performance dashboard (Phase 17.3).
 *
 * ## One component, two audiences
 *
 * An administrator opens it from User 360; an employee opens their own from the
 * account page. Both render this, because both must see the same eight sections
 * built from the same payload — a manager and the person they manage disagreeing
 * about a number is the failure mode this whole phase exists to prevent.
 *
 * The only difference is `audience`, which changes wording ("you" rather than
 * the person's name) and hides the rank line for the self view. It changes no
 * figure.
 *
 * ## Nothing is computed here
 *
 * Every percentage, rate, level and rank arrives from the server. This file
 * formats and arranges; it never derives. A rate computed in the browser would
 * be a second definition of the same statistic, and the two would part company
 * the first time a denominator changed.
 *
 * ## Absence is stated, not drawn as zero
 *
 * `null` means "not measured" and renders as an em dash with a reason from the
 * response's `notMeasured` block. Three figures the brief asks for are in that
 * position — delivered mail, opens, and average session duration — and printing
 * 0 for any of them would be a number somebody acts on.
 */

import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Inbox,
  Info,
  Megaphone,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react'

import { AdminAreaChart, AdminBarChart } from '@/admin/components/AdminChart'
import { AdminBadge } from '@/admin/components/AdminBadge'
import { AdminCard } from '@/admin/components/AdminCard'
import { AdminEmptyState } from '@/admin/components/AdminEmptyState'
import { AdminScoreMeter } from '@/admin/components/AdminScoreMeter'
import { AdminStatCard } from '@/admin/components/AdminStatCard'
import {
  EMPTY,
  formatCount,
  formatDateTime,
  formatMinutes,
  formatPercent,
  formatRelative,
} from '@/admin/utils/format'
import { formatTime } from '@/utils/datetime'

/** The tone each performance band carries. Sent by the server with the level. */
const LEVEL_TONE = {
  excellent: 'success',
  good: 'brand',
  average: 'warning',
  needs_improvement: 'danger',
}

/**
 * A figure that may legitimately have no value.
 *
 * The `title` carries the reason, so hovering an em dash answers "why is this
 * blank" without a paragraph of explanation on the card.
 */
function Figure({ value, format = formatCount, reason }) {
  if (value === null || value === undefined) {
    return (
      <span className="text-slate-400" title={reason ?? 'Not measured'}>
        {EMPTY}
      </span>
    )
  }

  return <>{format(value)}</>
}

/** A labelled row inside a metric card. */
function Row({ label, value, format, reason, hint }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-slate-100 py-2 last:border-b-0">
      <dt className="min-w-0 text-xs font-medium text-slate-500">
        {label}
        {hint && <span className="mt-0.5 block text-[11px] font-normal text-slate-400">{hint}</span>}
      </dt>
      <dd
        className="shrink-0 text-sm font-medium text-slate-800"
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        <Figure value={value} format={format} reason={reason} />
      </dd>
    </div>
  )
}

/** Section 1 — the summary. */
function Summary({ data, audience }) {
  const { summary } = data
  const isSelf = audience === 'self'

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard
          label="Performance score"
          value={summary.score}
          unit="/ 100"
          icon={TrendingUp}
          hint={
            summary.teamAverageScore === null
              ? undefined
              : `Team average ${summary.teamAverageScore}`
          }
        />
        <AdminStatCard
          label="Efficiency"
          value={summary.efficiency === null ? EMPTY : summary.efficiency}
          unit={summary.efficiency === null ? undefined : '%'}
          icon={Target}
          hint={
            summary.efficiency === null
              ? 'No completed outcome to measure yet'
              : `Mean of ${summary.efficiencyBasis} outcome rate${summary.efficiencyBasis === 1 ? '' : 's'}`
          }
        />
        <AdminStatCard
          label={isSelf ? 'Your rank' : 'Rank'}
          value={summary.rank === null ? EMPTY : `${summary.rank} of ${summary.rankOf}`}
          icon={Users}
          hint="By score, across the whole organisation"
        />
        <AdminStatCard
          label="Profile completion"
          value={summary.profileCompletion}
          unit="%"
          icon={CheckCircle2}
          hint={
            summary.documents === 0
              ? 'No documents uploaded'
              : `${summary.documentsVerified} of ${summary.documents} documents verified`
          }
        />
      </div>

      <AdminCard
        title="How the score was built"
        description="Every factor, the value that went in, and the points it contributed."
        action={
          summary.level && (
            <AdminBadge tone={LEVEL_TONE[summary.level.key] ?? 'neutral'} size="md" dot>
              {summary.level.label}
            </AdminBadge>
          )
        }
      >
        <AdminScoreMeter score={summary.score} components={data.components} />

        <p className="mt-4 flex items-start gap-2 rounded-(--radius-control) bg-slate-50 px-3 py-2 text-xs text-slate-500">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          {data.scoring?.caveat}
        </p>
      </AdminCard>
    </div>
  )
}

/** Sections 2, 3 and 4 — communication, campaigns, enquiries. */
function MetricSections({ data }) {
  const { communication, campaigns, leads, notMeasured } = data

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <AdminCard title="Communication" description="Mail this person sent, and what came back.">
        <dl>
          <Row label="Emails sent" value={communication.emailsSent} />
          <Row
            label="Delivered"
            value={communication.emailsDelivered}
            reason={notMeasured?.emailsDelivered}
            hint="Not reported by Microsoft"
          />
          <Row label="Failed" value={communication.emailsFailed} />
          <Row label="Still queued" value={communication.emailsPending} />
          <Row label="Replies received" value={communication.replies} />
          <Row
            label="Replies per 100 sends"
            value={communication.replyRate}
            format={formatPercent}
          />
          <Row
            label="Median response"
            value={communication.responseMinutes}
            format={formatMinutes}
            hint={
              communication.responsesMeasured > 0
                ? `Over ${communication.responsesMeasured} measured repl${communication.responsesMeasured === 1 ? 'y' : 'ies'}`
                : 'No reply pairs in this period'
            }
          />
          <Row label="Mailboxes connected" value={communication.mailboxes} />
        </dl>
      </AdminCard>

      <AdminCard title="Campaigns" description="Planned outreach, and how it landed.">
        <dl>
          <Row label="Created" value={campaigns.created} />
          <Row label="Running" value={campaigns.running} />
          <Row label="Scheduled" value={campaigns.scheduled} />
          <Row label="Completed" value={campaigns.completed} />
          <Row label="Recipients" value={campaigns.recipients} />
          <Row label="Sent" value={campaigns.sent} />
          <Row label="Failed or bounced" value={campaigns.failed} />
          <Row
            label="Success rate"
            value={campaigns.successRate}
            format={formatPercent}
            hint="Of sends attempted, not of recipients"
          />
          <Row label="Failure rate" value={campaigns.failureRate} format={formatPercent} />
        </dl>
      </AdminCard>

      <AdminCard title="Enquiries" description="Created in this period, by their current stage.">
        <dl>
          <Row label="Created" value={leads.created} />
          <Row label="New" value={leads.new} />
          <Row label="Contacted" value={leads.contacted} />
          <Row label="Qualified" value={leads.qualified} />
          <Row label="Converted" value={leads.converted} />
          <Row label="Closed" value={leads.closed} />
          <Row
            label="Still open"
            value={leads.pending}
            hint="New, contacted and qualified together"
          />
          <Row label="Conversion rate" value={leads.conversionRate} format={formatPercent} />
        </dl>
      </AdminCard>
    </div>
  )
}

/** Section 5 — activity and attendance. */
function ActivitySection({ data }) {
  const { activity, notMeasured } = data

  return (
    <AdminCard
      title="Activity"
      description={activity.basis?.note}
      action={
        <AdminBadge tone="neutral">
          <Activity className="size-3" aria-hidden="true" />
          Derived
        </AdminBadge>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <dl>
          <Row label="Days signed in" value={activity.loginDays} />
          <Row label="Sign-ins" value={activity.logins} />
          <Row label="Days with recorded activity" value={activity.activeDays} />
        </dl>

        <dl>
          <Row
            label="Recorded activity span"
            value={activity.workingMinutes}
            format={formatMinutes}
            hint="First to last action each day, summed"
          />
          <Row label="Recorded actions" value={activity.recordedActions} />
          <Row
            label="Average session"
            value={activity.averageSessionMinutes}
            reason={notMeasured?.averageSessionDuration}
            hint="Not retained"
          />
        </dl>

        <dl>
          <Row label="Live sessions now" value={activity.liveSessions} />
          <Row
            label="Last sign-in"
            value={activity.lastLoginAt}
            format={formatDateTime}
            reason="Never signed in"
          />
          <Row
            label="Last activity"
            value={activity.lastActivityAt}
            format={formatRelative}
            reason="No activity recorded"
          />
        </dl>
      </div>
    </AdminCard>
  )
}

/** Sections 6 and 7 — the two trends. */
function TrendSections({ data }) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <AdminCard title="Last 7 days" description="Emails sent each day.">
        <AdminBarChart data={data.weekly.emails} height={200} ariaLabel="Emails sent per day over the last seven days" />
      </AdminCard>

      <AdminCard title="Last 30 days" description="Emails sent each day.">
        <AdminAreaChart data={data.monthly.emails} height={200} ariaLabel="Emails sent per day over the last thirty days" />
      </AdminCard>

      <AdminCard title="Replies — last 30 days">
        <AdminAreaChart
          data={data.monthly.replies}
          height={180}
          ariaLabel="Replies received per day over the last thirty days"
        />
      </AdminCard>

      <AdminCard title="Enquiries — last 30 days">
        <AdminBarChart
          data={data.monthly.leads}
          height={180}
          ariaLabel="Enquiries created per day over the last thirty days"
        />
      </AdminCard>
    </div>
  )
}

/** Section 8 — the timeline, straight from the audit log. */
function TimelineSection({ data }) {
  return (
    <AdminCard
      title="Recent activity"
      description="From the audit log, newest first. Business events the CRM records are elsewhere."
    >
      {data.timeline.length === 0 ? (
        <AdminEmptyState
          title="Nothing recorded in this period"
          description="The audit log holds privileged and business actions. A quiet period here does not mean a quiet period of work."
          compact
        />
      ) : (
        <ol className="relative space-y-0">
          {data.timeline.map((entry, index) => (
            <li key={entry.id} className="relative flex gap-3 pb-4 last:pb-0">
              {/* The rail, drawn per item so the last one does not trail off. */}
              {index < data.timeline.length - 1 && (
                <span
                  className="absolute left-[7px] top-5 h-full w-px bg-slate-200"
                  aria-hidden="true"
                />
              )}

              <span
                className={`mt-1.5 size-[15px] shrink-0 rounded-full border-2 border-white ring-1 ${
                  entry.severity === 'critical'
                    ? 'bg-red-400 ring-red-200'
                    : entry.severity === 'warning'
                      ? 'bg-amber-400 ring-amber-200'
                      : 'bg-slate-300 ring-slate-200'
                }`}
                aria-hidden="true"
              />

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <time
                    dateTime={entry.at}
                    className="text-xs font-medium tabular-nums text-slate-500"
                  >
                    {formatTime(entry.at)}
                  </time>
                  <span className="text-sm font-medium text-slate-800">{entry.label}</span>
                  <span className="text-xs text-slate-400">{formatRelative(entry.at)}</span>
                </div>
                <p className="mt-0.5 truncate text-sm text-slate-500">{entry.summary}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </AdminCard>
  )
}

/**
 * @param {{
 *   data: object,
 *   isLoading?: boolean,
 *   audience?: 'admin' | 'self',
 * }} props
 */
export function PerformanceDashboard({ data, isLoading = false, audience = 'admin' }) {
  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((n) => (
            <div key={n} className="skeleton h-28" />
          ))}
        </div>
        <div className="skeleton h-48" />
        <div className="grid gap-4 lg:grid-cols-3">
          {[0, 1, 2].map((n) => (
            <div key={n} className="skeleton h-64" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Summary data={data} audience={audience} />
      <MetricSections data={data} />
      <ActivitySection data={data} />
      <TrendSections data={data} />
      <TimelineSection data={data} />
    </div>
  )
}

/**
 * The five badges, for the leaderboard header.
 *
 * A badge that nobody qualified for is drawn as "not awarded" rather than
 * omitted. An absent card reads as a broken widget; a card saying nobody
 * cleared the bar says something true about the period.
 */
export function PerformanceBadges({ badges, qualifications = {}, isLoading = false }) {
  const CARDS = [
    { key: 'topPerformer', label: 'Top performer', icon: TrendingUp, detail: (b) => `${b.score} points` },
    {
      key: 'mostImproved',
      label: 'Most improved',
      icon: Activity,
      detail: (b) => `+${b.delta} on the previous period`,
    },
    {
      key: 'bestReplyRate',
      label: 'Best reply rate',
      icon: Inbox,
      detail: (b) => `${formatPercent(b.replyRate)} per 100 sends`,
    },
    {
      key: 'mostActive',
      label: 'Most active',
      icon: Megaphone,
      detail: (b) => `${formatCount(b.recordedActions)} recorded actions`,
    },
    {
      key: 'fastestResponder',
      label: 'Fastest responder',
      icon: Clock,
      detail: (b) => `${formatMinutes(b.responseMinutes)} median`,
    },
  ]

  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {CARDS.map((card) => (
          <div key={card.key} className="skeleton h-24" />
        ))}
      </div>
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {CARDS.map((card) => {
        const holder = badges?.[card.key] ?? null
        const Icon = card.icon

        return (
          <div key={card.key} className="surface-card p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <Icon className="size-3.5 text-brand-600" aria-hidden="true" />
              {card.label}
            </div>

            {holder ? (
              <>
                <p className="mt-2 truncate text-sm font-semibold text-slate-900">
                  {holder.displayName ?? holder.email}
                </p>
                <p className="mt-0.5 truncate text-xs text-slate-500">{card.detail(holder)}</p>
              </>
            ) : (
              <>
                <p className="mt-2 text-sm text-slate-400">Not awarded</p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {qualifications[card.key] ?? 'Nobody qualified in this period.'}
                </p>
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}

/**
 * The console's performance widgets.
 *
 * "Needs attention" is the one that earns its place: the others name a winner,
 * and this one names the next five minutes of somebody's work.
 */
export function PerformanceWidgets({ widgets, isLoading = false }) {
  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((n) => (
          <div key={n} className="skeleton h-24" />
        ))}
      </div>
    )
  }

  if (!widgets) return null

  const CARDS = [
    { key: 'topPerformer', label: 'Top performer', tone: 'success', detail: (w) => `${w.score} points` },
    { key: 'lowestPerformer', label: 'Lowest score', tone: 'warning', detail: (w) => `${w.score} points` },
    { key: 'mostActive', label: 'Most active', tone: 'brand', detail: (w) => `${formatCount(w.recordedActions)} actions` },
    { key: 'highestReplyRate', label: 'Highest reply rate', tone: 'brand', detail: (w) => formatPercent(w.replyRate) },
    { key: 'mostEmails', label: 'Most emails', tone: 'brand', detail: (w) => `${formatCount(w.emailsSent)} sent` },
  ]

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {CARDS.map((card) => {
        const holder = widgets[card.key]

        return (
          <div key={card.key} className="surface-card p-4">
            <p className="text-xs font-medium text-slate-500">{card.label}</p>
            {holder ? (
              <>
                <p className="mt-1.5 truncate text-sm font-semibold text-slate-900">
                  {holder.displayName ?? holder.email}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">{card.detail(holder)}</p>
              </>
            ) : (
              <p className="mt-1.5 text-sm text-slate-400">Nobody qualified</p>
            )}
          </div>
        )
      })}

      <div className="surface-card p-4 sm:col-span-2 xl:col-span-1">
        <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
          <AlertTriangle className="size-3.5 text-amber-500" aria-hidden="true" />
          Needs attention
        </p>

        {widgets.needsAttention?.length ? (
          <ul className="mt-2 space-y-1.5">
            {widgets.needsAttention.slice(0, 4).map((person) => (
              <li key={person.id} className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-800">
                  {person.displayName ?? person.email}
                </p>
                <p className="truncate text-xs text-slate-500">{person.reasons.join(' · ')}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 flex items-center gap-1.5 text-sm text-emerald-700">
            <CheckCircle2 className="size-4" aria-hidden="true" />
            Nothing outstanding.
          </p>
        )}
      </div>
    </div>
  )
}

export default PerformanceDashboard
