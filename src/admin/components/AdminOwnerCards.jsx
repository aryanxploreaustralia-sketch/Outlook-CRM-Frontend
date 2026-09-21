/**
 * The owner selector, as cards.
 *
 * A visual shortcut for the Lead monitor's existing `owner` filter — the one
 * that lives in the URL and that the table, the counts and the pagination all
 * already read. Clicking a card calls the page's own `setFilters({ owner })`;
 * this component holds no filter state and fetches no leads.
 *
 * ## Where the counts come from
 *
 * `meta.owners` carries `{ value, label }` and no totals, so each card's number
 * is read from the register endpoint the page already uses: one
 * `fetchAdminLeads` per owner with `limit: 1`, taking `summary.total` and
 * discarding the row. That is the same server-side count the KPI strip shows,
 * so a card can never disagree with the table it filters.
 *
 * Three things keep that honest rather than chatty:
 *
 *  1. **Every other filter is applied.** The counts answer "how many would I
 *     see if I clicked this", not "how many exist" — a card reading 843 beside
 *     a table showing 12 would be worse than no card at all.
 *  2. **Cached per filter set.** Results are keyed by the filters they were
 *     counted under, so paging, sorting, re-selecting an owner and returning to
 *     a previous filter combination all read memory and issue nothing.
 *  3. **Superseded requests are aborted**, so changing filters quickly leaves
 *     one set of counts in flight rather than several.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, Users } from 'lucide-react'

import { fetchAdminLeads } from '@/admin/services/admin.service'
import { formatCount } from '@/admin/utils/format'

/** Cards shown before "More owners" is offered. */
const COLLAPSED_LIMIT = 7

/** The key an "everybody" card is stored and selected under. */
const ALL = ''

/** "Mukesh Patel" -> "MP". Falls back to one letter, then to a dash. */
function initialsOf(label) {
  const words = String(label ?? '').trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '—'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words.at(-1)[0]).toUpperCase()
}

/**
 * @param {{
 *   owners: Array<{ value: string, label: string }>,
 *   value: string,
 *   onSelect: (ownerValue: string) => void,
 *   countParams: object,  The page's current filters, without `owner`.
 *   isLoading?: boolean,
 * }} props
 */
export function AdminOwnerCards({ owners = [], value = ALL, onSelect, countParams = {}, isLoading = false }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [counts, setCounts] = useState({})
  const [isCounting, setIsCounting] = useState(false)

  /** Counted results, keyed by `filters|owner`, kept for the page's lifetime. */
  const cacheRef = useRef(new Map())

  // Stable identity for "the filters these counts were taken under". Page,
  // limit and sort are deliberately excluded — they cannot change a total.
  const countKey = useMemo(() => JSON.stringify(countParams), [countParams])
  const ownerKey = useMemo(() => owners.map((owner) => owner.value).join(','), [owners])

  useEffect(() => {
    if (owners.length === 0) return undefined

    const ids = [ALL, ...owners.map((owner) => owner.value)]
    const cache = cacheRef.current
    const cached = {}
    const missing = []

    for (const id of ids) {
      const key = `${countKey}|${id}`
      if (cache.has(key)) cached[id] = cache.get(key)
      else missing.push(id)
    }

    setCounts(cached)
    if (missing.length === 0) return undefined

    const controller = new AbortController()
    setIsCounting(true)

    Promise.all(
      missing.map(async (id) => {
        try {
          /*
           * The page's own loader, with `limit: 1`: the register is not being
           * listed here, only counted, and `summary.total` is computed over the
           * whole filter rather than the returned page.
           */
          const response = await fetchAdminLeads({
            ...countParams,
            owner: id,
            page: 1,
            limit: 1,
            signal: controller.signal,
          })
          return [id, response?.summary?.total ?? null]
        } catch {
          // A failed or aborted count leaves that card without a number. It
          // still selects its owner, which is what the card is for.
          return [id, null]
        }
      }),
    ).then((entries) => {
      if (controller.signal.aborted) return

      for (const [id, total] of entries) {
        if (total !== null) cache.set(`${countKey}|${id}`, total)
      }

      setCounts((current) => ({ ...current, ...Object.fromEntries(entries) }))
      setIsCounting(false)
    })

    return () => {
      controller.abort()
      setIsCounting(false)
    }
    // `countParams` is represented by `countKey`; including the object itself
    // would re-run this on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countKey, ownerKey])

  if (owners.length === 0 && !isLoading) return null

  const cards = [{ value: ALL, label: 'All owners' }, ...owners]
  const visible = isExpanded ? cards : cards.slice(0, COLLAPSED_LIMIT + 1)
  const hiddenCount = cards.length - visible.length

  return (
    <section aria-label="Filter by owner" className="rounded-(--radius-card) border border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-2 px-3 pb-1.5 pt-2.5">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">Owners</h2>

        {(hiddenCount > 0 || isExpanded) && (
          <button
            type="button"
            onClick={() => setIsExpanded((open) => !open)}
            className="inline-flex items-center gap-1 rounded-(--radius-control) px-2 py-1 text-xs font-medium text-brand-700 transition-colors hover:bg-brand-50"
            aria-expanded={isExpanded}
          >
            {isExpanded ? 'Show fewer' : `More owners (${hiddenCount})`}
            <ChevronDown
              className={`size-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
          </button>
        )}
      </div>

      {/*
        One row that scrolls horizontally when collapsed, and wraps when
        expanded. Both keep the page itself free of horizontal overflow.
      */}
      <div
        className={`px-3 pb-2.5 ${
          isExpanded ? 'flex flex-wrap gap-2' : 'flex gap-2 overflow-x-auto pb-3 [scrollbar-width:thin]'
        }`}
      >
        {visible.map((owner) => {
          const isSelected = (owner.value || ALL) === (value || ALL)
          const total = counts[owner.value || ALL]

          return (
            <button
              key={owner.value || 'all'}
              type="button"
              onClick={() => onSelect(owner.value)}
              aria-pressed={isSelected}
              title={owner.label}
              className={`group relative flex min-w-36 shrink-0 items-center gap-2 rounded-(--radius-control) border px-2.5 py-2 text-left transition-colors ${
                isSelected
                  ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500'
                  : 'border-slate-200 bg-white hover:border-brand-300 hover:bg-brand-50/40'
              }`}
            >
              <span
                className={`grid size-8 shrink-0 place-items-center rounded-full text-[11px] font-semibold ${
                  isSelected ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'
                }`}
                aria-hidden="true"
              >
                {owner.value === ALL ? <Users className="size-4" /> : initialsOf(owner.label)}
              </span>

              <span className="min-w-0 flex-1">
                <span
                  className={`block truncate text-[13px] font-medium ${
                    isSelected ? 'text-brand-900' : 'text-slate-800'
                  }`}
                >
                  {owner.label}
                </span>
                <span className="mt-0.5 block text-[11px] text-slate-500">
                  {total === undefined || total === null ? (
                    isCounting ? <span className="skeleton block h-3 w-12" /> : '—'
                  ) : (
                    `${formatCount(total)} lead${total === 1 ? '' : 's'}`
                  )}
                </span>
              </span>

              {isSelected && (
                <Check className="size-4 shrink-0 text-brand-600" aria-hidden="true" />
              )}
            </button>
          )
        })}
      </div>
    </section>
  )
}

export default AdminOwnerCards
