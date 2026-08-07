/**
 * Skeleton placeholders.
 *
 * Preferred over a spinner for content that has a known shape: reserving the
 * final layout prevents the page jumping when data arrives, which is the single
 * most noticeable difference between a polished product and a rough one.
 *
 * `aria-hidden` is applied because the skeleton is decorative — the surrounding
 * container announces the loading state once, via `role="status"`, instead of a
 * screen reader reading out a dozen meaningless boxes.
 */

/**
 * A single shimmering block.
 *
 * @param {{ className?: string, rounded?: string }} props
 */
export function Skeleton({ className = 'h-4 w-full', rounded = 'rounded-md' }) {
  /*
   * Phase 16.1: the shared `.skeleton` shimmer rather than `animate-pulse`.
   *
   * Two reasons. Tailwind's pulse runs on its own 2s clock per element, so a
   * page of skeletons flickers out of step and reads as broken rather than
   * loading; one keyframe means they breathe together. And it eases with the
   * product's own curve instead of `cubic-bezier(0.4,0,0.6,1)`, so loading
   * moves like everything else does.
   *
   * `rounded` is still honoured for callers that need a circle or a pill; the
   * class supplies the default radius when they do not.
   */
  return <div className={`skeleton ${rounded} ${className}`} aria-hidden="true" />
}

/**
 * Skeleton shaped like a dashboard information card.
 *
 * @param {{ rows?: number, className?: string }} props
 */
export function SkeletonCard({ rows = 3, className = '' }) {
  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white shadow-card ${className}`}
      role="status"
      aria-label="Loading card"
    >
      <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
        <Skeleton className="size-9" rounded="rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-3 w-44" />
        </div>
      </div>
      <div className="space-y-3 px-5 py-4">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="flex items-center justify-between gap-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-36" />
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Skeleton shaped like the profile card.
 */
export function SkeletonProfile({ className = '' }) {
  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white shadow-card ${className}`}
      role="status"
      aria-label="Loading profile"
    >
      <div className="flex flex-col items-center gap-3 border-b border-slate-100 px-6 py-6">
        <Skeleton className="size-16" rounded="rounded-full" />
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-48" />
      </div>
      <div className="space-y-3 px-6 py-5">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="flex items-center justify-between gap-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-32" />
          </div>
        ))}
      </div>
    </div>
  )
}

export default Skeleton
