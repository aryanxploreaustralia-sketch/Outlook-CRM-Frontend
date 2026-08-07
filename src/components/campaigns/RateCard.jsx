/**
 * One headline percentage or count.
 *
 * Renders an em dash rather than 0% when the value is null. The distinction
 * matters: a campaign that has sent nothing has no delivery rate, and showing
 * "0%" reads as total failure.
 */

/**
 * @param {{ label: string, value: ?number, suffix?: string, hint?: string,
 *           tone?: 'neutral'|'positive'|'negative' }} props
 */
export function RateCard({ label, value, suffix = '', hint = null, tone = 'neutral' }) {
  const toneClass = {
    neutral: 'text-slate-900',
    positive: 'text-emerald-600',
    negative: 'text-rose-600',
  }[tone]

  const display = value === null || value === undefined ? '—' : `${value.toLocaleString()}${suffix}`

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${toneClass}`}>{display}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  )
}

export default RateCard
