/**
 * One person's activity over time.
 *
 * ## The window follows the bucket size
 *
 * A "yearly" chart of the last 30 days is one bar, and a "daily" chart of five
 * years is two thousand. So choosing the bucket also chooses how far back to
 * look — thirty days of days, twelve weeks of weeks, twelve months of months,
 * five years of years. Each gives roughly a dozen readable buckets, and the
 * window is printed under the control so the reader is never guessing what
 * span they are looking at.
 *
 * This is the one place in the console with its own period rather than the
 * global one, and it is deliberate: the global filter selects a reporting
 * period, while this control selects a *resolution*. Forcing them together
 * would mean picking "yesterday" turned every chart here into a single column.
 *
 * ## Gap-filled by the server
 *
 * An aggregation only emits buckets that matched something. Plotted raw, a
 * fortnight of no activity becomes a straight line between two distant points —
 * the chart draws work that never happened. The endpoint scaffolds every bucket
 * in the window and fills the misses with zero, so a quiet week looks quiet.
 *
 * ## Six single-measure plots, not one combined chart
 *
 * Emails and campaigns differ by two orders of magnitude. On shared axes the
 * campaign series is a flat line on the floor; on dual axes the two are scaled
 * against each other arbitrarily and the reader infers a relationship the data
 * does not contain.
 */

import { useCallback, useState } from 'react'

import {
  ADMIN_CHART_COLORS,
  AdminAreaChart,
  AdminBarChart,
  AdminCard,
  AdminChartLoading,
  AdminErrorState,
  AdminStatCard,
} from '@/admin/components'
import { UserSection } from '@/admin/components/users/detail/UserDetailPrimitives'
import { useAdminResource } from '@/admin/hooks'
import { fetchAdminUserPerformance } from '@/admin/services/admin.service'
import { formatCount } from '@/admin/utils/format'

/**
 * Bucket size, and the span that makes it readable.
 *
 * `days` is sent as an explicit `from`/`to` pair rather than a preset, because
 * none of the shared presets means "the last twelve weeks".
 */
const UNITS = [
  { value: 'day', label: 'Daily', days: 30, window: 'last 30 days' },
  { value: 'week', label: 'Weekly', days: 84, window: 'last 12 weeks' },
  { value: 'month', label: 'Monthly', days: 365, window: 'last 12 months' },
  { value: 'year', label: 'Yearly', days: 365 * 5, window: 'last 5 years' },
]

const isoDay = (date) => date.toISOString().slice(0, 10)

/**
 * @param {{
 *   userId: string,
 *   canSee: boolean,
 *   enabled?: boolean,
 *   registerRef: (id: string) => object,
 * }} props
 */
export function UserTrendSection({ userId, canSee, enabled = true, registerRef }) {
  const [unit, setUnit] = useState('day')

  const selected = UNITS.find((option) => option.value === unit) ?? UNITS[0]

  const loader = useCallback(
    (options) => {
      const to = new Date()
      const from = new Date(to.getTime() - selected.days * 86_400_000)

      return fetchAdminUserPerformance(userId, {
        unit: selected.value,
        from: isoDay(from),
        to: isoDay(to),
        ...options,
      })
    },
    [userId, selected.days, selected.value],
  )

  const { data, error, isLoading, refresh } = useAdminResource(loader, {
    deps: [userId, unit],
    // Gated on the permission *and* on `enabled`, which the page sets once the
    // section has been scrolled to — six aggregations is not a cost to impose
    // on a reader who never gets this far down the page.
    enabled: canSee && enabled,
  })

  const totals = data?.totals

  const charts = [
    { key: 'emails', title: 'Emails sent', series: data?.series?.emails, kind: 'bar' },
    { key: 'replies', title: 'Replies received', series: data?.series?.replies, kind: 'area' },
    { key: 'leads', title: 'Enquiries created', series: data?.series?.leads, kind: 'area' },
    { key: 'campaigns', title: 'Campaigns created', series: data?.series?.campaigns, kind: 'bar' },
    { key: 'companies', title: 'Companies added', series: data?.series?.companies, kind: 'bar' },
    { key: 'contacts', title: 'Contacts added', series: data?.series?.contacts, kind: 'bar' },
  ]

  return (
    <UserSection
      id="trend"
      ref={registerRef('trend')}
      title="Activity over time"
      description={`Recorded activity for this account, grouped by ${selected.label.toLowerCase()} bucket over the ${selected.window}.`}
      action={
        <div role="group" aria-label="Bucket size" className="inline-flex rounded-lg bg-slate-100 p-0.5">
          {UNITS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setUnit(option.value)}
              aria-pressed={unit === option.value}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                unit === option.value
                  ? 'bg-white text-slate-900 shadow-card'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      }
    >
      {!canSee ? (
        <p className="text-sm text-slate-500">
          Viewing another person&rsquo;s activity requires the analytics permission.
        </p>
      ) : error ? (
        <AdminErrorState error={error} onRetry={refresh} compact />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            <AdminStatCard
              label="Emails sent"
              value={formatCount(totals?.emailsSent ?? 0)}
              isLoading={isLoading}
            />
            <AdminStatCard
              label="Replies"
              value={formatCount(totals?.replies ?? 0)}
              isLoading={isLoading}
            />
            <AdminStatCard
              label="Enquiries"
              value={formatCount(totals?.leadsCreated ?? 0)}
              isLoading={isLoading}
            />
            <AdminStatCard
              label="Campaigns"
              value={formatCount(totals?.campaigns ?? 0)}
              isLoading={isLoading}
            />
            <AdminStatCard
              label="Companies added"
              value={formatCount(totals?.companiesAdded ?? 0)}
              isLoading={isLoading}
            />
            <AdminStatCard
              label="Contacts added"
              value={formatCount(totals?.contactsAdded ?? 0)}
              isLoading={isLoading}
            />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
            {charts.map((chart, index) => (
              <AdminCard key={chart.key} title={chart.title}>
                {isLoading ? (
                  <AdminChartLoading />
                ) : chart.kind === 'bar' ? (
                  <AdminBarChart
                    data={chart.series ?? []}
                    // Cycled so adjacent cards differ, from the validated
                    // categorical palette — the hue carries no meaning here and
                    // is not read as a scale.
                    color={ADMIN_CHART_COLORS[index % ADMIN_CHART_COLORS.length]}
                    height={180}
                    ariaLabel={`${chart.title} per ${selected.value}`}
                  />
                ) : (
                  <AdminAreaChart
                    data={chart.series ?? []}
                    color={ADMIN_CHART_COLORS[index % ADMIN_CHART_COLORS.length]}
                    height={180}
                    ariaLabel={`${chart.title} per ${selected.value}`}
                  />
                )}
              </AdminCard>
            ))}
          </div>

          {data?.period && (
            <p className="mt-4 text-xs text-slate-400">
              {data.period.buckets} buckets · aggregated live at request time
            </p>
          )}
        </>
      )}
    </UserSection>
  )
}

export default UserTrendSection
