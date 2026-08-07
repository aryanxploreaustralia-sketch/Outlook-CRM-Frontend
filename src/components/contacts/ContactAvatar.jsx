/**
 * Contact avatar — photo when one exists, deterministic initials otherwise.
 *
 * The colour is derived from the contact's own identity rather than its position
 * in a list, so a person keeps the same avatar across pages, sorts and sessions.
 * A position-based colour would make the same contact look different depending
 * on how the list was ordered, which is quietly disorienting.
 */

import { avatarTone, initialsOf } from '@/constants/contact.constants'

const SIZES = {
  sm: 'size-8 text-xs',
  md: 'size-10 text-sm',
  lg: 'size-16 text-lg',
  xl: 'size-24 text-2xl',
}

/**
 * @param {{ contact: object, size?: keyof typeof SIZES, className?: string }} props
 */
export function ContactAvatar({ contact, size = 'md', className = '' }) {
  const dimension = SIZES[size] ?? SIZES.md
  const seed = contact?.id ?? contact?.primaryEmail ?? contact?.displayName ?? ''

  if (contact?.photo?.contentBytes) {
    return (
      <img
        src={`data:${contact.photo.contentType};base64,${contact.photo.contentBytes}`}
        alt=""
        className={`${dimension} shrink-0 rounded-full object-cover ${className}`}
      />
    )
  }

  return (
    <span
      className={`grid shrink-0 place-items-center rounded-full font-semibold ${dimension} ${avatarTone(seed)} ${className}`}
      // Decorative: the name is always rendered beside it, so announcing the
      // initials again would just repeat it for screen-reader users.
      aria-hidden="true"
    >
      {initialsOf(contact)}
    </span>
  )
}

export default ContactAvatar
