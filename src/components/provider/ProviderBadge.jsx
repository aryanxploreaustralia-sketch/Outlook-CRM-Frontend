/**
 * Status pills for connection and sync state.
 *
 * Two small components rather than one generic badge with a `kind` prop: the
 * vocabularies are genuinely different, and a shared one would need a lookup
 * keyed on both, which is harder to read than two five-line components.
 *
 * Both follow the same accessibility rule as the rest of the product — colour is
 * never the only signal, so every badge carries a text label.
 */

import { CONNECTION_VARIANTS, SYNC_VARIANTS } from '@/constants/provider.constants'

const SIZES = {
  sm: 'px-2 py-0.5 text-[11px] gap-1',
  md: 'px-2.5 py-1 text-xs gap-1.5',
}

function Pill({ variant, size, className }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full font-medium ring-1 ring-inset ${
        SIZES[size] ?? SIZES.md
      } ${variant.className} ${className}`}
    >
      <span className={`size-1.5 shrink-0 rounded-full ${variant.dot}`} aria-hidden="true" />
      {variant.label}
    </span>
  )
}

/**
 * @param {{ status?: string, size?: keyof typeof SIZES, className?: string }} props
 *   An unrecognised status falls back to the neutral treatment rather than
 *   rendering nothing, so a new server-side state cannot blank out the card.
 */
export function ConnectionBadge({ status, size = 'md', className = '' }) {
  const variant = CONNECTION_VARIANTS[status] ?? CONNECTION_VARIANTS.disconnected
  return <Pill variant={variant} size={size} className={className} />
}

/** @param {{ status?: string, size?: keyof typeof SIZES, className?: string }} props */
export function SyncBadge({ status, size = 'md', className = '' }) {
  const variant = SYNC_VARIANTS[status] ?? SYNC_VARIANTS.idle
  return <Pill variant={variant} size={size} className={className} />
}

export default ConnectionBadge
