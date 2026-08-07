/**
 * Indeterminate loading spinner.
 *
 * `role="status"` with a visually hidden label means a screen reader announces
 * that something is loading. A bare spinning icon communicates nothing to a
 * non-sighted user.
 */

const SIZES = {
  xs: 'size-3 border',
  sm: 'size-4 border-2',
  md: 'size-6 border-2',
  lg: 'size-8 border-[3px]',
}

/**
 * @param {{
 *   size?: keyof typeof SIZES,
 *   className?: string,
 *   label?: string,
 *   tone?: 'brand' | 'light' | 'muted',
 * }} props
 */
export function Spinner({ size = 'md', className = '', label = 'Loading', tone = 'brand' }) {
  const tones = {
    brand: 'border-brand-200 border-t-brand-600',
    light: 'border-white/30 border-t-white',
    muted: 'border-slate-200 border-t-slate-500',
  }

  return (
    <span role="status" className={`inline-flex items-center ${className}`}>
      <span
        className={`animate-spin rounded-full ${SIZES[size]} ${tones[tone]}`}
        aria-hidden="true"
      />
      <span className="sr-only">{label}</span>
    </span>
  )
}

export default Spinner
