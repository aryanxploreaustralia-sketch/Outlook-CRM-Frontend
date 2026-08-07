/**
 * User avatar.
 *
 * Microsoft Graph can serve a photo from `/me/photo/$value`, but that endpoint
 * requires an authenticated request and returns binary — it cannot be dropped
 * into an `<img src>`. Until a proxy route exists (a later phase), initials are
 * the honest representation, so this component renders them deterministically
 * rather than showing a broken image.
 *
 * The colour is derived from the user's identity, so the same person always gets
 * the same avatar colour across sessions and devices.
 */

/**
 * Palette chosen for legibility of white text at every entry.
 */
const PALETTE = [
  'bg-brand-600',
  'bg-emerald-600',
  'bg-violet-600',
  'bg-amber-600',
  'bg-rose-600',
  'bg-cyan-700',
  'bg-indigo-600',
  'bg-teal-600',
]

const SIZES = {
  xs: 'size-7 text-[11px]',
  sm: 'size-8 text-xs',
  md: 'size-10 text-sm',
  lg: 'size-14 text-lg',
  xl: 'size-16 text-xl',
}

/**
 * Stable hash → palette index.
 *
 * A simple sum of char codes is sufficient: the goal is a consistent colour per
 * user, not uniform distribution or any security property.
 */
function pickColour(seed) {
  if (!seed) return PALETTE[0]

  let total = 0
  for (let index = 0; index < seed.length; index += 1) {
    total += seed.charCodeAt(index)
  }

  return PALETTE[total % PALETTE.length]
}

/** Client-side fallback when the server did not supply initials. */
function deriveInitials(name, email) {
  const source = (name ?? '').trim() || (email ?? '').split('@')[0] || ''
  const words = source.split(/[\s._-]+/).filter(Boolean)

  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()

  return (words[0][0] + words[words.length - 1][0]).toUpperCase()
}

/**
 * @param {{
 *   name?: ?string,
 *   email?: ?string,
 *   initials?: ?string,
 *   size?: keyof typeof SIZES,
 *   className?: string,
 * }} props
 */
export function UserAvatar({ name, email, initials, size = 'md', className = '' }) {
  const text = initials?.trim() || deriveInitials(name, email)
  const colour = pickColour(email ?? name ?? '')

  return (
    <span
      className={`grid shrink-0 place-items-center rounded-full font-semibold text-white select-none ${colour} ${
        SIZES[size] ?? SIZES.md
      } ${className}`}
      // The adjacent name is the accessible label in every current usage, so the
      // avatar itself is decorative and must not be announced twice.
      aria-hidden="true"
    >
      {text}
    </span>
  )
}

export default UserAvatar
