/**
 * Loading placeholders shaped like the content they replace.
 *
 * Skeletons rather than spinners, for the reason the CRM's own `Skeleton`
 * documents: reserving the final layout stops the page jumping when data lands.
 * A spinner reserves nothing, so every load ends in a reflow.
 *
 * Each export announces itself once via `role="status"` and marks its individual
 * bars `aria-hidden`, so a screen reader says "Loading users" rather than
 * reading out forty meaningless boxes.
 */

import { Skeleton } from '@/components/ui/Skeleton'

/**
 * A grid of stat-card skeletons.
 *
 * @param {{ count?: number, columns?: string, className?: string }} props
 */
export function AdminStatsLoading({
  count = 4,
  columns = 'sm:grid-cols-2 xl:grid-cols-4',
  className = '',
}) {
  return (
    <div
      className={`grid grid-cols-1 gap-4 ${columns} ${className}`}
      role="status"
      aria-label="Loading statistics"
    >
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="rounded-xl border border-slate-200 bg-white p-4 shadow-card">
          <div className="flex items-start justify-between gap-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="size-8" rounded="rounded-lg" />
          </div>
          <Skeleton className="mt-3 h-7 w-20" />
          <Skeleton className="mt-2 h-3 w-28" />
        </div>
      ))}
    </div>
  )
}

/**
 * Rows shaped like a table body.
 *
 * `columns` is the real column count so the skeleton's rhythm matches the table
 * that replaces it. Widths alternate deliberately — uniform bars read as a
 * loading bar, varied ones read as text.
 *
 * @param {{ rows?: number, columns?: number, className?: string }} props
 */
export function AdminTableLoading({ rows = 6, columns = 5, className = '' }) {
  const widths = ['w-32', 'w-24', 'w-40', 'w-20', 'w-28', 'w-16']

  return (
    <div className={className} role="status" aria-label="Loading table">
      <div className="divide-y divide-slate-100">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="flex items-center gap-4 px-5 py-3.5">
            {Array.from({ length: columns }).map((__, colIndex) => (
              <div key={colIndex} className="flex-1">
                <Skeleton className={`h-3.5 ${widths[(rowIndex + colIndex) % widths.length]}`} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * A block standing in for a chart.
 *
 * @param {{ height?: string, className?: string }} props
 */
export function AdminChartLoading({ height = 'h-56', className = '' }) {
  return (
    <div className={className} role="status" aria-label="Loading chart">
      <Skeleton className={`${height} w-full`} rounded="rounded-lg" />
    </div>
  )
}

/**
 * A stack of list-row skeletons, for feeds and timelines.
 *
 * @param {{ rows?: number, className?: string }} props
 */
export function AdminListLoading({ rows = 5, className = '' }) {
  return (
    <div className={`space-y-4 ${className}`} role="status" aria-label="Loading list">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-start gap-3">
          <Skeleton className="size-8 shrink-0" rounded="rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  )
}

export default AdminStatsLoading
