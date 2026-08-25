/**
 * The left filter rail, and the drawer it becomes on a narrow screen.
 *
 * ## It owns no filter state
 *
 * Deliberately. Every control inside it is passed in as `children` and stays
 * wired to the page's own `useState` and `onChange` — the same state, the same
 * handlers, the same query parameters, the same requests. This component is a
 * container: it decides where a control sits and whether its group is open, and
 * nothing else. A filter panel that held its own copy of the filters would be a
 * second filtering system, and the two would disagree the first time somebody
 * cleared one from a chip.
 *
 * The only state here is which groups are collapsed, which is a fact about the
 * furniture rather than about the data.
 *
 * ## Why a rail rather than a toolbar
 *
 * Filters laid across the top push the table down and compete with the actions
 * beside them. In a rail they read as one list, the table keeps the full height
 * of the screen, and a group nobody uses can be folded away rather than
 * removed.
 */

import { useState } from 'react'
import { ChevronDown, SlidersHorizontal, X } from 'lucide-react'

import { Button } from '@/components/ui/Button'

/**
 * One collapsible group.
 *
 * The heading is a real `<button>` with `aria-expanded`, so the group can be
 * opened from the keyboard and a screen reader is told what it did.
 */
function FilterGroup({ title, isOpen, onToggle, children }) {
  return (
    <section className="border-b border-slate-100 last:border-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500 transition-colors hover:text-slate-700"
      >
        {title}
        <ChevronDown
          className={`size-3.5 shrink-0 transition-transform duration-(--duration-fast) ${isOpen ? '' : '-rotate-90'}`}
          aria-hidden="true"
        />
      </button>

      {/* Unmounted rather than hidden: a collapsed group's selects should not
          be reachable by Tab, which is what makes collapsing worth anything. */}
      {isOpen && <div className="space-y-2.5 px-4 pb-3.5">{children}</div>}
    </section>
  )
}

/**
 * @param {{
 *   isOpen: boolean,
 *   onClose: () => void,
 *   groups: Array<{ id: string, title: string, content: import('react').ReactNode }>,
 *   chips?: Array<{ key: string, label: string, onClear: () => void }>,
 *   activeCount?: number,
 *   onClearAll?: () => void,
 *   variant?: 'rail' | 'drawer',
 *   className?: string,
 * }} props
 *   `rail` — the default — is a permanent column from `lg` up that becomes a
 *   drawer below it, for a screen whose filters are its main tool. `drawer`
 *   never shows the column: it is for a page that keeps its everyday filters on
 *   a bar and holds only the secondary ones back, where a permanent second
 *   column of them would be the clutter it was meant to remove.
 */
export function FilterPanel({
  isOpen,
  onClose,
  groups,
  chips = [],
  activeCount = 0,
  onClearAll,
  variant = 'rail',
  className = '',
}) {
  // Every group starts open. Collapsing is an escape hatch, not the default:
  // a panel that opens closed hides the filters somebody came here to use.
  const [collapsed, setCollapsed] = useState(() => new Set())

  const toggle = (id) =>
    setCollapsed((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const body = (
    <>
      <header className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <SlidersHorizontal className="size-4 text-slate-400" aria-hidden="true" />
          Filters
          {activeCount > 0 && (
            <span className="rounded-full bg-brand-50 px-1.5 py-0.5 text-[11px] font-semibold text-brand-700">
              {activeCount}
            </span>
          )}
        </span>

        {/* Closes the drawer. Hidden on the desktop rail, which has nothing to
            close — the button there would do nothing a reader could predict. */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close filters"
          className={`rounded-(--radius-control) p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 ${variant === 'rail' ? 'lg:hidden' : ''}`}
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </header>

      {chips.length > 0 && (
        <div className="border-b border-slate-100 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">Active</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {chips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={chip.onClear}
                className="inline-flex max-w-full items-center gap-1 rounded-(--radius-control) bg-slate-100 py-1 pl-2 pr-1.5 text-xs text-slate-700 transition-colors hover:bg-slate-200"
              >
                <span className="truncate">{chip.label}</span>
                <X className="size-3 shrink-0 text-slate-500" aria-hidden="true" />
              </button>
            ))}
          </div>

          {onClearAll && (
            <Button variant="ghost" size="sm" onClick={onClearAll} className="mt-2 -ml-2">
              Clear all
            </Button>
          )}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {groups.map((group) => (
          <FilterGroup
            key={group.id}
            title={group.title}
            isOpen={!collapsed.has(group.id)}
            onToggle={() => toggle(group.id)}
          >
            {group.content}
          </FilterGroup>
        ))}
      </div>
    </>
  )

  return (
    <>
      {/* --- The rail, from `lg` up ---------------------------------------- */}
      {variant === 'rail' && (
        <aside
          className={`hidden w-64 shrink-0 flex-col self-start rounded-(--radius-card) border border-slate-200 bg-white lg:flex ${className}`}
        >
          {body}
        </aside>
      )}

      {/*
        The drawer.

        For a rail it is the narrow-screen form of the same column, so it hides
        itself once the rail appears. For `drawer` it is the only form there is,
        and must open at every width.
      */}
      {isOpen && (
        <div className={`fixed inset-0 z-40 ${variant === 'rail' ? 'lg:hidden' : ''}`}>
          <div
            className="absolute inset-0 bg-slate-900/40"
            onClick={onClose}
            aria-hidden="true"
          />
          <div className="absolute inset-y-0 right-0 flex w-[min(22rem,90vw)] flex-col bg-white shadow-dropdown">
            {body}
          </div>
        </div>
      )}
    </>
  )
}

export default FilterPanel
