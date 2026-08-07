/**
 * Status pill for a mail record.
 *
 * Mirrors `StatusBadge`'s treatment — colour plus a text label, never colour
 * alone — but draws from the mail status vocabulary. See
 * `mail.constants.js` for why the two keyspaces are kept apart.
 */

import { MAIL_STATUS, MAIL_STATUS_VARIANTS } from '@/constants/mail.constants'

const SIZES = {
  sm: 'px-2 py-0.5 text-[11px] gap-1',
  md: 'px-2.5 py-1 text-xs gap-1.5',
}

/**
 * @param {{ status?: string, label?: string, size?: keyof typeof SIZES, className?: string }} props
 *   An unrecognised status falls back to the neutral draft treatment rather than
 *   rendering nothing, so a new server-side status cannot blank out a row.
 */
export function MailStatusBadge({ status, label, size = 'md', className = '' }) {
  const variant = MAIL_STATUS_VARIANTS[status] ?? MAIL_STATUS_VARIANTS[MAIL_STATUS.DRAFT]

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full font-medium ring-1 ring-inset ${
        SIZES[size] ?? SIZES.md
      } ${variant.className} ${className}`}
    >
      <span className={`size-1.5 shrink-0 rounded-full ${variant.dot}`} aria-hidden="true" />
      {label ?? variant.label}
    </span>
  )
}

export default MailStatusBadge
