/**
 * System status card.
 *
 * Reports the health of each tier: this API, MongoDB, and Microsoft Graph.
 *
 * Its own component rather than another `StatusCard` because each row pairs a
 * badge with supporting detail (latency, host, reason), and because it owns the
 * rule for the overall headline badge: the worst tier wins. A dashboard claiming
 * "Healthy" while one dependency is failing would be worse than no badge at all.
 */

import { Activity, Cloud, Database, RefreshCw, Server } from 'lucide-react'

import { StatusBadge } from '@/components/common/StatusBadge'
import { Spinner } from '@/components/ui/Spinner'
import { SERVICE_STATUS } from '@/constants/status.constants'

/** Severity order, worst first. Drives the headline badge. */
const SEVERITY = [
  SERVICE_STATUS.ERROR,
  SERVICE_STATUS.OFFLINE,
  SERVICE_STATUS.DEGRADED,
  SERVICE_STATUS.UNKNOWN,
  SERVICE_STATUS.NOT_CONFIGURED,
  SERVICE_STATUS.HEALTHY,
]

/**
 * Picks the most severe status among the tiers.
 *
 * `not_configured` deliberately ranks *below* `unknown`: an unconnected mailbox
 * is an expected state for a new account, not a fault, and must not colour the
 * whole card red.
 */
function worstOf(statuses) {
  for (const candidate of SEVERITY) {
    if (statuses.includes(candidate)) return candidate
  }
  return SERVICE_STATUS.UNKNOWN
}

/** Formats seconds as a compact human duration. */
function formatUptime(seconds) {
  if (typeof seconds !== 'number' || Number.isNaN(seconds)) return null

  const total = Math.floor(seconds)
  const days = Math.floor(total / 86_400)
  const hours = Math.floor((total % 86_400) / 3600)
  const minutes = Math.floor((total % 3600) / 60)

  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m ${total % 60}s`
}

/** One tier row: icon, name, detail, badge. */
function TierRow({ icon: Icon, name, status, detail }) {
  return (
    <div className="flex items-center gap-3 py-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500">
        <Icon className="size-4" aria-hidden="true" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-800">{name}</p>
        {detail && <p className="truncate text-xs text-slate-500">{detail}</p>}
      </div>

      <StatusBadge state={status} size="sm" />
    </div>
  )
}

/**
 * @param {{
 *   status?: ?object,
 *   isRefreshing?: boolean,
 *   onRefresh?: () => void,
 * }} props
 *   `status` is the `/account/status` payload. While it is absent the card falls
 *   back to the values `/dashboard` already returned, so the tiers it can know
 *   about locally still render immediately.
 */
export function SystemStatusCard({ status, isRefreshing = false, onRefresh }) {
  const backend = status?.backend
  const database = status?.database
  const graph = status?.graph

  const backendStatus = backend?.status ?? SERVICE_STATUS.UNKNOWN
  const databaseStatus = database?.status ?? SERVICE_STATUS.UNKNOWN
  const graphStatus = graph?.status ?? SERVICE_STATUS.UNKNOWN

  // The API's own tier reports `online`, which is healthy for the purposes of
  // the headline; map it before comparing severities.
  const headline = worstOf([
    backendStatus === 'online' ? SERVICE_STATUS.HEALTHY : SERVICE_STATUS.OFFLINE,
    databaseStatus,
    graphStatus,
  ])

  const graphDetail =
    graph?.detail ??
    (typeof graph?.latencyMs === 'number' ? `Responded in ${graph.latencyMs} ms` : null)

  return (
    <section className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card transition-shadow hover:shadow-card-hover">
      <header className="flex items-start gap-3 border-b border-slate-100 px-5 py-4">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-cyan-50 text-cyan-600 ring-1 ring-inset ring-cyan-600/10">
          <Activity className="size-[18px]" aria-hidden="true" />
        </span>

        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold text-slate-900">System status</h2>
          <p className="mt-0.5 truncate text-xs text-slate-500">
            {status?.timestamp
              ? `Checked ${new Date(status.timestamp).toLocaleTimeString()}`
              : 'Awaiting first check'}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {isRefreshing ? <Spinner size="xs" label="Refreshing status" /> : null}
          <StatusBadge state={headline} size="sm" />
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              aria-label="Refresh system status"
              className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw className="size-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 divide-y divide-slate-100 px-5 py-1">
        <TierRow
          icon={Server}
          name="Backend API"
          status={backendStatus}
          detail={
            backend
              ? `v${backend.version} · ${backend.environment} · up ${formatUptime(backend.uptimeSeconds) ?? '—'}`
              : null
          }
        />
        <TierRow
          icon={Database}
          name="MongoDB"
          status={databaseStatus}
          detail={database ? `${database.state} · ${database.name ?? 'unknown database'}` : null}
        />
        <TierRow
          icon={Cloud}
          name="Microsoft Graph"
          status={graphStatus}
          detail={graphDetail}
        />
      </div>
    </section>
  )
}

export default SystemStatusCard
