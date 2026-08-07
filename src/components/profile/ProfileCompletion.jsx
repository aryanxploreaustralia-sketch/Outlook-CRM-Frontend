/**
 * Profile completion, as a ring plus the list of what is missing.
 *
 * ## The ring alone would be useless
 *
 * "78%" tells somebody they are incomplete and nothing about what to do. The
 * value of this widget is entirely in the list underneath — the percentage is
 * the hook that makes them read it. So the missing fields are always shown, not
 * hidden behind a disclosure.
 *
 * ## Both numbers come from the server
 *
 * `percentage` and `missing` are computed by `profileCompletion()` on every
 * read. Recomputing them here from the form state would put a second definition
 * of "complete" in the client, and the two would disagree the moment a field is
 * added.
 *
 * ## SVG rather than a library
 *
 * Two circles and a `stroke-dasharray`. A charting dependency to draw one arc
 * would be the wrong trade, and the ring animates with the same easing token as
 * everything else.
 */

import { Check } from 'lucide-react'

/** Geometry. `r` is chosen so the stroke sits inside a 96px box without clipping. */
const SIZE = 96
const STROKE = 8
const RADIUS = (SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/**
 * @param {{
 *   completion?: { percentage: number, completed: number, total: number, missing: object[] },
 *   isLoading?: boolean,
 * }} props
 */
export function ProfileCompletion({ completion, isLoading = false }) {
  if (isLoading || !completion) {
    return (
      <div className="flex items-center gap-5">
        <div className="skeleton size-24 rounded-full" />
        <div className="flex-1 space-y-2">
          <div className="skeleton h-4 w-32" />
          <div className="skeleton h-3 w-48" />
        </div>
      </div>
    )
  }

  const { percentage, completed, total, missing } = completion
  const isComplete = percentage === 100

  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
      {/* --- The ring ---------------------------------------------------- */}
      <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
        <svg
          width={SIZE}
          height={SIZE}
          // Rotated so the arc starts at twelve o'clock rather than three.
          className="-rotate-90"
          role="img"
          aria-label={`Profile ${percentage}% complete, ${completed} of ${total} fields`}
        >
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            strokeWidth={STROKE}
            className="stroke-slate-100"
          />
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - percentage / 100)}
            className={`transition-[stroke-dashoffset] duration-[--duration-slow] ${
              isComplete ? 'stroke-emerald-500' : 'stroke-brand-600'
            }`}
            style={{ transitionTimingFunction: 'var(--ease-out-quint)' }}
          />
        </svg>

        <span className="absolute inset-0 grid place-items-center">
          <span className="metric-figure text-xl font-semibold text-slate-900">{percentage}%</span>
        </span>
      </div>

      {/* --- What is missing ---------------------------------------------- */}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900">
          {isComplete ? 'Your profile is complete' : 'Complete your profile'}
        </p>
        <p className="mt-0.5 text-sm text-slate-500">
          {completed} of {total} details provided.
        </p>

        {isComplete ? (
          <p className="mt-3 flex items-center gap-1.5 text-sm text-emerald-700">
            <Check className="size-4" aria-hidden="true" />
            Nothing left to add.
          </p>
        ) : (
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {missing.map((field) => (
              <li
                key={field.key}
                className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600"
              >
                {field.label}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export default ProfileCompletion
