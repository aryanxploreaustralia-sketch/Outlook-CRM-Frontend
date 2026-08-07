/**
 * The "nothing here" surface.
 *
 * An empty state is a design problem, not a fallback. Three things are always
 * present because their absence is what makes an empty screen feel broken:
 *
 *  1. **What is missing**, in the user's words, not the schema's.
 *  2. **Why it might be missing** — genuinely empty, or filtered to nothing.
 *     These need different wording and different recovery, so the component
 *     takes a `variant` and refuses to guess.
 *  3. **A way out** — an action for the empty case, a clear-filters button for
 *     the filtered case.
 */

import { FilterX, Inbox, SearchX } from 'lucide-react'

import { Button } from '@/components/ui/Button'

const VARIANTS = {
  /** The collection has no records at all. */
  empty: { Icon: Inbox, tone: 'text-slate-400' },
  /** Records exist, but the current filters match none of them. */
  filtered: { Icon: FilterX, tone: 'text-amber-500' },
  /** A search term matched nothing. */
  search: { Icon: SearchX, tone: 'text-slate-400' },
}

/**
 * @param {{
 *   variant?: keyof typeof VARIANTS,
 *   title: string,
 *   description?: string,
 *   actionLabel?: string,
 *   onAction?: () => void,
 *   secondaryLabel?: string,
 *   onSecondary?: () => void,
 *   compact?: boolean,
 *   className?: string,
 * }} props
 */
export function AdminEmptyState({
  variant = 'empty',
  title,
  description,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
  compact = false,
  className = '',
}) {
  const { Icon, tone } = VARIANTS[variant] ?? VARIANTS.empty

  return (
    <div
      className={`flex flex-col items-center justify-center px-6 text-center ${
        compact ? 'py-10' : 'py-16'
      } ${className}`}
    >
      {/*
        Phase 16.1: a layered mark rather than a flat circle.
        Two concentric rings in CSS — no illustration asset, no extra request —
        which reads as considered where a lone grey circle reads as a
        placeholder somebody forgot to replace.
      */}
      <span className="relative grid place-items-center" aria-hidden="true">
        <span className="absolute size-[4.5rem] rounded-full bg-slate-50 ring-1 ring-inset ring-slate-100" />
        <span className="relative grid size-12 place-items-center rounded-full bg-white shadow-card ring-1 ring-slate-200/80">
          <Icon className={`size-[1.35rem] ${tone}`} />
        </span>
      </span>

      <p className="mt-5 text-[0.9375rem] font-semibold tracking-[-0.01em] text-slate-900">
        {title}
      </p>

      {description && (
        // `max-w-sm` keeps the measure readable; a full-width sentence in a wide
        // table is a line the eye loses track of halfway across.
        <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>
      )}

      {(actionLabel || secondaryLabel) && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {actionLabel && onAction && (
            <Button size="sm" onClick={onAction}>
              {actionLabel}
            </Button>
          )}
          {secondaryLabel && onSecondary && (
            <Button size="sm" variant="secondary" onClick={onSecondary}>
              {secondaryLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

export default AdminEmptyState
