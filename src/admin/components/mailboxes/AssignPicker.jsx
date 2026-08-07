/**
 * A searchable multi-select over people or mailboxes.
 *
 * One component for both directions of the relationship, because they are the
 * same interaction: search a list, tick some rows, save the set. Forking it into
 * `AssignUsersPicker` and `AssignMailboxesPicker` would be two implementations
 * of one behaviour that then drift on keyboard handling and empty states.
 *
 * ## Set semantics, deliberately
 *
 * The value is the complete selection, not a list of changes. Both endpoints
 * behind it accept a set for the same reason: a client that submits an add-list
 * and a remove-list can leave the two inconsistent, and the server then has to
 * decide which one it believes.
 *
 * ## Rows that cannot be deselected
 *
 * `lockedIds` marks entries the caller may see but not change — a mailbox's
 * connector, whose access comes from the OAuth grant. Rendering them as
 * disabled rather than hiding them is the right call here, unlike navigation:
 * their presence explains why the count is higher than the number of ticks.
 */

import { useMemo, useState } from 'react'
import { Check, Lock, Search } from 'lucide-react'

/**
 * @param {{
 *   options: Array<{ id: string, primary: string, secondary?: string,
 *                    disabled?: boolean, disabledReason?: string,
 *                    leading?: import('react').ReactNode }>,
 *   value: string[],
 *   onChange: (next: string[]) => void,
 *   lockedIds?: string[],
 *   searchPlaceholder?: string,
 *   emptyMessage?: string,
 *   maxHeight?: string,
 * }} props
 */
export function AssignPicker({
  options,
  value,
  onChange,
  lockedIds = [],
  searchPlaceholder = 'Search…',
  emptyMessage = 'Nothing to choose from.',
  maxHeight = 'max-h-72',
}) {
  const [term, setTerm] = useState('')

  const selected = useMemo(() => new Set(value), [value])
  const locked = useMemo(() => new Set(lockedIds), [lockedIds])

  /**
   * Filtered in the browser, and correctly so.
   *
   * The list is one deployment's mailboxes or one page of users — already in
   * hand, already bounded. A round trip per keystroke would be slower and would
   * make ticking a row race with the refetch that replaces it.
   */
  const visible = useMemo(() => {
    const needle = term.trim().toLowerCase()
    if (!needle) return options

    return options.filter(
      (option) =>
        option.primary.toLowerCase().includes(needle) ||
        (option.secondary ?? '').toLowerCase().includes(needle),
    )
  }, [options, term])

  const toggle = (id) => {
    if (locked.has(id)) return

    const next = new Set(selected)

    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }

    onChange([...next])
  }

  return (
    <div>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
          aria-hidden="true"
        />
        <input
          type="search"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
        />
      </div>

      <p className="mt-2 text-xs text-slate-500" aria-live="polite">
        {selected.size} selected
        {locked.size > 0 && ` · ${locked.size} always has access`}
      </p>

      {visible.length === 0 ? (
        <p className="mt-3 rounded-lg bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">
          {term ? 'Nothing matches that search.' : emptyMessage}
        </p>
      ) : (
        <ul className={`mt-2 space-y-1 overflow-y-auto ${maxHeight}`} role="group">
          {visible.map((option) => {
            const isLocked = locked.has(option.id)
            const isChecked = isLocked || selected.has(option.id)
            const isDisabled = isLocked || option.disabled

            return (
              <li key={option.id}>
                {/*
                  A real checkbox, visually hidden rather than replaced by a
                  clickable div: it keeps the label association, the space-bar
                  behaviour and the announced checked state that a div discards.
                */}
                <label
                  className={`flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors ${
                    isDisabled
                      ? 'cursor-not-allowed border-slate-200 bg-slate-50'
                      : isChecked
                        ? 'cursor-pointer border-brand-300 bg-brand-50/60'
                        : 'cursor-pointer border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    disabled={isDisabled}
                    onChange={() => toggle(option.id)}
                    className="sr-only"
                  />

                  <span
                    className={`grid size-4 shrink-0 place-items-center rounded border ${
                      isChecked ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white'
                    }`}
                    aria-hidden="true"
                  >
                    {isChecked && <Check className="size-3" strokeWidth={3} />}
                  </span>

                  {option.leading}

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-800">
                      {option.primary}
                    </span>
                    {option.secondary && (
                      <span className="block truncate text-xs text-slate-500">
                        {option.secondary}
                      </span>
                    )}
                  </span>

                  {isLocked ? (
                    <span
                      className="flex shrink-0 items-center gap-1 text-[11px] text-slate-400"
                      title="Connected this mailbox — access cannot be removed"
                    >
                      <Lock className="size-3" aria-hidden="true" />
                      Owner
                    </span>
                  ) : option.disabled && option.disabledReason ? (
                    <span className="shrink-0 text-[11px] text-slate-400">
                      {option.disabledReason}
                    </span>
                  ) : null}
                </label>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default AssignPicker
