/**
 * System page.
 *
 * Live end-to-end connectivity check. A successful render here proves the whole
 * chain works: React → Axios → Vite proxy → Express → Mongoose → MongoDB.
 */

import { Card } from '@/components/common/Card'
import { StatusBadge } from '@/components/common/StatusBadge'
import { HEALTH_STATE } from '@/constants/app.constants'
import { useApiHealth } from '@/hooks/useApiHealth'

const POLL_INTERVAL_MS = 15_000

/** Formats an uptime value in seconds as `1h 02m 03s`. */
function formatUptime(seconds) {
  if (typeof seconds !== 'number' || Number.isNaN(seconds)) return '—'
  const total = Math.floor(seconds)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = total % 60
  const pad = (n) => String(n).padStart(2, '0')
  return hours > 0 ? `${hours}h ${pad(minutes)}m ${pad(secs)}s` : `${minutes}m ${pad(secs)}s`
}

function DetailRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="font-mono text-sm text-slate-900">{value}</dd>
    </div>
  )
}

export function SystemPage() {
  const { data, error, isLoading, isError, refresh } = useApiHealth({
    pollIntervalMs: POLL_INTERVAL_MS,
  })

  const apiState = isError ? HEALTH_STATE.DOWN : data ? HEALTH_STATE.UP : HEALTH_STATE.UNKNOWN

  const dbStatus = data?.dependencies?.database?.status
  const dbState =
    dbStatus === 'connected'
      ? HEALTH_STATE.UP
      : dbStatus
        ? HEALTH_STATE.DOWN
        : HEALTH_STATE.UNKNOWN

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">System status</h1>
          <p className="mt-1 text-sm text-slate-500">
            Refreshes automatically every {POLL_INTERVAL_MS / 1000} seconds.
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={isLoading}
          className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? 'Checking…' : 'Refresh'}
        </button>
      </div>

      {isError && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          <p className="font-medium">Could not reach the API.</p>
          <p className="mt-0.5">{error?.message}</p>
          <p className="mt-1.5 text-red-700">
            Start it with <code className="font-mono">npm run dev:backend</code> from the project
            root.
          </p>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card title="API server" action={<StatusBadge state={apiState} />}>
          <dl className="divide-y divide-slate-100">
            <DetailRow label="Environment" value={data?.environment ?? '—'} />
            <DetailRow label="Version" value={data?.version ?? '—'} />
            <DetailRow label="Uptime" value={formatUptime(data?.uptimeSeconds)} />
          </dl>
        </Card>

        <Card title="MongoDB" action={<StatusBadge state={dbState} />}>
          <dl className="divide-y divide-slate-100">
            <DetailRow label="State" value={dbStatus ?? '—'} />
            <DetailRow label="Database" value={data?.dependencies?.database?.name ?? '—'} />
            <DetailRow label="Host" value={data?.dependencies?.database?.host ?? '—'} />
          </dl>
        </Card>
      </div>
    </div>
  )
}

export default SystemPage
