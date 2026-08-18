/**
 * Side-by-side comparison of two to four people (Phase 17.3).
 *
 * ## It does not declare a winner
 *
 * The best value in each row is marked, and that is all. Which metric matters
 * is a judgement about the job somebody is doing — a support specialist answering
 * quickly and sending little is not losing to a consultant who sends four
 * hundred emails — and the software has no way to make it. Marking each row and
 * leaving the reading to a person is the honest version of this screen.
 *
 * ## The marks come from the server
 *
 * `best` and `isDecisive` arrive on every field, including the one where a
 * smaller number wins. Recomputing them here would put a second copy of "lower
 * is better for response time" in the client, and that is exactly the kind of
 * rule that gets fixed in one place and not the other.
 */

import { useCallback, useMemo, useState } from 'react'
import { Trophy, X } from 'lucide-react'

import { AdminBadge } from '@/admin/components/AdminBadge'
import { AdminCard } from '@/admin/components/AdminCard'
import { AdminErrorState } from '@/admin/components/AdminErrorState'
import { AdminSelectField } from '@/admin/components/AdminField'
import { useAdminResource } from '@/admin/hooks/useAdminResource'
import { fetchPerformanceComparison } from '@/admin/services/admin.service'
import { EMPTY, formatCount, formatMinutes, formatPercent } from '@/admin/utils/format'
import { UserAvatar } from '@/components/common/UserAvatar'
import { Button } from '@/components/ui/Button'

/** How each unit is written. `min` gets the hours-and-minutes treatment. */
function formatValue(value, unit) {
  if (value === null || value === undefined) return EMPTY
  if (unit === '%') return formatPercent(value)
  if (unit === 'min') return formatMinutes(value)

  return formatCount(value)
}

/**
 * @param {{
 *   people: Array<{ id: string, displayName?: string, email?: string }>,
 *   range: object,
 * }} props
 */
export function PerformanceComparison({ people = [], range = {} }) {
  const [selected, setSelected] = useState([])
  const [pending, setPending] = useState('')

  const options = useMemo(
    () =>
      people
        .filter((person) => !selected.includes(person.id))
        .map((person) => ({ value: person.id, label: person.displayName ?? person.email })),
    [people, selected],
  )

  const byId = useMemo(() => new Map(people.map((person) => [person.id, person])), [people])

  const loader = useCallback(
    (options_) => fetchPerformanceComparison(selected, { ...options_, range }),
    [selected, range],
  )

  // Below two people there is nothing to compare, and the endpoint refuses it —
  // so the request is not made rather than made and rejected.
  const { data, error, isLoading, refresh } = useAdminResource(loader, {
    deps: [selected.join(','), range.preset, range.from, range.to],
    enabled: selected.length >= 2,
  })

  const add = (id) => {
    if (!id || selected.includes(id) || selected.length >= 4) return
    setSelected((previous) => [...previous, id])
    setPending('')
  }

  return (
    <AdminCard
      title="Compare people"
      description="Two to four at a time, over the period selected above. The best value in each row is marked; nothing is declared a winner."
      action={
        selected.length > 0 && (
          <Button size="sm" variant="secondary" onClick={() => setSelected([])}>
            Clear
          </Button>
        )
      }
    >
      <div className="flex flex-wrap items-end gap-3">
        {selected.map((id) => {
          const person = byId.get(id)

          return (
            <span
              key={id}
              className="inline-flex items-center gap-2 rounded-[--radius-control] border border-slate-200 bg-slate-50 py-1 pl-1.5 pr-1 text-sm"
            >
              <UserAvatar name={person?.displayName} email={person?.email} size="xs" />
              <span className="max-w-[10rem] truncate text-slate-700">
                {person?.displayName ?? person?.email ?? id}
              </span>
              <button
                type="button"
                onClick={() => setSelected((previous) => previous.filter((value) => value !== id))}
                aria-label={`Remove ${person?.displayName ?? person?.email ?? 'this person'} from the comparison`}
                className="grid size-5 place-items-center rounded text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700"
              >
                <X className="size-3" aria-hidden="true" />
              </button>
            </span>
          )
        })}

        {selected.length < 4 && (
          <div className="w-56">
            <AdminSelectField
              label={selected.length === 0 ? 'Choose people' : 'Add another'}
              value={pending}
              onChange={add}
              options={options}
              placeholder="Choose…"
            />
          </div>
        )}
      </div>

      {selected.length < 2 ? (
        <p className="mt-4 text-sm text-slate-500">
          Choose at least two people. One person is not a comparison.
        </p>
      ) : error ? (
        <div className="mt-4">
          <AdminErrorState error={error} onRetry={refresh} compact />
        </div>
      ) : isLoading || !data ? (
        <div className="mt-4 skeleton h-64" />
      ) : (
        <div className="scroll-x mt-4 overflow-x-auto">
          <table className="w-full min-w-[36rem] text-sm">
            <caption className="sr-only">
              Selected people compared across every measured metric
            </caption>
            <thead>
              <tr className="border-b border-slate-200">
                <th scope="col" className="pb-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  Metric
                </th>
                {data.people.map((person) => (
                  <th key={person.id} scope="col" className="pb-3 pl-4 text-right">
                    <span className="block truncate text-sm font-semibold text-slate-900">
                      {person.displayName ?? person.email}
                    </span>
                    <span className="mt-0.5 flex items-center justify-end gap-1.5">
                      <AdminBadge tone="neutral">#{person.rank}</AdminBadge>
                      <span className="text-xs font-normal text-slate-500">{person.score} pts</span>
                    </span>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody style={{ fontVariantNumeric: 'tabular-nums' }}>
              {data.fields.map((field) => (
                <tr key={field.key} className="border-b border-slate-100 last:border-0">
                  <th scope="row" className="py-2 text-left text-xs font-medium text-slate-500">
                    {field.label}
                    {field.higherIsBetter === false && (
                      <span className="ml-1 text-[11px] font-normal text-slate-400">
                        (lower is better)
                      </span>
                    )}
                  </th>

                  {data.people.map((person) => {
                    const value = person.metrics[field.key]
                    const isBest =
                      field.isDecisive && value !== null && value !== undefined && value === field.best

                    return (
                      <td
                        key={person.id}
                        className={`py-2 pl-4 text-right ${isBest ? 'font-semibold text-slate-900' : 'text-slate-700'}`}
                      >
                        <span className="inline-flex items-center justify-end gap-1.5">
                          {isBest && <Trophy className="size-3 text-amber-500" aria-label="Best" />}
                          {formatValue(value, field.unit)}
                        </span>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          {data.missing?.length > 0 && (
            <p className="mt-3 text-xs text-slate-500">
              {data.missing.length} selected {data.missing.length === 1 ? 'person' : 'people'} could
              not be found and {data.missing.length === 1 ? 'was' : 'were'} left out.
            </p>
          )}
        </div>
      )}
    </AdminCard>
  )
}

export default PerformanceComparison
