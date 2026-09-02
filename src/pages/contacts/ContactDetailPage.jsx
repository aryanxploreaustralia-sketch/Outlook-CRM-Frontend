/**
 * A single contact.
 *
 * Fetches its own data rather than reading a list entry, because the list ships
 * a summary — no notes, no photo, no full address — and rendering a detail page
 * from it would show blanks for fields that exist.
 */

import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Briefcase,
  Building2,
  Cake,
  Globe,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Star,
  Tag,
  Trash2,
  Users,
} from 'lucide-react'

import { deleteContact, fetchContact, updateContact } from '@/api/services/contact.service'
import { useAuth } from '@/hooks/useAuth'
import { isTransportFailure } from '@/offline/read'
import { deleteLocal } from '@/offline/write'
import { ErrorScreen } from '@/components/common/ErrorScreen'
import { ContactAvatar } from '@/components/contacts/ContactAvatar'
import { Button } from '@/components/ui/Button'
import {
  CATEGORY_TONES,
  formatDate,
  formatRelative,
  SOURCE_VARIANTS,
  SYNC_STATUS_VARIANTS,
} from '@/constants/contact.constants'
import { useApiResource } from '@/hooks/useApiResource'
import { ROUTE_PATHS } from '@/routes/paths'
import { resolveErrorVariant } from '@/utils/apiError'

/** One labelled detail row; renders nothing when there is no value. */
function Field({ icon: Icon, label, value, href }) {
  if (!value) return null

  return (
    <div className="flex items-start gap-3 py-2">
      <Icon className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
        {href ? (
          <a href={href} className="break-words text-sm text-brand-600 hover:underline">
            {value}
          </a>
        ) : (
          <p className="break-words text-sm text-slate-800">{value}</p>
        )}
      </div>
    </div>
  )
}

export function ContactDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const userId = useAuth().user?.id ?? null

  const [isDeleting, setIsDeleting] = useState(false)
  const [favorite, setFavorite] = useState(null)

  const fetcher = useCallback(({ signal }) => fetchContact(id, { signal }), [id])
  const { data, isInitialLoading, isError, error, refresh } = useApiResource(fetcher)

  const contact = data?.contact
  const groups = data?.groups ?? []

  // Local optimistic state, reset whenever a different contact loads.
  useEffect(() => {
    setFavorite(contact?.favorite ?? null)
  }, [contact?.id, contact?.favorite])

  const toggleFavorite = useCallback(async () => {
    const next = !favorite
    setFavorite(next)
    try {
      await updateContact(id, { favorite: next })
    } catch {
      // Reverted on failure, so the star never lies about what was saved.
      setFavorite(!next)
    }
  }, [favorite, id])

  const handleDelete = useCallback(async () => {
    if (!window.confirm(`Delete ${contact?.displayName}? It can be restored later.`)) return

    setIsDeleting(true)
    try {
      try {
        await deleteContact(id)
      } catch (thrown) {
        /*
         * Only a transport failure falls back to the local queue. A 403 or a
         * 409 is the server refusing, and recording a local deletion for a
         * record the server will not delete would hide the record from this
         * user while it stayed live for everybody else.
         */
        if (!isTransportFailure(thrown) || !userId) throw thrown
        await deleteLocal('contacts', id, { userId })
      }
      navigate(ROUTE_PATHS.CONTACTS)
    } finally {
      setIsDeleting(false)
    }
  }, [contact?.displayName, id, navigate, userId])

  if (isError) {
    return (
      <ErrorScreen variant={resolveErrorVariant(error)} message={error?.message} onRetry={refresh} />
    )
  }

  if (isInitialLoading || !contact) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="h-6 w-40 animate-pulse rounded bg-slate-200" />
        <div className="h-64 animate-pulse rounded-xl bg-slate-200/70" />
      </div>
    )
  }

  const source = SOURCE_VARIANTS[contact.source] ?? SOURCE_VARIANTS.crm
  const syncStatus = SYNC_STATUS_VARIANTS[contact.syncStatus] ?? SYNC_STATUS_VARIANTS.local

  const location = [contact.address, contact.city, contact.state, contact.postalCode, contact.country]
    .filter(Boolean)
    .join(', ')

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Link
        to={ROUTE_PATHS.CONTACTS}
        className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 transition-colors hover:text-brand-600"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        Contacts
      </Link>

      {/* --- Header --------------------------------------------------------- */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start gap-4">
          <ContactAvatar contact={contact} size="xl" />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold text-slate-900">{contact.displayName}</h1>
              <button
                type="button"
                onClick={toggleFavorite}
                aria-label={favorite ? 'Remove from favorites' : 'Add to favorites'}
                aria-pressed={favorite}
                className="grid size-7 place-items-center rounded transition-colors hover:bg-slate-100"
              >
                <Star
                  className={`size-4 ${favorite ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`}
                  aria-hidden="true"
                />
              </button>
            </div>

            {contact.jobTitle && <p className="text-sm text-slate-600">{contact.jobTitle}</p>}
            {contact.company && (
              <p className="text-sm font-medium text-slate-700">{contact.company}</p>
            )}

            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${source.className}`}>
                {source.label}
              </span>
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${syncStatus.className}`}>
                {syncStatus.label}
              </span>
              {contact.category && (
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ring-1 ring-inset ${CATEGORY_TONES[contact.category]}`}>
                  {contact.category}
                </span>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <Button as={Link} to={ROUTE_PATHS.CONTACT_EDIT.replace(':id', id)} size="sm">
              <Pencil className="size-4" aria-hidden="true" />
              Edit
            </Button>
            <Button variant="danger" size="sm" onClick={handleDelete} isLoading={isDeleting}>
              <Trash2 className="size-4" aria-hidden="true" />
              Delete
            </Button>
          </div>
        </div>

        {contact.deletedRemotelyAt && (
          <p role="alert" className="mt-3 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-800">
            This contact was deleted in Outlook on {formatDate(contact.deletedRemotelyAt)}. It is kept
            here so your CRM notes and tags are not lost.
          </p>
        )}
      </div>

      {/* --- Details -------------------------------------------------------- */}
      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Contact details</h2>
          <div className="divide-y divide-slate-100">
            <Field icon={Mail} label="Primary email" value={contact.primaryEmail} href={contact.primaryEmail ? `mailto:${contact.primaryEmail}` : null} />
            <Field icon={Mail} label="Secondary email" value={contact.secondaryEmail} href={contact.secondaryEmail ? `mailto:${contact.secondaryEmail}` : null} />
            <Field icon={Phone} label="Mobile" value={contact.mobile} href={contact.mobile ? `tel:${contact.mobile}` : null} />
            <Field icon={Phone} label="Business phone" value={contact.businessPhone} href={contact.businessPhone ? `tel:${contact.businessPhone}` : null} />
            <Field icon={Phone} label="Home phone" value={contact.phone} />
            <Field icon={Globe} label="Website" value={contact.website} href={contact.website} />
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Organisation</h2>
          <div className="divide-y divide-slate-100">
            <Field icon={Building2} label="Company" value={contact.company} />
            <Field icon={Briefcase} label="Job title" value={contact.jobTitle} />
            <Field icon={MapPin} label="Address" value={location} />
            <Field icon={Cake} label="Birthday" value={formatDate(contact.birthday)} />
          </div>
        </section>
      </div>

      {contact.tags?.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Tag className="size-4 text-slate-400" aria-hidden="true" />
            Tags
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {contact.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-700">
                {tag}
              </span>
            ))}
          </div>
        </section>
      )}

      {groups.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Users className="size-4 text-slate-400" aria-hidden="true" />
            Groups
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {groups.map((group) => (
              <span
                key={group.id}
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs text-slate-700 ring-1 ring-inset ring-slate-200"
              >
                <span className="size-2 rounded-full" style={{ backgroundColor: group.color }} aria-hidden="true" />
                {group.name}
              </span>
            ))}
          </div>
        </section>
      )}

      {contact.notes && (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Notes</h2>
          {/* Rendered as text, never as HTML — notes are free-form user input. */}
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700">
            {contact.notes}
          </p>
        </section>
      )}

      <p className="text-center text-xs text-slate-400">
        Added {formatRelative(contact.createdAt)} · Updated {formatRelative(contact.updatedAt)}
        {contact.lastSyncedAt && ` · Synced ${formatRelative(contact.lastSyncedAt)}`}
      </p>
    </div>
  )
}

export default ContactDetailPage
