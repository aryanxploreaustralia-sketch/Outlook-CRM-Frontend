/**
 * One contact, in either grid or list form.
 *
 * A single component covering both layouts rather than two: they show the same
 * fields with the same affordances — select, favourite, open — and keeping them
 * together is what stops the two views drifting apart as fields are added.
 */

import { Link } from 'react-router-dom'
import { Building2, Mail, Phone, Star } from 'lucide-react'

import { ContactAvatar } from '@/components/contacts/ContactAvatar'
import { CATEGORY_TONES, SOURCE_VARIANTS } from '@/constants/contact.constants'
import { ROUTE_PATHS } from '@/routes/paths'

/** Small pill used for source and category. */
function Tag({ tone, children }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset ${tone}`}
    >
      {children}
    </span>
  )
}

/**
 * @param {{
 *   contact: object,
 *   view?: 'grid' | 'list',
 *   selected?: boolean,
 *   onSelect?: (id: string, next: boolean) => void,
 *   onToggleFavorite?: (contact: object) => void,
 * }} props
 */
export function ContactCard({ contact, view = 'list', selected = false, onSelect, onToggleFavorite }) {
  const source = SOURCE_VARIANTS[contact.source] ?? SOURCE_VARIANTS.crm
  const to = ROUTE_PATHS.CONTACT_DETAIL.replace(':id', contact.id)

  const checkbox = onSelect && (
    <input
      type="checkbox"
      checked={selected}
      onChange={(event) => onSelect(contact.id, event.target.checked)}
      // Stops a click on the checkbox from also following the card's link.
      onClick={(event) => event.stopPropagation()}
      aria-label={`Select ${contact.displayName}`}
      className="size-4 shrink-0 cursor-pointer rounded border-slate-300 text-brand-600 focus:ring-brand-500"
    />
  )

  const favouriteButton = onToggleFavorite && (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onToggleFavorite(contact)
      }}
      aria-label={contact.favorite ? `Unfavorite ${contact.displayName}` : `Favorite ${contact.displayName}`}
      aria-pressed={contact.favorite}
      className="grid size-7 shrink-0 place-items-center rounded transition-colors hover:bg-slate-100"
    >
      <Star
        className={`size-4 ${contact.favorite ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`}
        aria-hidden="true"
      />
    </button>
  )

  if (view === 'grid') {
    return (
      <div
        className={`group relative flex flex-col rounded-xl border bg-white p-4 shadow-sm transition-shadow hover:shadow-card-hover ${
          selected ? 'border-brand-400 ring-1 ring-brand-400' : 'border-slate-200'
        }`}
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          {checkbox}
          {favouriteButton}
        </div>

        <Link to={to} className="flex flex-col items-center text-center">
          <ContactAvatar contact={contact} size="lg" />

          <p className="mt-2.5 line-clamp-1 text-sm font-semibold text-slate-900">
            {contact.displayName}
          </p>

          {contact.jobTitle && (
            <p className="line-clamp-1 text-xs text-slate-500">{contact.jobTitle}</p>
          )}

          {contact.company && (
            <p className="mt-0.5 line-clamp-1 text-xs font-medium text-slate-600">
              {contact.company}
            </p>
          )}

          {contact.primaryEmail && (
            <p className="mt-1.5 line-clamp-1 text-[11px] text-slate-400">{contact.primaryEmail}</p>
          )}
        </Link>

        <div className="mt-3 flex flex-wrap justify-center gap-1">
          <Tag tone={source.className}>{source.label}</Tag>
          {contact.category && contact.category !== 'other' && (
            <Tag tone={CATEGORY_TONES[contact.category]}>{contact.category}</Tag>
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      className={`group flex items-center gap-3 border-b border-slate-100 px-4 py-2.5 transition-colors hover:bg-slate-50 ${
        selected ? 'bg-brand-50/50' : ''
      }`}
    >
      {checkbox}

      <Link to={to} className="flex min-w-0 flex-1 items-center gap-3">
        <ContactAvatar contact={contact} size="md" />

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-900">{contact.displayName}</p>
          <p className="truncate text-xs text-slate-500">
            {contact.jobTitle}
            {contact.jobTitle && contact.company && ' · '}
            {contact.company}
          </p>
        </div>

        {/* Contact details collapse away on narrow screens rather than wrapping. */}
        <div className="hidden min-w-0 flex-1 sm:block">
          {contact.primaryEmail && (
            <p className="flex items-center gap-1.5 truncate text-xs text-slate-600">
              <Mail className="size-3 shrink-0 text-slate-400" aria-hidden="true" />
              {contact.primaryEmail}
            </p>
          )}
          {(contact.mobile || contact.businessPhone) && (
            <p className="flex items-center gap-1.5 truncate text-xs text-slate-500">
              <Phone className="size-3 shrink-0 text-slate-400" aria-hidden="true" />
              {contact.mobile ?? contact.businessPhone}
            </p>
          )}
        </div>

        <div className="hidden w-28 shrink-0 lg:block">
          {contact.country && (
            <p className="flex items-center gap-1.5 truncate text-xs text-slate-500">
              <Building2 className="size-3 shrink-0 text-slate-400" aria-hidden="true" />
              {contact.country}
            </p>
          )}
        </div>

        <div className="hidden shrink-0 items-center gap-1 md:flex">
          <Tag tone={source.className}>{source.label}</Tag>
        </div>
      </Link>

      {favouriteButton}
    </div>
  )
}

export default ContactCard
