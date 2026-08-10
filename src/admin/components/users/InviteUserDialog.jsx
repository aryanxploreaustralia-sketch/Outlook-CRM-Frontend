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
import {
  Check,
  FileSpreadsheet,
  Mail,
  ShieldCheck,
  TriangleAlert,
  Upload,
  UserPlus,
  X,
} from 'lucide-react'

import { AdminModal } from '@/admin/components/AdminModal'
import {
  AdminSelectField,
  AdminTextArea,
  AdminTextField,
} from '@/admin/components/AdminField'
import { ADMIN_ROLES } from '@/admin/constants/adminRoles.constants'
import { importAdminUserLeads, inviteAdminUser } from '@/admin/services/admin.service'
import { Button } from '@/components/ui/Button'

const EMPTY = { fullName: '', email: '', role: '', microsoftEmail: '', notes: '' }

/**
 * What the submit button says while each half runs.
 *
 * Two requests, so one label would be misleading for most of the wait: a large
 * workbook takes far longer than creating the account, and "Inviting…" for
 * thirty seconds reads as a hang.
 */
const STAGE_LABELS = Object.freeze({
  creating: 'Creating user…',
  importing: 'Importing leads…',
})

/** Human file size for the selected workbook. */
function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

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

  /** The optional workbook, and what the submit is currently doing. */
  const [workbook, setWorkbook] = useState(null)
  const [stage, setStage] = useState(null)

  /**
   * Set only when the account was created and the import then failed.
   *
   * Its presence switches the dialog into a state that reports both outcomes,
   * because that combination cannot honestly be shown as either a success or a
   * failure.
   */
  const [partial, setPartial] = useState(null)

  // Reset on open rather than on close, so the fields do not visibly empty
  // themselves during the closing transition.
  useEffect(() => {
    if (isOpen) {
      setValues(EMPTY)
      setErrors({})
      setFormError(null)
      setWorkbook(null)
      setStage(null)
      setPartial(null)
    }
  }, [isOpen])

  /** Retries only the import — the account already exists. */
  const retryImport = async () => {
    if (!partial || !workbook) return

    setIsSubmitting(true)
    setStage('importing')

    try {
      const assignment = await importAdminUserLeads(partial.user.user.id, workbook)
      setIsSubmitting(false)
      onInvited({ ...partial.user, assignment })
      onClose()
    } catch (error) {
      setIsSubmitting(false)
      setStage(null)
      setPartial((previous) => ({
        ...previous,
        message: error?.message ?? 'The workbook could not be imported.',
      }))
    }
  }

  /** Closes after a partial result, keeping the created user. */
  const acceptPartial = () => {
    onInvited(partial.user)
    onClose()
  }

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
    setStage(workbook ? 'creating' : null)

    let result
    try {
      result = await inviteAdminUser({
        fullName: values.fullName.trim(),
        email: values.email.trim(),
        role: values.role,
        ...(values.microsoftEmail.trim()
          ? { microsoftEmail: values.microsoftEmail.trim() }
          : {}),
        ...(values.notes.trim() ? { notes: values.notes.trim() } : {}),
      })
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

      // The account was not created, so there is nothing to assign enquiries to.
      setIsSubmitting(false)
      setStage(null)
      return
    }

    // --- The account exists from here on -----------------------------------
    //
    // Everything below can fail without undoing it, so no path may report a
    // plain failure: the administrator must always be told the user was
    // created, whatever happened to the workbook.

    if (!workbook) {
      setIsSubmitting(false)
      onInvited(result)
      onClose()
      return
    }

    setStage('importing')

    try {
      const assignment = await importAdminUserLeads(result.user.id, workbook)

      setIsSubmitting(false)
      onInvited({ ...result, assignment })
      onClose()
    } catch (error) {
      /**
       * The user exists and the enquiries did not land.
       *
       * Reported in place rather than thrown away with the dialog: closing on a
       * generic success would tell the administrator the opposite of what
       * happened, and they would find out when the new joiner reported an empty
       * register. The dialog stays open, states both outcomes, and offers the
       * import again — the account is already made, so a retry only repeats the
       * half that failed.
       */
      setIsSubmitting(false)
      setStage(null)
      setPartial({
        user: result,
        message: error?.message ?? 'The workbook could not be imported.',
      })
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
        partial ? (
          <>
            <Button variant="secondary" size="sm" onClick={acceptPartial} disabled={isSubmitting}>
              Close without leads
            </Button>
            <Button
              size="sm"
              onClick={retryImport}
              isLoading={isSubmitting}
              loadingLabel="Importing…"
            >
              <Upload className="size-3.5" aria-hidden="true" />
              Retry import
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" size="sm" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              size="sm"
              form="invite-user-form"
              type="submit"
              isLoading={isSubmitting}
              // Names the half currently running, so a long import does not look
              // like a stalled invitation.
              loadingLabel={STAGE_LABELS[stage] ?? 'Inviting…'}
            >
              <UserPlus className="size-3.5" aria-hidden="true" />
              {workbook ? 'Create and assign leads' : 'Send invitation'}
            </Button>
          </>
        )
      }
    >
      {/* `id` + `form` on the footer button, because the submit control lives
          outside the form element. A click still submits, and Enter in a text
          field still works — both of which break if the button is a plain
          onClick handler. */}
      {/* --- Partial result -------------------------------------------------
          The account exists and the workbook did not import. Shown instead of
          the form, because re-editing the fields would not help: the user is
          already created and only the second half can be retried. */}
      {partial ? (
        <div className="space-y-3">
          <div className="flex items-start gap-2.5 rounded-lg bg-emerald-50 px-3 py-2.5">
            <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden="true" />
            <p className="text-sm text-emerald-900">
              <strong>{partial.user.user.email}</strong> was created. The account is ready.
            </p>
          </div>

          <div role="alert" className="flex items-start gap-2.5 rounded-lg bg-red-50 px-3 py-2.5">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-red-600" aria-hidden="true" />
            <div className="text-sm text-red-800">
              <p className="font-medium">No leads were assigned.</p>
              <p className="mt-0.5 text-red-700">{partial.message}</p>
            </div>
          </div>

          <p className="text-xs text-slate-500">
            You can retry the upload now, or close and assign the workbook later from the
            Leads → Import workbook screen while signed in as that user.
          </p>
        </div>
      ) : (
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

        {/* --- Initial lead assignment (optional) ---------------------------
            Entirely optional: leaving it empty creates the account exactly as
            this dialog always has. The file is not read here — it is uploaded
            after the account exists, so its id can own the enquiries. */}
        <fieldset className="mt-4 rounded-lg border border-slate-200 p-3">
          <legend className="px-1 text-xs font-semibold text-slate-700">
            Initial lead assignment
          </legend>

          <p className="text-xs text-slate-500">
            Optionally upload an Excel workbook to assign existing leads to this user when
            creating the account.
          </p>

          {workbook ? (
            <div className="mt-2.5 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
              <FileSpreadsheet className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-slate-800">{workbook.name}</p>
                <p className="text-xs text-slate-500">{formatBytes(workbook.size)}</p>
              </div>
              <button
                type="button"
                onClick={() => setWorkbook(null)}
                disabled={isSubmitting}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 disabled:opacity-50"
                aria-label={`Remove ${workbook.name}`}
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
          ) : (
            <label className="mt-2.5 flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2.5 text-sm text-slate-600 hover:border-slate-400 hover:bg-slate-50">
              <Upload className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
              Choose .xlsx file
              <input
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="sr-only"
                disabled={isSubmitting}
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null
                  setWorkbook(file)
                  setFormError(null)
                  // Cleared so choosing the same file twice still fires change.
                  event.target.value = ''
                }}
              />
            </label>
          )}

          {workbook && (
            <p className="mt-2 text-xs text-slate-500">
              Every lead sheet in the workbook is imported and assigned to this user. Stages,
              Query Dates and Remarks are read exactly as the Leads → Import workbook screen
              reads them.
            </p>
          )}
        </fieldset>

        <div className="mt-2 flex items-start gap-2.5 rounded-lg bg-slate-50 px-3 py-2.5">
          <Mail className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden="true" />
          <p className="text-xs text-slate-500">
            No invitation email is sent. The account appears as <strong>Invited</strong> and cannot
            sign in until you activate it — after which their first Google sign-in claims it
            automatically.
          </p>
        </div>
      </form>
      )}
    </AdminModal>
  )
}

export default InviteUserDialog
