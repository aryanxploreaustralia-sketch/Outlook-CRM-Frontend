/**
 * Role management, inside the User 360 dashboard.
 *
 * The one control in the console that changes what somebody may do, so it is
 * built to be hard to use by accident and impossible to use beyond your
 * authority.
 *
 * ## The options come from the server
 *
 * `GET /admin/users/:id/role` returns every role with `allowed` and, when it is
 * not, the reason. The dropdown renders all of them and disables the illegal
 * ones **with their reason visible**, rather than hiding them: an admin who
 * cannot see "Owner" in the list learns nothing, while an admin who sees it
 * greyed out with "Your role cannot grant Owner" has learned how the system
 * works.
 *
 * None of that is security. The PATCH re-evaluates the same rules server-side
 * and refuses regardless of what the client sends — this only decides what is
 * *rendered*.
 *
 * ## Confirmation is required, and it names the consequence
 *
 * A role change is instant and affects every permission the person holds. The
 * dialog states the specific transition rather than asking "are you sure",
 * because "are you sure" is a question people answer yes to without reading.
 */

import { useCallback, useState } from 'react'
import { RotateCcw, ShieldCheck, Trash2 } from 'lucide-react'

import { AdminBadge } from '@/admin/components/AdminBadge'
import { AdminCard } from '@/admin/components/AdminCard'
import { AdminErrorState } from '@/admin/components/AdminErrorState'
import { AdminListLoading } from '@/admin/components/AdminLoadingState'
import { AdminModal } from '@/admin/components/AdminModal'
import { AdminSelectField, AdminTextArea } from '@/admin/components/AdminField'
import { UserSection } from '@/admin/components/users/detail/UserDetailPrimitives'
import { ADMIN_ROLE_BADGE } from '@/admin/constants/adminRoles.constants'
import { PERMISSIONS } from '@/admin/constants/permissions'
import { useAdminResource } from '@/admin/hooks/useAdminResource'
import { usePermission } from '@/admin/hooks/usePermissions'
import {
  changeAdminUserRole,
  deleteAdminUser,
  fetchAdminUserRole,
  restoreAdminUser,
} from '@/admin/services/admin.service'
import { Button } from '@/components/ui/Button'

/**
 * @param {{
 *   user: object,
 *   registerRef: (id: string) => object,
 *   enabled?: boolean,
 *   onChanged?: () => void,
 * }} props
 */
export function UserRoleSection({ user, registerRef, enabled = true, onChanged }) {
  const canManage = usePermission(PERMISSIONS.ROLES_MANAGE)

  const [selected, setSelected] = useState(user.role)
  const [reason, setReason] = useState('')
  const [isConfirming, setIsConfirming] = useState(false)

  /** Which lifecycle dialog is open, if any: 'delete' | 'restore' | null. */
  const [lifecycleAction, setLifecycleAction] = useState(null)
  const [lifecycleReason, setLifecycleReason] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [notice, setNotice] = useState(null)

  const loader = useCallback((options) => fetchAdminUserRole(user.id, options), [user.id])

  const { data, error, isLoading, refresh } = useAdminResource(loader, {
    deps: [user.id],
    enabled: canManage && enabled,
  })

  const options = data?.options ?? []
  const chosen = options.find((option) => option.value === selected)
  const current = options.find((option) => option.isCurrent)

  const save = async () => {
    setIsSaving(true)
    setSaveError(null)

    try {
      const result = await changeAdminUserRole(user.id, {
        role: selected,
        reason: reason.trim() || null,
      })

      setIsConfirming(false)
      setReason('')
      setNotice(`${result.user.email} is now a ${result.toLabel}.`)
      refresh()
      onChanged?.()
      setTimeout(() => setNotice(null), 6000)
    } catch (caught) {
      // Shown inside the dialog rather than behind it: the refusal is about the
      // action the person is in the middle of taking.
      setSaveError(caught?.message ?? 'That role could not be changed.')
    } finally {
      setIsSaving(false)
    }
  }

  /**
   * Delete or restore.
   *
   * The success message comes from the server's own numbers — how many sessions
   * were revoked, how many mailboxes unassigned — rather than from a sentence
   * this component guesses at. If the server did something different from what
   * was expected, the operator sees what actually happened.
   */
  const runLifecycle = async () => {
    setIsSaving(true)
    setSaveError(null)

    try {
      if (lifecycleAction === 'delete') {
        const result = await deleteAdminUser(user.id, { reason: lifecycleReason })

        setNotice(
          `${result.user.email} can no longer sign in. ${result.revokedSessions} session(s) revoked, ` +
            `${result.mailboxesUnassigned} mailbox assignment(s) removed. History preserved.`,
        )
      } else {
        const result = await restoreAdminUser(user.id)
        setNotice(`${result.user.email} can sign in again. They will need to sign in fresh.`)
      }

      setLifecycleAction(null)
      setLifecycleReason('')
      refresh()
      onChanged?.()
      setTimeout(() => setNotice(null), 8000)
    } catch (caught) {
      setSaveError(caught?.message ?? 'That could not be completed.')
    } finally {
      setIsSaving(false)
    }
  }

  const lifecycle = data?.lifecycle ?? null

  const body = () => {
    if (!canManage) {
      return (
        <p className="text-sm text-slate-500">
          Changing roles requires the &ldquo;Change role definitions&rdquo; permission.
        </p>
      )
    }

    if (error) return <AdminErrorState error={error} onRetry={refresh} compact />
    if (isLoading || !data) return <AdminListLoading rows={3} />

    if (!data.canModify) {
      return (
        <div className="space-y-2">
          <p className="text-sm text-slate-700">
            This account is a{' '}
            <AdminBadge className={ADMIN_ROLE_BADGE[user.role]}>
              {user.roleLabel ?? user.role}
            </AdminBadge>
            .
          </p>
          <p className="text-sm text-slate-500">
            {data.isSelf
              ? 'You cannot change your own role. Ask another owner to do it.'
              : `Your role cannot modify a ${current?.label ?? user.role}.`}
          </p>
        </div>
      )
    }

    return (
      <div className="space-y-4">
        {/* --- Current role, with what it is for ------------------------- */}
        <div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <span>Current role</span>
            <AdminBadge className={ADMIN_ROLE_BADGE[user.role]}>
              {data.current?.label ?? user.roleLabel ?? user.role}
            </AdminBadge>
          </div>

          {data.current?.description && (
            <p className="mt-1.5 text-sm text-slate-500">{data.current.description}</p>
          )}
        </div>

        {/* --- What it actually grants ------------------------------------
            Resolved by the server from the same engine the guards use, so this
            cannot claim a capability a request would be refused. */}
        {data.effectivePermissions?.length > 0 && (
          <details className="rounded-lg border border-slate-200 bg-slate-50/60">
            <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-slate-700">
              Effective permissions
              <span className="ml-1.5 font-normal text-slate-400">
                {data.effectivePermissions.length}
              </span>
            </summary>

            <ul className="flex flex-wrap gap-1.5 border-t border-slate-200 px-3 py-2.5">
              {data.effectivePermissions.map((permission) => (
                <li
                  key={permission.value}
                  className="rounded-md bg-white px-2 py-0.5 text-xs text-slate-600 ring-1 ring-slate-200"
                  title={permission.value}
                >
                  {permission.label}
                </li>
              ))}
            </ul>
          </details>
        )}

        <AdminSelectField
          label="New role"
          value={selected}
          onChange={setSelected}
          hint="Permissions follow the role immediately. There is no separate permission list to update."
          options={options.map((option) => ({
            value: option.value,
            // The reason travels in the label, because a `<option>` cannot
            // carry a tooltip in any way a screen reader announces reliably.
            label: option.isCurrent
              ? `${option.label} — current`
              : option.allowed
                ? option.label
                : `${option.label} — ${option.message ?? 'not available to you'}`,
            // The current role stays selectable so the control can display it;
            // an illegal one is visible, disabled, and says why.
            disabled: !option.allowed && !option.isCurrent,
          }))}
        />

        <div className="flex flex-wrap items-center justify-end gap-2">
          {/*
            Delete and restore are mutually exclusive and the server decides
            which applies. Rendering both and disabling one would suggest an
            account can be in two states at once.
          */}
          {lifecycle?.isDeleted
            ? lifecycle.canRestore?.allowed && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setSaveError(null)
                    setLifecycleAction('restore')
                  }}
                >
                  <RotateCcw className="size-3.5" aria-hidden="true" />
                  Restore user
                </Button>
              )
            : lifecycle?.canDelete?.allowed && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={() => {
                    setSaveError(null)
                    setLifecycleAction('delete')
                  }}
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                  Delete user
                </Button>
              )}

          {/*
            When the server refuses, its reason is shown rather than the button
            being silently absent — "this is the last active owner" teaches
            something; a missing control does not.
          */}
          {!lifecycle?.isDeleted && lifecycle?.canDelete && !lifecycle.canDelete.allowed && (
            <p className="mr-auto text-xs text-slate-400">{lifecycle.canDelete.message}</p>
          )}

          <Button
            size="sm"
            disabled={!chosen?.allowed || lifecycle?.isDeleted}
            onClick={() => {
              setSaveError(null)
              setIsConfirming(true)
            }}
          >
            <ShieldCheck className="size-3.5" aria-hidden="true" />
            Change role
          </Button>
        </div>
      </div>
    )
  }

  return (
    <UserSection
      id="role"
      ref={registerRef('role')}
      title="Role"
      description="What this account is permitted to do across the CRM and the admin console."
    >
      {notice && (
        <p
          role="status"
          className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800"
        >
          {notice}
        </p>
      )}

      <AdminCard>{body()}</AdminCard>

      <AdminModal
        isOpen={isConfirming}
        onClose={() => setIsConfirming(false)}
        title="Change this role?"
        busy={isSaving}
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsConfirming(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={save} isLoading={isSaving}>
              Change role
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {/* The specific transition, not a generic warning. */}
          <p className="text-sm text-slate-700">
            <span className="font-medium">{user.email}</span> will change from{' '}
            <span className="font-medium">{current?.label ?? user.role}</span> to{' '}
            <span className="font-medium">{chosen?.label}</span>.
          </p>

          <p className="text-sm text-slate-600">
            Their permissions change immediately, on their very next request. They are not signed
            out — a role change is not a suspension.
          </p>

          <AdminTextArea
            label="Reason (optional)"
            value={reason}
            onChange={setReason}
            rows={3}
            maxLength={500}
            placeholder="Why is this changing? Recorded on the audit entry."
          />

          {saveError && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {saveError}
            </p>
          )}
        </div>
      </AdminModal>

      {/* --- Delete / restore ------------------------------------------- */}
      <AdminModal
        isOpen={Boolean(lifecycleAction)}
        onClose={() => setLifecycleAction(null)}
        title={lifecycleAction === 'delete' ? 'Delete this user?' : 'Restore this user?'}
        busy={isSaving}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setLifecycleAction(null)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button onClick={runLifecycle} isLoading={isSaving}>
              {lifecycleAction === 'delete' ? 'Delete user' : 'Restore user'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-700">
            <span className="font-medium">{user.email}</span>
            {lifecycleAction === 'delete'
              ? ' will immediately lose access. Every active session is revoked and their mailbox assignments are removed.'
              : ' will be able to sign in again with their existing role.'}
          </p>

          {lifecycleAction === 'delete' ? (
            <>
              {/*
                The promise the brief asks for, stated plainly. It is true:
                the document is retained and nothing that references it is
                touched — see the lifecycle service.
              */}
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                Deleting this user revokes access but preserves all CRM history — their enquiries,
                campaigns, analytics and audit entries are unchanged and stay attributed to them.
              </p>

              <AdminTextArea
                label="Reason (optional)"
                value={lifecycleReason}
                onChange={setLifecycleReason}
                rows={3}
                maxLength={500}
                placeholder="Why is this account being removed? Recorded on the audit entry."
              />
            </>
          ) : (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Their sessions stay revoked, so they will have to sign in again. Mailbox assignments
              removed at deletion are not restored automatically.
            </p>
          )}

          {saveError && (
            <p
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
            >
              {saveError}
            </p>
          )}
        </div>
      </AdminModal>
    </UserSection>
  )
}

export default UserRoleSection
