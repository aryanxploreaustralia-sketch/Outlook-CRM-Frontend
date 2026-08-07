/**
 * The performance score, drawn so it can be argued with.
 *
 * A single number attached to a named person is the most contestable thing on
 * this console. Drawn as a bare figure it is an opinion the software refuses to
 * justify. So the meter carries its own decomposition: every factor, the value
 * that went in, the target it was measured against, and the points it
 * contributed. The parts sum to the whole, visibly.
 *
 * The bar is a magnitude, not a rating: no red/amber/green. A traffic light
 * makes the console assert that 58 is "bad", which is a judgement about a
 * workload it has no way to know — a support specialist with few sends is not
 * failing at anything.
 */

import { Info } from 'lucide-react'
import { useId, useState } from 'react'

const number = (value) =>
  typeof value === 'number' ? value.toLocaleString(undefined, { maximumFractionDigits: 1 }) : '—'

/**
 * @param {{
 *   score: number,
 *   components?: Array<{ key: string, label: string, value: number, target: number,
 *                        weight: number, points: number }>,
 *   recency?: ?number,
 *   compact?: boolean,
 * }} props
 */
export function AdminScoreMeter({ score, components = [], recency, compact = false }) {
  const [isOpen, setIsOpen] = useState(false)
  const panelId = useId()

  const width = Math.max(0, Math.min(100, Number(score) || 0))

  return (
    <div className={compact ? 'min-w-[9rem]' : ''}>
      <div className="flex items-center gap-2">
        <div
          className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200"
          role="img"
          aria-label={`Performance score ${width} out of 100`}
        >
          <div className="h-full rounded-full bg-brand-600" style={{ width: `${width}%` }} />
        </div>

        <span
          className="w-10 shrink-0 text-right text-sm font-semibold text-slate-800"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {number(score)}
        </span>

        {components.length > 0 && (
          <button
            type="button"
            onClick={(event) => {
              // The row underneath is a link to the person's dashboard. Without
              // this, asking how the score was built navigates away from it.
              event.stopPropagation()
              setIsOpen((previous) => !previous)
            }}
            aria-expanded={isOpen}
            aria-controls={panelId}
            className="shrink-0 rounded p-0.5 text-slate-400 transition-colors hover:text-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          >
            <Info className="size-3.5" aria-hidden="true" />
            <span className="sr-only">How this score was calculated</span>
          </button>
        )}
      </div>

      {isOpen && (
        <div
          id={panelId}
          className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5"
          onClick={(event) => event.stopPropagation()}
        >
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-500">
                <th scope="col" className="pb-1 text-left font-medium">Factor</th>
                <th scope="col" className="pb-1 text-right font-medium">Actual</th>
                <th scope="col" className="pb-1 text-right font-medium">Target</th>
                <th scope="col" className="pb-1 text-right font-medium">Points</th>
              </tr>
            </thead>
            <tbody style={{ fontVariantNumeric: 'tabular-nums' }}>
              {components.map((component) => (
                <tr key={component.key} className="border-t border-slate-200">
                  <td className="py-1 pr-2 text-left text-slate-700">{component.label}</td>
                  <td className="py-1 text-right text-slate-700">{number(component.value)}</td>
                  <td className="py-1 text-right text-slate-400">{number(component.target)}</td>
                  <td className="py-1 text-right font-medium text-slate-800">
                    {number(component.points)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {typeof recency === 'number' && recency < 1 && (
            <p className="mt-2 border-t border-slate-200 pt-2 text-xs text-slate-500">
              Reduced to {Math.round(recency * 100)}% for time since last activity.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export default AdminScoreMeter
