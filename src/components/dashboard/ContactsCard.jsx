/**
 * Contacts summary on the dashboard.
 *
 * Fetches its own statistics rather than taking them from the dashboard payload:
 * the counters come from one indexed aggregation, and keeping them separate
 * means a large address book cannot delay the cards above it.
 */

import { useCallback } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Building2, Star, UserPlus, Users } from 'lucide-react'

import { fetchStatistics } from '@/api/services/contact.service'
import { Button } from '@/components/ui/Button'
import { useApiResource } from '@/hooks/useApiResource'
import { ROUTE_PATHS } from '@/routes/paths'

/** One counter tile. Becomes a link when there is somewhere useful to go. */
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

  const className = 'flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-3 py-2.5'

  return to ? (
    <Link to={to} className={`${className} transition-colors hover:border-brand-300 hover:bg-brand-50/40`}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  )
}

export function ContactsCard() {
  const fetcher = useCallback(({ signal }) => fetchStatistics({ signal }), [])
  const { data: stats, isInitialLoading } = useApiResource(fetcher)

  if (isInitialLoading) {
    return (
      <section
        className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card"
        aria-busy="true"
      >
        <div className="border-b border-slate-100 px-5 py-4">
          <div className="h-4 w-28 animate-pulse rounded bg-slate-200" />
        </div>
        <div className="space-y-3 px-5 py-4">
          <div className="h-12 w-full animate-pulse rounded bg-slate-100" />
          <div className="h-12 w-full animate-pulse rounded bg-slate-100" />
        </div>
      </section>
    )
  }

  const conflicts = stats?.withConflicts ?? 0

  return (
    <section className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
      <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-600 ring-1 ring-inset ring-indigo-600/10">
            <Users className="size-[18px]" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-slate-900">Contacts</h2>
            <p className="truncate text-xs text-slate-500">Address book at a glance</p>
          </div>
        </div>

        <Link
          to={ROUTE_PATHS.CONTACT_NEW}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-brand-600 transition-colors hover:bg-brand-50"
        >
          <UserPlus className="size-3.5" aria-hidden="true" />
          New
        </Link>
      </header>

      <div className="flex-1 px-5 py-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat
            icon={Users}
            label="Total"
            value={stats?.total ?? 0}
            tone="bg-indigo-50 text-indigo-600"
            to={ROUTE_PATHS.CONTACTS}
          />
          <Stat
            icon={UserPlus}
            label="New (30d)"
            value={stats?.recentlyAdded ?? 0}
            tone="bg-emerald-50 text-emerald-600"
            to={`${ROUTE_PATHS.CONTACTS}?filter=recently_added`}
          />
          <Stat
            icon={Star}
            label="Favorites"
            value={stats?.favorites ?? 0}
            tone="bg-amber-50 text-amber-600"
            to={`${ROUTE_PATHS.CONTACTS}?filter=favorites`}
          />
          <Stat
            icon={Building2}
            label="Distinct companies"
            value={stats?.companies ?? 0}
            tone="bg-cyan-50 text-cyan-600"
          />
        </div>

        {/* Source split — how much of the book is synced versus CRM-native. */}
        {stats?.total > 0 && (
          <div className="mt-3">
            <div className="mb-1 flex justify-between text-[11px] text-slate-500">
              <span>Outlook {stats.bySource?.outlook ?? 0}</span>
              <span>CRM {(stats.bySource?.crm ?? 0) + (stats.bySource?.import ?? 0)}</span>
            </div>
            <div className="flex h-1.5 overflow-hidden rounded-full bg-slate-200">
              <div
                className="bg-blue-500"
                style={{ width: `${((stats.bySource?.outlook ?? 0) / stats.total) * 100}%` }}
              />
              <div
                className="bg-violet-500"
                style={{
                  width: `${(((stats.bySource?.crm ?? 0) + (stats.bySource?.import ?? 0)) / stats.total) * 100}%`,
                }}
              />
            </div>
          </div>
        )}

        {conflicts > 0 && (
          <p className="mt-2 flex items-start gap-1.5 text-xs text-orange-700">
            <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
            <span>
              {conflicts} contact{conflicts === 1 ? ' has' : 's have'} a sync conflict.{' '}
              <Link to={`${ROUTE_PATHS.CONTACTS}?filter=has_conflict`} className="font-medium underline">
                Review
              </Link>
            </span>
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3">
        <Button as={Link} to={ROUTE_PATHS.CONTACTS} size="sm">
          <Users className="size-3.5" aria-hidden="true" />
          All contacts
        </Button>
        <Button as={Link} to={ROUTE_PATHS.CONTACT_GROUPS} variant="secondary" size="sm">
          Groups
        </Button>
        <Button as={Link} to={ROUTE_PATHS.CONTACT_IMPORT} variant="ghost" size="sm">
          Import
        </Button>
      </div>
    </section>
  )
}

export default ContactsCard
