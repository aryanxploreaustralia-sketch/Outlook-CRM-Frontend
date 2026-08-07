/**
 * Status pill for a campaign or a recipient.
 *
 * One component for both because the visual grammar is identical and a second
 * copy would drift. `kind` picks the palette.
 */

import { CAMPAIGN_STATUS_STYLES, RECIPIENT_STATUS_STYLES } from '@/constants/campaign.constants'

/** @param {{ status: string, kind?: 'campaign'|'recipient' }} props */
export function CampaignStatusBadge({ status, kind = 'campaign' }) {
  const styles = kind === 'recipient' ? RECIPIENT_STATUS_STYLES : CAMPAIGN_STATUS_STYLES
  // Falls back to the raw value rather than rendering nothing: an unrecognised
  // status means the server knows something this build does not, and hiding it
  // would be worse than showing it unstyled.
  const style = styles[status] ?? { label: status, className: 'bg-slate-100 text-slate-700 ring-slate-200' }

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${style.className}`}
    >
      {style.label}
    </span>
  )
}

export default CampaignStatusBadge
