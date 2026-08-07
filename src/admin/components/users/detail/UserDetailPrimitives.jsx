/**
 * Shared pieces of the user dashboard.
 *
 * Extracted because all nine sections use the same three shapes — a labelled
 * fact, a titled section shell, and a "this needs data we do not collect yet"
 * notice — and nine hand-rolled copies is how the spacing drifts between the
 * top of the page and the bottom.
 */

import { forwardRef } from 'react'
import { Clock, Info } from 'lucide-react'

import { AdminCard } from '@/admin/components/AdminCard'
import { EMPTY } from '@/admin/utils/format'

/**
 * A section of the dashboard.
 *
 * A real `<section>` with its heading referenced by `aria-labelledby`, and an
 * `id` the scroll-spy observes — so the left navigation, the URL hash and
 * assistive technology all agree on where the reader is.
 */
export const UserSection = forwardRef(function UserSection(
  { id, title, description, action, children },
  ref,
) {
  return (
    <section
      id={id}
      ref={ref}
      aria-labelledby={`${id}-heading`}
      // Offsets the sticky top bar so a scrolled-to heading is not tucked
      // underneath it.
      className="scroll-mt-6"
    >
      <div className="mb-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h2 id={`${id}-heading`} className="text-sm font-semibold text-slate-900">
            {title}
          </h2>
          {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>

      {children}
    </section>
  )
})

/**
 * One labelled fact.
 *
 * Stacks on narrow viewports and sits label-left / value-right on wide ones,
 * because a two-column row at 360px wraps into something that reads as two
 * separate facts.
 */
export function Fact({ label, value, hint }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-slate-100 py-2.5 last:border-b-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
      <dt className="shrink-0 text-xs font-medium text-slate-500">{label}</dt>
      <dd className="min-w-0 sm:text-right">
        <span className="text-sm text-slate-800">{value ?? EMPTY}</span>
        {hint && <span className="mt-0.5 block text-xs text-slate-400">{hint}</span>}
      </dd>
    </div>
  )
}

/**
 * States plainly that a figure is not measured yet.
 *
 * Used instead of rendering a zero. A zero is a measurement; "not tracked" is
 * the absence of one, and an administrator who reads 0% open rate will act on it
 * exactly as if it were true.
 */
export function NotTracked({ children }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-normal text-slate-400">
      <Clock className="size-3" aria-hidden="true" />
      {children ?? 'Not tracked yet'}
    </span>
  )
}

/**
 * The placeholder a whole section shows when its data does not exist yet.
 *
 * Says what will appear and what has to happen first, rather than an empty box.
 * A blank panel reads as a bug; a stated absence reads as a roadmap.
 */
export function PendingSection({ title, children }) {
  return (
    <AdminCard>
      <div className="flex items-start gap-3 px-1 py-3">
        <span
          className="grid size-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-400"
          aria-hidden="true"
        >
          <Info className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-800">{title}</p>
          <p className="mt-1 max-w-prose text-sm text-slate-500">{children}</p>
        </div>
      </div>
    </AdminCard>
  )
}

export default UserSection
