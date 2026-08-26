/**
 * The secondary filters, in a popover rather than a permanent column.
 *
 * ## Why this replaced the rail
 *
 * The Leads register grew a horizontal filter bar, and for a while it kept the
 * left-hand rail as well — two homes for one set of filters, one of them
 * costing a quarter of the page width whether or not anybody used it. This is
 * the same controls, opened on demand, with the table getting the width back.
 *
 * ## It owns no filter state
 *
 * Deliberately, and for the same reason the rail did not: every control inside
 * is passed as `children` and stays wired to the page's own state and query
 * parameters. A popover holding its own copy of the filters would be a second
 * filtering system, and the two would disagree the moment somebody cleared one
 * from a chip.
 */

import { useEffect, useRef, useState } from 'react'
import { ChevronDown, SlidersHorizontal } from 'lucide-react'

import { Button } from '@/components/ui/Button'

/**
 * @param {{
 *   label?: string,
 *   activeCount?: number,
 *   onReset?: () => void,
 *   children: import('react').ReactNode,
 * }} props
 *   `activeCount` badges the trigger, so a reader can tell filters are applied
 *   without opening it — the one thing a popover loses against a visible rail.
 */
export function FilterPopover({ label = 'More filters', activeCount = 0, onReset, children }) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef(null)

  // Closes on an outside click or Escape, matching every other menu here.
  useEffect(() => {
    if (!isOpen) return undefined

    const onPointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) setIsOpen(false)
    }
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setIsOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [isOpen])

  return (
    <div ref={containerRef} className="relative">
      <Button
        variant={activeCount > 0 ? 'primary' : 'secondary'}
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        /*
         * `rounded-lg`, overriding the button's own control radius.
         *
         * This trigger sits in the filter row between a select and a search
         * field, both of which use `rounded-lg`. Matching its neighbours
         * matters more here than matching buttons in other rows, and the
         * two-pixel difference is visible when the corners line up side by
         * side. Tailwind emits `.rounded-lg` after the token rule, so the
         * override resolves deterministically rather than by luck.
         */
        className="rounded-lg"
      >
        <SlidersHorizontal className="size-4" aria-hidden="true" />
        {label}
        {activeCount > 0 ? ` (${activeCount})` : ''}
        <ChevronDown className="size-3 opacity-60" aria-hidden="true" />
      </Button>

      {isOpen && (
        /*
         * `right-0` rather than `left-0`: this trigger sits toward the end of
         * the filter row, and a panel opening rightward from there would run
         * off the page on a laptop.
         */
        <div className="absolute right-0 top-full z-30 mt-1.5 w-72 rounded-(--radius-card) border border-slate-200 bg-white shadow-dropdown">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3.5 py-2.5">
            <span className="text-xs font-semibold uppercase tracking-[0.06em] text-slate-500">
              {label}
            </span>
            {activeCount > 0 && onReset && (
              <button
                type="button"
                onClick={() => { onReset(); setIsOpen(false) }}
                className="rounded px-1.5 py-0.5 text-[11px] font-medium text-brand-700 transition-colors hover:bg-brand-50"
              >
                Reset filters
              </button>
            )}
          </div>

          <div className="max-h-[60vh] space-y-3 overflow-y-auto px-3.5 py-3">{children}</div>
        </div>
      )}
    </div>
  )
}

export default FilterPopover
