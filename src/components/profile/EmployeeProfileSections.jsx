/**
 * The employee's own profile: overview, personal, professional.
 *
 * ## Editing is inline, per section, not a separate page
 *
 * A profile is read far more often than it is edited. A dedicated edit route
 * would make the common case a navigation, and would leave two layouts of the
 * same information to keep in step. Each section toggles instead, so the fields
 * stay exactly where they were read.
 *
 * ## Read-only fields are rendered, never hidden
 *
 * `email`, `role`, `status` and `joining date` are shown and marked read-only.
 * Hiding them would leave an employee unable to check what the CRM thinks they
 * are — and the schema already refuses to write them, so displaying them costs
 * nothing.
 */

import { useEffect, useState } from 'react'
import { Camera, Check, Lock, Pencil, Trash2, X } from 'lucide-react'

import { AdminBadge } from '@/admin/components/AdminBadge'
import { AdminCard } from '@/admin/components/AdminCard'
import { AdminSelectField, AdminTextField } from '@/admin/components/AdminField'
import { ADMIN_ROLE_BADGE } from '@/admin/constants/adminRoles.constants'
import { EMPTY, formatDate } from '@/admin/utils/format'
import { UserAvatar } from '@/components/common/UserAvatar'
import { Button } from '@/components/ui/Button'
import { profilePhotoUrl } from '@/api/services/profile.service'

const GENDERS = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'other', label: 'Other' },
  { value: 'undisclosed', label: 'Prefer not to say' },
]

/** One labelled value. `dt`/`dd` because that is what these are. */
function Fact({ label, children, readOnly = false }) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1 text-xs font-medium text-slate-500">
        {label}
        {readOnly && <Lock className="size-3 text-slate-300" aria-label="Read only" />}
      </dt>
      <dd className="mt-0.5 truncate text-sm text-slate-800">{children || EMPTY}</dd>
    </div>
  )
}

/**
 * A section that flips between reading and editing.
 *
 * The edit state lives here rather than in the page, so two sections can never
 * be open at once with two half-finished patches competing to save.
 */
function EditableCard({ title, description, canEdit = true, onSave, children, form }) {
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState(null)

  const save = async () => {
    setIsSaving(true)
    setError(null)

    try {
      await onSave()
      setIsEditing(false)
    } catch (caught) {
      setError(caught?.message ?? 'That could not be saved.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <AdminCard
      title={title}
      description={description}
      action={
        canEdit &&
        (isEditing ? (
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => setIsEditing(false)} disabled={isSaving}>
              <X className="size-3.5" aria-hidden="true" />
              Cancel
            </Button>
            <Button size="sm" onClick={save} isLoading={isSaving}>
              <Check className="size-3.5" aria-hidden="true" />
              Save
            </Button>
          </div>
        ) : (
          <Button size="sm" variant="secondary" onClick={() => setIsEditing(true)}>
            <Pencil className="size-3.5" aria-hidden="true" />
            Edit
          </Button>
        ))
      }
    >
      {isEditing ? form : children}

      {error && (
        <p role="alert" className="mt-3 rounded-(--radius-control) border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}
    </AdminCard>
  )
}

/**
 * The header card: photo, name, and the facts that identify somebody.
 *
 * @param {{ profile: object, onPhoto?: Function, onRemovePhoto?: Function, canEdit?: boolean }} props
 */
export function ProfileOverviewCard({ profile, onPhoto, onRemovePhoto, canEdit = false }) {
  const [isBusy, setIsBusy] = useState(false)

  /*
   * The photo's absolute URL, versioned.
   *
   * `profile.profilePhoto` is only read as "does a photo exist" — the path it
   * carries is relative and resolves against the front end rather than the API.
   * See `profilePhotoUrl`.
   */
  const photoUrl = profile.profilePhoto
    ? profilePhotoUrl(profile.id, profile.photoUpdatedAt)
    : null

  /*
   * Which URL failed to load, so a missing file degrades to initials instead of
   * the browser's broken-image icon. Storing the URL rather than a boolean is
   * what lets a fresh upload recover on its own: the new URL carries a new
   * version, so it no longer matches and the image is attempted again.
   */
  const [failedUrl, setFailedUrl] = useState(null)
  const hasStoredPhoto = Boolean(photoUrl) && failedUrl !== photoUrl

  /*
   * The image the user just chose, shown before the upload finishes.
   *
   * Without this the avatar has nothing new to render between selection and the
   * refreshed server response, so it keeps showing initials and the choice
   * appears to have been ignored. `createObjectURL` points straight at the file
   * already on disk — no read, no base64, no copy in memory.
   */
  const [preview, setPreview] = useState(null)
  const [saved, setSaved] = useState(false)

  /*
   * Revoke the blob URL when it is replaced or the card unmounts.
   *
   * The cleanup runs when `preview` changes *away* from this value, never while
   * it is still on screen — revoking earlier is what makes a preview vanish the
   * instant it appears.
   */
  useEffect(() => {
    if (!preview) return undefined
    return () => URL.revokeObjectURL(preview)
  }, [preview])

  // Preview wins while it exists; the stored photo takes over once saved.
  const displayUrl = preview ?? (hasStoredPhoto ? photoUrl : null)
  const [error, setError] = useState(null)

  const pick = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/png,image/jpeg'

    input.addEventListener('change', async () => {
      const file = input.files?.[0]
      if (!file) return

      // Fast, kind feedback. The server re-checks the real bytes regardless.
      if (file.size > 5 * 1024 * 1024) {
        setError('That image is larger than 5 MB.')
        return
      }

      // Shown immediately, before the request is even sent.
      setPreview(URL.createObjectURL(file))
      setIsBusy(true)
      setError(null)
      setSaved(false)

      try {
        await onPhoto(file)

        /*
         * Cleared only once the upload resolved. `onPhoto` refreshes the
         * profile, so by now `photoUrl` carries a new version and the canonical
         * stored image renders in place of the blob.
         */
        setPreview(null)
        setFailedUrl(null)
        setSaved(true)
      } catch (caught) {
        // Drop the preview so the previous photo — not the rejected file —
        // remains on screen alongside the reason.
        setPreview(null)
        setError(caught?.message ?? 'That photo could not be uploaded.')
      } finally {
        setIsBusy(false)
      }
    })

    input.click()
  }

  return (
    <AdminCard>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <div className="relative shrink-0">
          {displayUrl ? (
            <img
              src={displayUrl}
              alt=""
              // Only the stored URL can "fail" in a way worth remembering; a
              // blob that fails is transient and the upload result decides.
              onError={preview ? undefined : () => setFailedUrl(photoUrl)}
              className={`size-20 rounded-full object-cover ring-1 ring-slate-200 ${
                isBusy ? 'opacity-60' : ''
              }`}
            />
          ) : (
            <UserAvatar name={profile.displayName} email={profile.email} size="xl" />
          )}

          {canEdit && (
            <button
              type="button"
              onClick={pick}
              disabled={isBusy}
              aria-label="Change profile photo"
              className="absolute -bottom-1 -right-1 grid size-7 place-items-center rounded-full bg-brand-600 text-white shadow-card transition-colors hover:bg-brand-700 disabled:opacity-60"
            >
              <Camera className="size-3.5" aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-lg font-semibold tracking-[-0.01em] text-slate-900">
              {profile.displayName ?? profile.email}
            </h2>
            <AdminBadge className={ADMIN_ROLE_BADGE[profile.role]}>{profile.roleLabel}</AdminBadge>
            <AdminBadge tone={profile.status === 'active' ? 'success' : 'neutral'} dot>
              {profile.statusLabel}
            </AdminBadge>
          </div>

          <p className="mt-0.5 truncate text-sm text-slate-500">{profile.email}</p>

          <dl className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Fact label="Employee ID">{profile.employeeId}</Fact>
            <Fact label="Department">{profile.department}</Fact>
            <Fact label="Designation">{profile.designation}</Fact>
            <Fact label="Phone">{profile.phone}</Fact>
          </dl>

          {canEdit && profile.profilePhoto && (
            <Button
              size="sm"
              variant="ghost"
              className="mt-3 text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={() => onRemovePhoto?.()}
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
              Remove photo
            </Button>
          )}

          {error && (
            <p role="alert" className="mt-2 text-sm text-red-700">
              {error}
            </p>
          )}

          {saved && !error && (
            <p role="status" className="mt-2 flex items-center gap-1.5 text-sm text-emerald-700">
              <Check className="size-3.5 shrink-0" aria-hidden="true" />
              Profile photo updated.
            </p>
          )}

          {/*
            The saved photo exists in the database but could not be fetched.
            Said out loud rather than silently falling back to initials — a
            silent fallback is indistinguishable from "no photo set", which is
            what made this hard to diagnose in the first place.
          */}
          {photoUrl && failedUrl === photoUrl && (
            <p role="status" className="mt-2 text-sm text-amber-700">
              Your saved photo could not be loaded. It is still on your profile —
              try refreshing, or upload it again.
            </p>
          )}
        </div>
      </div>
    </AdminCard>
  )
}

/**
 * Personal and professional details.
 *
 * @param {{ profile: object, draft: object, setDraft: Function, onSave: Function, canEdit?: boolean }} props
 */
export function ProfileDetailCards({ profile, draft, setDraft, onSave, canEdit = false }) {
  const field = (path) => path.split('.').reduce((value, key) => value?.[key], draft)

  const set = (path) => (value) =>
    setDraft((previous) => {
      const next = structuredClone(previous)
      const keys = path.split('.')
      const last = keys.pop()
      let cursor = next
      for (const key of keys) cursor = (cursor[key] ??= {})
      cursor[last] = value
      return next
    })

  return (
    <>
      <EditableCard
        title="Personal information"
        description="Only you and an administrator can see this."
        canEdit={canEdit}
        onSave={onSave}
        form={
          <div className="grid gap-4 sm:grid-cols-2">
            <AdminTextField label="Mobile number" value={field('phone') ?? ''} onChange={set('phone')} placeholder="+61 400 000 000" />
            <AdminTextField label="Date of birth" type="date" value={String(field('dateOfBirth') ?? '').slice(0, 10)} onChange={set('dateOfBirth')} />
            <AdminSelectField label="Gender" value={field('gender') ?? ''} onChange={set('gender')} options={GENDERS} placeholder="Choose…" />
            <AdminTextField label="Address" value={field('address.line1') ?? ''} onChange={set('address.line1')} />
            <AdminTextField label="City" value={field('address.city') ?? ''} onChange={set('address.city')} />
            <AdminTextField label="State" value={field('address.state') ?? ''} onChange={set('address.state')} />
            <AdminTextField label="Country" value={field('address.country') ?? ''} onChange={set('address.country')} />
            <AdminTextField label="Postal code" value={field('address.postalCode') ?? ''} onChange={set('address.postalCode')} />
            <AdminTextField label="Emergency contact" value={field('emergencyContact.name') ?? ''} onChange={set('emergencyContact.name')} />
            <AdminTextField
              label="Emergency number"
              value={field('emergencyContact.phone') ?? ''}
              onChange={set('emergencyContact.phone')}
              hint="A name and a number, or neither."
            />
            <AdminTextField label="Relationship" value={field('emergencyContact.relationship') ?? ''} onChange={set('emergencyContact.relationship')} />
          </div>
        }
      >
        <dl className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <Fact label="Mobile number">{profile.phone}</Fact>
          <Fact label="Date of birth">{profile.dateOfBirth ? formatDate(profile.dateOfBirth) : null}</Fact>
          <Fact label="Gender">{profile.genderLabel}</Fact>
          <Fact label="Address">
            {[profile.address.line1, profile.address.line2].filter(Boolean).join(', ')}
          </Fact>
          <Fact label="City">{profile.address.city}</Fact>
          <Fact label="State">{profile.address.state}</Fact>
          <Fact label="Country">{profile.address.country}</Fact>
          <Fact label="Postal code">{profile.address.postalCode}</Fact>
          <Fact label="Emergency contact">
            {profile.emergencyContact.name
              ? `${profile.emergencyContact.name}${profile.emergencyContact.relationship ? ` (${profile.emergencyContact.relationship})` : ''}`
              : null}
          </Fact>
          <Fact label="Emergency number">{profile.emergencyContact.phone}</Fact>
        </dl>
      </EditableCard>

      <EditableCard
        title="Professional information"
        description="Your place in the organization. Some of it is set by an administrator."
        canEdit={canEdit}
        onSave={onSave}
        form={
          <div className="grid gap-4 sm:grid-cols-2">
            <AdminTextField label="Employee ID" value={field('employeeId') ?? ''} onChange={set('employeeId')} />
            <AdminTextField label="Department" value={field('department') ?? ''} onChange={set('department')} />
            <AdminTextField label="Designation" value={field('designation') ?? ''} onChange={set('designation')} />
          </div>
        }
      >
        <dl className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <Fact label="Employee ID">{profile.employeeId}</Fact>
          <Fact label="Department">{profile.department}</Fact>
          <Fact label="Designation">{profile.designation}</Fact>
          <Fact label="Role" readOnly>
            {profile.roleLabel}
          </Fact>
          <Fact label="Status" readOnly>
            {profile.statusLabel}
          </Fact>
          <Fact label="Joining date" readOnly>
            {profile.joiningDate ? formatDate(profile.joiningDate) : null}
            {/* Said out loud rather than presented as fact — the server marks
                an inferred date, and passing it off as recorded would be a
                small lie somebody eventually relies on. */}
            {profile.joiningDateIsInferred && (
              <span className="ml-1 text-xs text-slate-400">(from account creation)</span>
            )}
          </Fact>
        </dl>
      </EditableCard>
    </>
  )
}

export default ProfileOverviewCard
