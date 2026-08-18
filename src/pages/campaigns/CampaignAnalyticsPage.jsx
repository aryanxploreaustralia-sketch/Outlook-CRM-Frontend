/**
 * Cross-campaign analytics.
 *
 * Rates are shown over the denominator that makes them true — delivery over
 * what was attempted, replies over what was delivered — and an em dash rather
 * than 0% where nothing has been measured yet. A reply rate of "0%" on a
 * campaign that has not sent anything is a lie the page refuses to tell.
 */

import { Link } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'

import { CampaignStatusBadge } from '@/components/campaigns/CampaignStatusBadge'
import { RateCard } from '@/components/campaigns/RateCard'
import { ErrorScreen } from '@/components/common/ErrorScreen'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { useOverallAnalytics } from '@/hooks/useCampaigns'
import { ROUTE_PATHS } from '@/routes/paths'
import { resolveErrorVariant } from '@/utils/apiError'

export function CampaignAnalyticsPage() {
  const { report, byStatus, isInitialLoading, isError, error, refresh } = useOverallAnalytics()

  if (isInitialLoading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner label="Loading analytics" />
      </div>
    )
  }

  if (isError || !report) {
    return <ErrorScreen variant={resolveErrorVariant(error)} error={error} onRetry={() => refresh()} />
  }

  const { totals, rates, topTemplates = [], recent = [] } = report

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          Across {totals.campaigns.toLocaleString()} campaigns and{' '}
          {totals.recipients.toLocaleString()} recipients.
        </p>
        <Button variant="secondary" size="sm" onClick={() => refresh()}>
          <RefreshCw className="size-4" aria-hidden="true" />
          Refresh
        </Button>
      </div>

      {/* --- Headline rates ------------------------------------------------ */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <RateCard label="Delivery rate" value={rates.delivery} suffix="%" hint="Of messages attempted" tone="positive" />
        <RateCard label="Reply rate" value={rates.reply} suffix="%" hint="Of messages delivered" />
        <RateCard label="Bounce rate" value={rates.bounce} suffix="%" hint="Of messages attempted" tone={rates.bounce > 5 ? 'negative' : 'neutral'} />
        <RateCard label="Sent" value={totals.sent} hint={`${totals.failed.toLocaleString()} failed`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* --- Status breakdown -------------------------------------------- */}
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900">Campaigns by status</h2>
          <ul className="mt-4 space-y-2">
            {byStatus.map(([status, count]) => (
              <li key={status} className="flex items-center gap-3">
                <CampaignStatusBadge status={status} />
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-brand-500"
                    style={{ width: `${(count / Math.max(1, totals.campaigns)) * 100}%` }}
                  />
                </div>
                <span className="w-8 text-right text-sm tabular-nums text-slate-600">{count}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* --- Template performance ---------------------------------------- */}
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900">Templates by reply rate</h2>
          <p className="mt-1 text-xs text-slate-400">
            Ranked by replies over sends, so a template used twice cannot outrank one used a hundred
            times on a single lucky answer.
          </p>

          <ul className="mt-4 space-y-3">
            {topTemplates.map((template) => (
              <li key={template.id}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-sm text-slate-900">{template.name}</span>
                  <span className="shrink-0 text-sm font-medium tabular-nums text-slate-700">
                    {template.replyRate === null ? '—' : `${template.replyRate}%`}
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  {template.sent.toLocaleString()} sent, {template.replied.toLocaleString()} replied
                </p>
              </li>
            ))}
            {topTemplates.length === 0 && (
              <li className="py-6 text-center text-sm text-slate-400">No template has been used yet.</li>
            )}
          </ul>
        </section>
      </div>

      {/* --- Recent campaigns --------------------------------------------- */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">Recent campaigns</h2>

        <div className="scroll-x mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="py-2 pr-4 font-medium">Campaign</th>
                <th scope="col" className="py-2 pr-4 font-medium">Status</th>
                <th scope="col" className="py-2 pr-4 font-medium">Sent</th>
                <th scope="col" className="py-2 pr-4 font-medium">Replied</th>
                <th scope="col" className="py-2 font-medium">Delivery</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recent.map((campaign) => (
                <tr key={campaign.id}>
                  <td className="max-w-64 truncate py-2 pr-4">
                    <Link
                      to={ROUTE_PATHS.CAMPAIGN_DETAIL.replace(':id', campaign.id)}
                      className="text-slate-900 hover:text-blue-600"
                    >
                      {campaign.name}
                    </Link>
                  </td>
                  <td className="py-2 pr-4">
                    <CampaignStatusBadge status={campaign.status} />
                  </td>
                  <td className="py-2 pr-4 tabular-nums text-slate-600">
                    {(campaign.stats?.sent ?? 0).toLocaleString()}
                  </td>
                  <td className="py-2 pr-4 tabular-nums text-slate-600">
                    {(campaign.stats?.replied ?? 0).toLocaleString()}
                  </td>
                  <td className="py-2 tabular-nums text-slate-600">
                    {campaign.rates?.delivery === null || campaign.rates?.delivery === undefined
                      ? '—'
                      : `${campaign.rates.delivery}%`}
                  </td>
                </tr>
              ))}
              {recent.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    No campaigns yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

export default CampaignAnalyticsPage
