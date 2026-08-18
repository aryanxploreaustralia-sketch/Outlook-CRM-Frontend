/**
 * One campaign: live progress, recipients, timeline and controls.
 *
 * Polls only while the campaign can change — `useCampaign` decides that, so a
 * completed campaign left open overnight costs nothing.
 */

import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  Activity,
  ArrowLeft,
  BarChart3,
  Copy,
  Pause,
  Play,
  RefreshCw,
  Send,
  Square,
  Users,
} from 'lucide-react'

import { CampaignProgress } from '@/components/campaigns/CampaignProgress'
import { CampaignStatusBadge } from '@/components/campaigns/CampaignStatusBadge'
import { ErrorScreen } from '@/components/common/ErrorScreen'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { AVAILABLE_CONTROLS, CONTROL_LABELS } from '@/constants/campaign.constants'
import { useCampaign } from '@/hooks/useCampaigns'
import { ROUTE_PATHS } from '@/routes/paths'
import { resolveErrorVariant } from '@/utils/apiError'

const CONTROL_ICONS = { pause: Pause, resume: Play, cancel: Square, archive: Copy }

const TABS = [
  { id: 'recipients', label: 'Recipients', icon: Users },
  { id: 'timeline', label: 'Timeline', icon: Activity },
]

export function CampaignDetailPage() {
  const { id } = useParams()
  const [tab, setTab] = useState('recipients')

  const {
    campaign,
    recipients,
    events,
    isLive,
    isInitialLoading,
    isError,
    error,
    refresh,
    action,
    isBusy,
    actionError,
    lastSend,
    control,
    send,
    clone,
  } = useCampaign(id)

  if (isInitialLoading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner label="Loading campaign" />
      </div>
    )
  }

  if (isError || !campaign) {
    return <ErrorScreen variant={resolveErrorVariant(error)} error={error} onRetry={() => refresh()} />
  }

  const controls = AVAILABLE_CONTROLS[campaign.status] ?? []
  const canSend = ['running', 'scheduled'].includes(campaign.status) && campaign.remaining > 0

  return (
    <div className="space-y-6">
      {/* --- Header ------------------------------------------------------- */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link to={ROUTE_PATHS.CAMPAIGNS} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700">
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            All campaigns
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="truncate text-lg font-semibold text-slate-900">{campaign.name}</h1>
            <CampaignStatusBadge status={campaign.status} />
            {isLive && (
              <span className="inline-flex items-center gap-1.5 text-xs text-blue-600">
                <span className="inline-block size-1.5 animate-pulse rounded-full bg-blue-500" aria-hidden="true" />
                Live
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-sm text-slate-500">{campaign.subject}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canSend && (
            <Button onClick={() => send(1)} isLoading={action === 'send'} disabled={isBusy}>
              <Send className="size-4" aria-hidden="true" />
              Send a batch
            </Button>
          )}
          {controls.map((verb) => {
            const Icon = CONTROL_ICONS[verb] ?? Play
            return (
              <Button
                key={verb}
                variant="secondary"
                onClick={() => control(verb)}
                isLoading={action === `control:${verb}`}
                disabled={isBusy}
              >
                <Icon className="size-4" aria-hidden="true" />
                {CONTROL_LABELS[verb]}
              </Button>
            )
          })}
          <Button variant="secondary" onClick={() => clone()} isLoading={action === 'clone'} disabled={isBusy}>
            <Copy className="size-4" aria-hidden="true" />
            Duplicate
          </Button>
          <Button as={Link} to={ROUTE_PATHS.CAMPAIGN_ANALYTICS} variant="ghost">
            <BarChart3 className="size-4" aria-hidden="true" />
            Analytics
          </Button>
          <Button variant="ghost" onClick={() => refresh()}>
            <RefreshCw className="size-4" aria-hidden="true" />
            <span className="sr-only">Refresh</span>
          </Button>
        </div>
      </div>

      {actionError && (
        <p role="alert" className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-inset ring-rose-200">
          {actionError?.response?.data?.message ?? actionError?.message ?? 'That action could not be completed.'}
        </p>
      )}

      {/* A throttled batch and a finished one both send zero messages. Saying
          which one happened is the difference between "wait" and "act". */}
      {lastSend?.throttled && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-inset ring-amber-200">
          Throttled by the <span className="font-medium">{lastSend.limitedBy}</span> limit — sending
          resumes in about {Math.ceil((lastSend.retryAfterMs ?? 0) / 1000)}s. This limit counts every
          campaign, because it protects the mailbox rather than any one send.
        </p>
      )}

      {/* --- Live counters ------------------------------------------------ */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <CampaignProgress stats={campaign.stats} percentComplete={campaign.percentComplete} />

        <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
          {[
            ['Recipients', campaign.stats.recipients],
            ['Queued', campaign.stats.queued],
            ['Sent', campaign.stats.sent],
            ['Delivered', campaign.stats.delivered],
            ['Replied', campaign.stats.replied],
            ['Bounced', campaign.stats.bounced],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
              <dd className="mt-0.5 text-xl font-semibold tabular-nums text-slate-900">{value.toLocaleString()}</dd>
            </div>
          ))}
        </dl>

        {campaign.estimatedCompletion && campaign.remaining > 0 && (
          <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
            {campaign.remaining.toLocaleString()} remaining. At {campaign.throttle.perMinute}/minute the
            send finishes around {new Date(campaign.estimatedCompletion).toLocaleString()} — derived from
            the configured rate, not observed speed, so it never promises sooner than is possible.
          </p>
        )}
      </section>

      {/* --- Tabs ---------------------------------------------------------- */}
      <div>
        <div className="flex gap-1 border-b border-slate-200" role="tablist">
          {TABS.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                onClick={() => setTab(item.id)}
                className={[
                  'inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors',
                  tab === item.id
                    ? 'border-brand-600 text-brand-700'
                    : 'border-transparent text-slate-500 hover:text-slate-700',
                ].join(' ')}
              >
                <Icon className="size-4" aria-hidden="true" />
                {item.label}
              </button>
            )
          })}
        </div>

        {tab === 'recipients' && (
          <div className="scroll-x mt-4 overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-4 py-2 font-medium">Recipient</th>
                  <th scope="col" className="px-4 py-2 font-medium">Status</th>
                  <th scope="col" className="px-4 py-2 font-medium">Attempts</th>
                  <th scope="col" className="px-4 py-2 font-medium">Sent</th>
                  <th scope="col" className="px-4 py-2 font-medium">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {recipients.map((recipient) => (
                  <tr key={recipient.id}>
                    <td className="max-w-56 truncate px-4 py-2 text-slate-900">{recipient.email}</td>
                    <td className="px-4 py-2">
                      <CampaignStatusBadge status={recipient.status} kind="recipient" />
                    </td>
                    <td className="px-4 py-2 tabular-nums text-slate-600">{recipient.attempts}</td>
                    <td className="px-4 py-2 text-slate-500">
                      {recipient.sentAt ? new Date(recipient.sentAt).toLocaleString() : '—'}
                    </td>
                    <td className="max-w-64 truncate px-4 py-2 text-xs text-slate-500">
                      {recipient.failure?.message ?? recipient.skipReason ?? '—'}
                    </td>
                  </tr>
                ))}
                {recipients.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                      No recipients yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'timeline' && (
          <ol className="mt-4 space-y-2">
            {events.map((event) => (
              <li key={event.id} className="flex items-baseline gap-3 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm">
                <span className="font-mono text-xs text-slate-400">
                  {new Date(event.occurredAt).toLocaleTimeString()}
                </span>
                <span className="font-medium text-slate-700">{event.type.replace(/_/g, ' ')}</span>
                <span className="truncate text-slate-500">{event.email ?? ''}</span>
                {event.detail && (
                  <span className="ml-auto shrink-0 font-mono text-xs text-slate-400">
                    {Object.entries(event.detail)
                      .map(([key, value]) => `${key}=${value}`)
                      .join(' ')}
                  </span>
                )}
              </li>
            ))}
            {events.length === 0 && (
              <li className="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">
                Nothing has happened yet.
              </li>
            )}
          </ol>
        )}
      </div>
    </div>
  )
}

export default CampaignDetailPage
