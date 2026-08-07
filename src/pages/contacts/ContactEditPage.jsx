/**
 * Create or edit a contact.
 *
 * One component for both, because the form is identical and the only differences
 * are where the initial values come from and which verb the save uses. Two files
 * would drift the moment a field was added to one and not the other.
 */

import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AlertCircle, ArrowLeft, Save, UserPlus, X } from 'lucide-react'

import { createContact, fetchContact, updateContact } from '@/api/services/contact.service'
import { Button } from '@/components/ui/Button'
import { CATEGORY_OPTIONS } from '@/constants/contact.constants'
import { ROUTE_PATHS } from '@/routes/paths'

/** Fields the form owns, with their empty values. */
const emptyForm = () => ({
  firstName: '',
  lastName: '',
  displayName: '',
  company: '',
  jobTitle: '',
  primaryEmail: '',
  secondaryEmail: '',
  mobile: '',
  businessPhone: '',
  phone: '',
  website: '',
  address: '',
  city: '',
  state: '',
  country: '',
  postalCode: '',
  category: 'other',
  notes: '',
  tags: [],
  favorite: false,
})

/** Labelled text input. */
function Input({ label, value, onChange, type = 'text', placeholder, ...rest }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      <input
        type={type}
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
        {...rest}
      />
    </label>
  )
}

export function ContactEditPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEditing = Boolean(id)

  const [form, setForm] = useState(emptyForm)
  const [tagInput, setTagInput] = useState('')
  const [isLoading, setIsLoading] = useState(isEditing)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState(null)
  const [duplicates, setDuplicates] = useState([])

  useEffect(() => {
    if (!isEditing) return undefined

    const controller = new AbortController()

    fetchContact(id, { signal: controller.signal })
      .then(({ contact }) => {
        // Nulls become empty strings: a controlled input given null warns and
        // then behaves as uncontrolled on the next keystroke.
        const loaded = emptyForm()
        for (const key of Object.keys(loaded)) {
          if (contact[key] !== null && contact[key] !== undefined) loaded[key] = contact[key]
        }
        setForm(loaded)
      })
      .catch((caught) => {
        if (!caught?.isCanceled) setError(caught)
      })
      .finally(() => setIsLoading(false))

    return () => controller.abort()
  }, [id, isEditing])

  const setField = useCallback((field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
    setError(null)
  }, [])

  const addTag = useCallback(() => {
    const tag = tagInput.trim().toLowerCase()
    if (!tag) return

    setForm((current) =>
      current.tags.includes(tag) ? current : { ...current, tags: [...current.tags, tag] },
    )
    setTagInput('')
  }, [tagInput])

  const removeTag = useCallback((tag) => {
    setForm((current) => ({ ...current, tags: current.tags.filter((entry) => entry !== tag) }))
  }, [])

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault()
      setIsSaving(true)
      setError(null)
      setDuplicates([])

      // Empty strings become null so a cleared field is actually cleared rather
      // than stored as "".
      const payload = Object.fromEntries(
        Object.entries(form).map(([key, value]) => [
          key,
          typeof value === 'string' && value.trim() === '' ? null : value,
        ]),
      )

      try {
        if (isEditing) {
          await updateContact(id, payload)
          navigate(ROUTE_PATHS.CONTACT_DETAIL.replace(':id', id))
        } else {
          const result = await createContact(payload)

          // Duplicates are reported, not blocked — two people can legitimately
          // share a switchboard number.
          if (result.possibleDuplicates?.length > 0) {
            setDuplicates(result.possibleDuplicates)
            setIsSaving(false)
            return
          }

          navigate(ROUTE_PATHS.CONTACT_DETAIL.replace(':id', result.contact.id))
        }
      } catch (caught) {
        setError(caught)
        setIsSaving(false)
      }
    },
    [form, id, isEditing, navigate],
  )

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4" aria-busy="true">
        <div className="h-6 w-40 animate-pulse rounded bg-slate-200" />
        <div className="h-96 animate-pulse rounded-xl bg-slate-200/70" />
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-3xl space-y-4">
      <Link
        to={isEditing ? ROUTE_PATHS.CONTACT_DETAIL.replace(':id', id) : ROUTE_PATHS.CONTACTS}
        className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 transition-colors hover:text-brand-600"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        {isEditing ? 'Back to contact' : 'Contacts'}
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
          {isEditing ? 'Edit contact' : 'New contact'}
        </h1>
        <Button type="submit" isLoading={isSaving} loadingLabel="Saving…">
          {isEditing ? <Save className="size-4" aria-hidden="true" /> : <UserPlus className="size-4" aria-hidden="true" />}
          {isEditing ? 'Save changes' : 'Create contact'}
        </Button>
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <p className="font-medium">{error.message}</p>
            {Array.isArray(error.details) && (
              <ul className="mt-1 list-inside list-disc text-xs">
                {error.details.map((issue, index) => (
                  <li key={index}>
                    <span className="font-medium">{issue.field}</span>: {issue.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {duplicates.length > 0 && (
        <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-medium">The contact was created, but it may be a duplicate.</p>
          <ul className="mt-1.5 space-y-1 text-xs">
            {duplicates.map((match) => (
              <li key={match.id}>
                Matches{' '}
                <Link to={ROUTE_PATHS.CONTACT_DETAIL.replace(':id', match.id)} className="font-medium underline">
                  {match.displayName}
                </Link>{' '}
                on {match.strategy.replace('_', ' ')} ({match.matchedOn}).
              </li>
            ))}
          </ul>
          <Button variant="secondary" size="sm" className="mt-2" onClick={() => navigate(ROUTE_PATHS.CONTACTS)}>
            Continue to contacts
          </Button>
        </div>
      )}

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">Name</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="First name" value={form.firstName} onChange={(v) => setField('firstName', v)} />
          <Input label="Last name" value={form.lastName} onChange={(v) => setField('lastName', v)} />
        </div>
        <Input
          label="Display name"
          value={form.displayName}
          onChange={(v) => setField('displayName', v)}
          placeholder="Derived from the name parts when left blank"
        />
      </section>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">Contact details</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Primary email" type="email" value={form.primaryEmail} onChange={(v) => setField('primaryEmail', v)} />
          <Input label="Secondary email" type="email" value={form.secondaryEmail} onChange={(v) => setField('secondaryEmail', v)} />
          <Input label="Mobile" type="tel" value={form.mobile} onChange={(v) => setField('mobile', v)} />
          <Input label="Business phone" type="tel" value={form.businessPhone} onChange={(v) => setField('businessPhone', v)} />
          <Input label="Home phone" type="tel" value={form.phone} onChange={(v) => setField('phone', v)} />
          <Input label="Website" type="url" value={form.website} onChange={(v) => setField('website', v)} placeholder="https://" />
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">Organisation</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Company" value={form.company} onChange={(v) => setField('company', v)} />
          <Input label="Job title" value={form.jobTitle} onChange={(v) => setField('jobTitle', v)} />
        </div>
        <Input label="Address" value={form.address} onChange={(v) => setField('address', v)} />
        <div className="grid gap-3 sm:grid-cols-4">
          <Input label="City" value={form.city} onChange={(v) => setField('city', v)} />
          <Input label="State" value={form.state} onChange={(v) => setField('state', v)} />
          <Input label="Postal code" value={form.postalCode} onChange={(v) => setField('postalCode', v)} />
          <Input label="Country" value={form.country} onChange={(v) => setField('country', v)} />
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">CRM</h2>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Category</span>
          <select
            value={form.category}
            onChange={(event) => setField('category', event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
          >
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>

        <div>
          <span className="mb-1 block text-xs font-medium text-slate-600">Tags</span>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {form.tags.map((tag) => (
              <span key={tag} className="inline-flex items-center gap-1 rounded-md bg-slate-100 py-0.5 pl-2 pr-1 text-xs text-slate-700">
                {tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  aria-label={`Remove tag ${tag}`}
                  className="grid size-4 place-items-center rounded text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                >
                  <X className="size-3" aria-hidden="true" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={tagInput}
              onChange={(event) => setTagInput(event.target.value)}
              onKeyDown={(event) => {
                // Enter inside a form would submit it; the tag is added instead.
                if (event.key === 'Enter' || event.key === ',') {
                  event.preventDefault()
                  addTag()
                }
              }}
              placeholder="Add a tag and press Enter"
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
            />
            <Button type="button" variant="secondary" onClick={addTag}>Add</Button>
          </div>
        </div>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Notes</span>
          <textarea
            value={form.notes ?? ''}
            onChange={(event) => setField('notes', event.target.value)}
            rows={5}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
          />
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.favorite}
            onChange={(event) => setField('favorite', event.target.checked)}
            className="size-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
          />
          <span className="text-sm text-slate-700">Mark as favorite</span>
        </label>
      </section>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={() => navigate(isEditing ? ROUTE_PATHS.CONTACT_DETAIL.replace(':id', id) : ROUTE_PATHS.CONTACTS)}
        >
          Cancel
        </Button>
        <Button type="submit" isLoading={isSaving} loadingLabel="Saving…">
          {isEditing ? 'Save changes' : 'Create contact'}
        </Button>
      </div>
    </form>
  )
}

export default ContactEditPage
