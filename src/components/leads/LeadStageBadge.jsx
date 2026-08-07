/**
 * Pipeline stage pill.
 *
 * Optionally marks a stage that campaigns cannot target, because "why is this
 * lead not in my audience?" is otherwise an invisible rule.
 */

import { LEAD_STAGE_STYLES } from '@/constants/lead.constants'

/** @param {{ stage: string, showEligibility?: boolean, eligible?: boolean }} props */
export function LeadStageBadge({ stage, showEligibility = false, eligible = undefined }) {
  // Falls back to the raw value rather than rendering nothing: an unrecognised
  // stage means the server knows something this build does not.
  const style = LEAD_STAGE_STYLES[stage] ?? {
    label: stage,
    className: 'bg-slate-100 text-slate-700 ring-slate-200',
  }

  return (
    <span className="inline-flex items-center gap-1">
      <span
        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${style.className}`}
      >
        {style.label}
      </span>
      {showEligibility && eligible === false && (
        <span className="text-xs text-slate-400" title="Campaigns cannot target this stage">
          no mail
        </span>
      )}
    </span>
  )
}

export default LeadStageBadge
