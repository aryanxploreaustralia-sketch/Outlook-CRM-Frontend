/**
 * The invitation form.
 *
 * ## Validation happens twice, and that is correct
 *
 * The server validates with Zod and is the authority. This validates too,
 * because a round trip to be told an address is malformed is a slow way to learn
 * something the browser already knew — and because a field-level message next to
 * the field beats a banner above the form.
 *
 * The rules are deliberately the *same* rules, not stricter ones: a client that
 * rejects something the server would accept is a client that has invented a
 * policy nobody wrote down.
 *
 * ## Server errors land on the field that caused them
 *
 * A duplicate address comes back as a 409 with `details.reason === 'user_exists'`.
 * Shown as a banner it reads as "something went wrong"; shown under the email
 * field it reads as "this address is taken", which is what it means and where
 * the user is looking.
 */

import { useEffect, useState } from 'react'
import { Mail, ShieldCheck, UserPlus } from 'lucide-react'

import { AdminModal } from '@/admin/components/AdminModal'
import {
  AdminSelectField,
  AdminTextArea,
  AdminTextField,
} from '@/admin/components/AdminField'
import { ADMIN_ROLES } from '@/admin/constants/adminRoles.constants'
import { inviteAdminUser } from '@/admin/services/admin.service'
import { Button } from '@/components/ui/Button'

const EMPTY = { fullName: '', email: '', role: '', microsoftEmail: '', notes: '' }

/**
 * Mirrors the server's Zod schema. Kept minimal on purpose — anything more
 * elaborate here would be a second, undocumented policy.
 */
function validate(values) {
  const errors = {}

  if (values.fullName.trim().length < 2) {
    errors.fullName = 'Enter the person’s full name.'
  } else if (values.fullName.trim().length > 128) {
    errors.fullName = 'That name is too long.'
  }

  const email = values.email.trim()
  if (!email) {
    errors.email = 'An email address is required.'
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = 'Enter a valid email address.'
  }

  if (!values.role) errors.role = 'Choose a role for this person.'

  /**
   * The Microsoft address is optional and independent of the primary one.
   *
   * Deliberately no rule that the two must differ, and none that they must
   * match — either constraint would be the CRM having an opinion about how an
   * organization names its people.
   */
  const microsoft = values.microsoftEmail.trim()
  if (microsoft && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(microsoft)) {
    errors.microsoftEmail = 'Enter a valid Microsoft address.'
  }

  if (values.notes.length > 512) errors.notes = 'Notes are limited to 512 characters.'

  return errors
}

/**
 * @param {{
 *   isOpen: boolean,
 *   onClose: () => void,
 *   onInvited: (result: object) => void,
 *   roles?: string[],
 * }} props
 *   `roles` is the set the server actually recognises. Falling back to the
 *   designed hierarchy would offer roles the backend enum would reject.
 */
export function InviteUserDialog({ isOpen, onClose, onInvited, roles }) {
  const [values, setValues] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Reset on open rather than on close, so the fields do not visibly empty
  // themselves during the closing transition.
  useEffect(() => {
    if (isOpen) {
      setValues(EMPTY)
      setErrors({})
      setFormError(null)
    }
  }, [isOpen])

  const roleOptions = (roles?.length ? roles : ADMIN_ROLES.map((role) => role.key)).map((key) => {
    const designed = ADMIN_ROLES.find((role) => role.key === key)
    return { value: key, label: designed?.label ?? key }
  })

  const set = (field) => (value) => {
    setValues((previous) => ({ ...previous, [field]: value }))
    // The error clears as soon as the user starts fixing it. Leaving it until
    // the next submit means typing under a message that is already wrong.
    setErrors((previous) => (previous[field] ? { ...previous, [field]: null } : previous))
    setFormError(null)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    const found = validate(values)
    setErrors(found)
    if (Object.keys(found).length > 0) return

    setIsSubmitting(true)
    setFormError(null)

    try {
      const result = await inviteAdminUser({
        fullName: values.fullName.trim(),
        email: values.email.trim(),
        role: values.role,
        ...(values.microsoftEmail.trim()
          ? { microsoftEmail: values.microsoftEmail.trim() }
          : {}),
        ...(values.notes.trim() ? { notes: values.notes.trim() } : {}),
      })

      onInvited(result)
      onClose()
    } catch (error) {
      if (error?.status === 409) {
        // A conflict can be on either address; the server's reason says which.
        const field =
          error.details?.reason === 'microsoft_identity_taken' ? 'microsoftEmail' : 'email'
        setErrors((previous) => ({ ...previous, [field]: error.message }))
      } else if (error?.status === 422 && error.details) {
        // The server's field-level detail, mapped onto the same field names.
        const mapped = {}
        for (const issue of Object.values(error.details).flat?.() ?? []) {
          if (issue?.path?.[0]) mapped[issue.path[0]] = issue.message
        }

        if (Object.keys(mapped).length > 0) {
          setErrors((previous) => ({ ...previous, ...mapped }))
        } else {
          // A 422 whose detail did not name a field this form owns. Better as a
          // banner than silently swallowed.
          setFormError(error.message)
        }
      } else {
        setFormError(error?.message ?? 'The invitation could not be created.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AdminModal
      isOpen={isOpen}
      onClose={onClose}
      busy={isSubmitting}
      title="Invite a user"
      description="Creates an account in the Invited state. No email is sent."
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            size="sm"
            form="invite-user-form"
            type="submit"
            isLoading={isSubmitting}
            loadingLabel="Inviting…"
          >
            <UserPlus className="size-3.5" aria-hidden="true" />
            Send invitation
          </Button>
        </>
      }
    >
      {/* `id` + `form` on the footer button, because the submit control lives
          outside the form element. A click still submits, and Enter in a text
          field still works — both of which break if the button is a plain
          onClick handler. */}
      <form id="invite-user-form" onSubmit={handleSubmit} noValidate className="space-y-1">
        {formError && (
          <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {formError}
          </p>
        )}

        <AdminTextField
          label="Full name"
          value={values.fullName}
          onChange={set('fullName')}
          placeholder="Ada Lovelace"
          error={errors.fullName}
          required
          autoFocus
          autoComplete="off"
        />

        <AdminTextField
          label="Google email"
          type="email"
          value={values.email}
          onChange={set('email')}
          placeholder="ada@example.com"
          hint="Employees sign in with this Google address. Case is ignored."
          error={errors.email}
          required
          autoComplete="off"
        />

        <AdminSelectField
          label="Role"
          value={values.role}
          onChange={set('role')}
          options={roleOptions}
          placeholder="Choose a role…"
          hint="Permissions follow the role immediately once they sign in."
          error={errors.role}
          required
        />

        {/*
          The organization-owner notice.

          Shown as its own block rather than as dropdown help text, because an
          owner invitation is the most consequential thing this form can do and
          the person filling it in should not have to infer that from a word in
          a select.
        */}
        {values.role === 'owner' && (
          <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-amber-700" aria-hidden="true" />
            <div className="text-xs text-amber-900">
              <p className="font-medium">You have been invited as an Organization Owner.</p>
              <p className="mt-0.5">
                That is what this person will be told. An owner has full administrative control:
                they can invite and remove access, change any role, and manage the organization.
              </p>
            </div>
          </div>
        )}

        <AdminTextField
          label="Microsoft address (optional)"
          type="email"
          value={values.microsoftEmail}
          onChange={set('microsoftEmail')}
          placeholder="name@yourcompany.com"
          hint="For somebody who signs in through the organization portal. It does not need to match the address above."
          error={errors.microsoftEmail}
          autoComplete="off"
        />

        <AdminTextArea
          label="Notes (optional)"
          value={values.notes}
          onChange={set('notes')}
          placeholder="Why this person needs access, or anything the next administrator should know."
          maxLength={512}
          error={errors.notes}
        />

        <div className="mt-2 flex items-start gap-2.5 rounded-lg bg-slate-50 px-3 py-2.5">
          <Mail className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden="true" />
          <p className="text-xs text-slate-500">
            No invitation email is sent. The account appears as <strong>Invited</strong> and cannot
            sign in until you activate it — after which their first Google sign-in claims it
            automatically.
          </p>
        </div>
      </form>
    </AdminModal>
  )
}

export default InviteUserDialog
