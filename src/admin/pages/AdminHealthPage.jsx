/**
 * System health.
 *
 * Backed by `GET /api/v1/admin/system-health` — nine live probes across the
 * database, the API process, the three background workers, Microsoft Graph,
 * Google sign-in, the mailbox estate and workbook storage.
 *
 * ## Why this is a separate endpoint from `/api/v1/health`
 *
 * The public health endpoint is shallow — a database check, unauthenticated,
 * answered in under ten milliseconds — and it stays that way. A load balancer
 * polls it every few seconds; adding dependency probes to it would make an
 * outage *elsewhere* look like an outage here and pull a healthy service out of
 * rotation.
 *
 * ## Every tile states its reason
 *
 * "Warning" tells an operator nothing they can act on. "Enabled, but the last
 * pass was 40 minutes ago — more than three intervals" tells them where to look.
 * The server supplies that sentence per component; this screen renders it.
 *
 * The overall state is the **worst** component's, never an average. A platform
 * reporting healthy with a dependency offline is a summary nobody reads twice.
 */

import { useCallback, useMemo } from 'react'
import { RefreshCw, ShieldAlert } from 'lucide-react'

import {
  AdminBadge,
  AdminCard,
  AdminEmptyState,
  AdminErrorState,
  AdminPageContainer,
  AdminSection,
  AdminStatsLoading,
} from '@/admin/components'
import {
  ADMIN_HEALTH_STATE,
  ADMIN_HEALTH_STATE_LABELS,
  ADMIN_HEALTH_TONE,
} from '@/admin/constants/admin.constants'
import { useAdminBreadcrumbs, useAdminResource } from '@/admin/hooks'
import { fetchAdminHealth } from '@/admin/services/admin.service'
import { formatRelative } from '@/admin/utils/format'
import { Button } from '@/components/ui/Button'
import { AuditEventList } from '@/admin/components/audit/AuditEventList'
import { auditLinkFor } from '@/admin/constants/audit.constants'

/**
 * Left-border treatment per state.
 *
 * The border is the at-a-glance cue and the badge label is the unambiguous one.
 * No tile is ever distinguishable by colour alone.
 */
const STATE_BORDER = {
  [ADMIN_HEALTH_STATE.HEALTHY]: 'border-l-emerald-500',
  [ADMIN_HEALTH_STATE.WARNING]: 'border-l-amber-500',
  [ADMIN_HEALTH_STATE.OFFLINE]: 'border-l-red-500',
  [ADMIN_HEALTH_STATE.UNKNOWN]: 'border-l-slate-300',
}

export function AdminHealthPage() {
  const breadcrumb = useAdminBreadcrumbs()

  const loader = useCallback((options) => fetchAdminHealth(options), [])
  const { data, error, isLoading, isRefreshing, refresh } = useAdminResource(loader)

  /** Grouped so related dependencies sit together rather than in probe order. */
  const groups = useMemo(() => {
    const byGroup = new Map()

    for (const component of data?.components ?? []) {
      if (!byGroup.has(component.group)) byGroup.set(component.group, [])
      byGroup.get(component.group).push(component)
    }

    return [...byGroup.entries()]
  }, [data])

  const actions = (
    <Button variant="secondary" size="sm" onClick={refresh} isLoading={isRefreshing}>
      <RefreshCw className="size-3.5" aria-hidden="true" />
      Re-probe
    </Button>
  )

  if (error) {
    return (
      <AdminPageContainer
        title="System health"
        subtitle="Live probes across every dependency"
        breadcrumb={breadcrumb}
        actions={actions}
      >
        <AdminErrorState error={error} onRetry={refresh} />
      </AdminPageContainer>
    )
  }

  return (
    <AdminPageContainer
      title="System health"
      subtitle="Live probes across the database, the workers, the providers and storage"
      breadcrumb={breadcrumb}
      notice={data?.note}
      isRefreshing={isRefreshing}
      actions={actions}
    >
      {isLoading ? (
        <>
          <AdminStatsLoading count={3} columns="sm:grid-cols-3" />
          <AdminStatsLoading count={9} columns="sm:grid-cols-2 xl:grid-cols-3" />
        </>
      ) : !data?.components?.length ? (
        <AdminCard>
          <AdminEmptyState
            title="No probe results"
            description="The server returned no components. Try probing again."
            actionLabel="Run probes"
            onAction={refresh}
          />
        </AdminCard>
      ) : (
        <>
          {/* --- Overall banner ---------------------------------------- */}
          <div
            className={`flex flex-wrap items-center gap-3 rounded-xl border border-l-4 border-slate-200 bg-white px-4 py-3.5 shadow-card ${
              STATE_BORDER[data.status] ?? STATE_BORDER.unknown
            }`}
          >
            <ShieldAlert
              className={`size-5 shrink-0 ${
                data.status === ADMIN_HEALTH_STATE.HEALTHY ? 'text-emerald-600' : 'text-amber-600'
              }`}
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">
                Platform is {data.statusLabel ?? ADMIN_HEALTH_STATE_LABELS[data.status]}
              </p>
              <p className="mt-0.5 text-sm text-slate-600">
                {data.summary.healthy} healthy · {data.summary.warning} warning ·{' '}
                {data.summary.offline} offline · {data.summary.unknown} unknown
              </p>
            </div>
            <span className="text-xs text-slate-400">Probed {formatRelative(data.checkedAt)}</span>
          </div>

          {/* --- Probe grid --------------------------------------------- */}
          {groups.map(([group, components]) => (
            <AdminSection key={group} title={group}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {components.map((component) => (
                  <div
                    key={component.id}
                    className={`rounded-xl border border-l-4 border-slate-200 bg-white p-4 shadow-card ${
                      STATE_BORDER[component.state] ?? STATE_BORDER.unknown
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="min-w-0 truncate text-sm font-semibold text-slate-900">
                        {component.name}
                      </h3>
                      <AdminBadge tone={ADMIN_HEALTH_TONE[component.state] ?? 'neutral'} dot>
                        {ADMIN_HEALTH_STATE_LABELS[component.state] ?? component.state}
                      </AdminBadge>
                    </div>

                    <p className="mt-1.5 text-sm text-slate-600">{component.detail}</p>

                    {component.metrics.length > 0 && (
                      <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3">
                        {component.metrics.map((metric) => (
                          <div key={metric.label} className="min-w-0">
                            <dt className="truncate text-[11px] uppercase tracking-wide text-slate-400">
                              {metric.label}
                            </dt>
                            <dd className="mt-0.5 truncate text-sm font-medium tabular-nums text-slate-800">
                              {metric.value}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    )}
                  </div>
                ))}
              </div>
            </AdminSection>
          ))}

          {/* --- Worker state ------------------------------------------- */}
          <AdminCard
            title="Background workers"
            description="Live flags from this API process — the same ones the graceful-shutdown drain reads"
          >
            <ul className="flex flex-wrap gap-2">
              {Object.entries(data.workers).map(([name, busy]) => (
                <li key={name}>
                  <AdminBadge tone={busy ? 'info' : 'neutral'} dot size="md">
                    {name}: {busy ? 'running' : 'idle'}
                  </AdminBadge>
                </li>
              ))}
            </ul>
          </AdminCard>

          {/* Phase 14.7: system-category audit events.
              Separate from the dependency probes above, which describe state
              *now*. This describes what was done — and the two answer different
              questions when something has just started failing. */}
          <AdminCard
            title="Recent system events"
            description="Scheduler decisions, manual runs and errors, from the audit log"
          >
            <AuditEventList
              filter={{ category: 'system' }}
              limit={10}
              emptyMessage="No system events have been recorded."
              viewAllTo={auditLinkFor({ category: 'system' })}
            />
          </AdminCard>

          <AdminCard
            title="Recent scheduler events"
            description="Every change to the morning run and every manual trigger"
          >
            <AuditEventList
              filter={{ category: 'scheduler' }}
              limit={10}
              emptyMessage="The scheduler has not been changed or triggered by hand."
              viewAllTo={auditLinkFor({ category: 'scheduler' })}
            />
          </AdminCard>
        </>
      )}
    </AdminPageContainer>
  )
}

export default AdminHealthPage
