/**
 * The pipeline board.
 *
 * Ten columns in stage order, each showing its count and the newest few cards.
 * The whole register is deliberately not rendered — a board of 1,671 cards is
 * unusable, and the payload would be megabytes.
 */

import { Link } from 'react-router-dom'
import { ArrowLeft, RefreshCw } from 'lucide-react'

import { ErrorScreen } from '@/components/common/ErrorScreen'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { usePipeline } from '@/hooks/useLeads'
import { ROUTE_PATHS } from '@/routes/paths'
import { resolveErrorVariant } from '@/utils/apiError'

const formatDate = (value) => (value ? new Date(value).toLocaleDateString() : null)

export function LeadPipelinePage() {
  const { columns, total, isInitialLoading, isError, error, refresh } = usePipeline({ perStage: 12 })

  if (isInitialLoading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner label="Loading the pipeline" />
      </div>
    )
  }

  if (isError) {
    return <ErrorScreen variant={resolveErrorVariant(error)} error={error} onRetry={() => refresh()} />
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to={ROUTE_PATHS.LEADS} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700">
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            Back to the register
          </Link>
          <p className="mt-1 text-sm text-slate-500">{total.toLocaleString()} enquiries across ten stages.</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => refresh()}>
          <RefreshCw className="size-4" aria-hidden="true" />
          Refresh
        </Button>
      </div>

      {/* Horizontal scroll is contained here, so the page body never scrolls
          sideways on a narrow screen. */}
      <div className="overflow-x-auto pb-4">
        <div className="flex min-w-max gap-3">
          {columns.map((column) => (
            <section
              key={column.stage}
              className="flex w-64 shrink-0 flex-col rounded-xl border border-slate-200 bg-slate-50"
              aria-label={`${column.label}: ${column.count} enquiries`}
            >
              <header className="flex items-baseline justify-between gap-2 border-b border-slate-200 px-3 py-2.5">
                <h2 className="text-sm font-semibold text-slate-900">{column.label}</h2>
                <span className="text-sm font-medium tabular-nums text-slate-500">
                  {column.count.toLocaleString()}
                </span>
              </header>

              {!column.campaignEligible && (
                <p className="border-b border-slate-200 bg-white/60 px-3 py-1 text-xs text-slate-400">
                  Campaigns skip this stage
                </p>
              )}

              <div className="flex-1 space-y-2 overflow-y-auto p-2" style={{ maxHeight: '60vh' }}>
                {column.items.map((lead) => (
                  <Link
                    key={lead.id}
                    to={ROUTE_PATHS.LEAD_DETAIL.replace(':id', lead.id)}
                    className="block rounded-lg border border-slate-200 bg-white p-2.5 transition hover:border-blue-400"
                  >
                    <p className="font-mono text-xs text-blue-600">{lead.reference}</p>
                    <p className="mt-0.5 truncate text-sm font-medium text-slate-900">{lead.contactPerson}</p>
                    <p className="truncate text-xs text-slate-500">{lead.companyName ?? '—'}</p>
                    <p className="mt-1 flex flex-wrap gap-x-2 text-xs text-slate-400">
                      {lead.city && <span>{lead.city}</span>}
                      {lead.paxText && <span>· {lead.paxText}</span>}
                      {(lead.travelDate || lead.travelDateText) && (
                        <span>· {formatDate(lead.travelDate) ?? lead.travelDateText}</span>
                      )}
                    </p>
                  </Link>
                ))}

                {column.items.length === 0 && (
                  <p className="px-2 py-6 text-center text-xs text-slate-400">Nothing here.</p>
                )}

                {column.count > column.items.length && (
                  <Link
                    to={`${ROUTE_PATHS.LEADS}?stage=${column.stage}`}
                    className="block rounded-lg border border-dashed border-slate-300 px-2 py-2 text-center text-xs text-slate-500 hover:border-blue-400 hover:text-blue-600"
                  >
                    View all {column.count.toLocaleString()}
                  </Link>
                )}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}

export default LeadPipelinePage
