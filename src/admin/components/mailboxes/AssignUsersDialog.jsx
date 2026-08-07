/**
 * Assign people to one mailbox.
 *
 * The mailbox side of the relationship. Sends only the *additions* — the
 * connector and existing members are locked in the picker, so the difference
 * between the submitted set and what already existed is exactly what to add.
 *
 * Removals are deliberately not done here. They happen one at a time in the
 * detail drawer, where each row carries its own control and its own
 * confirmation of who is being removed. A multi-select that silently revokes
 * everybody the operator forgot to re-tick is the classic way to lock a team out
 * of a shared inbox.
 */

import { useEffect, useMemo, useState } from 'react'
import { UserPlus } from 'lucide-react'

import { AdminModal } from '@/admin/components/AdminModal'
import { AssignPicker } from '@/admin/components/mailboxes/AssignPicker'
import { MAILBOX_CONNECTOR_NOTICE } from '@/admin/constants/mailbox.constants'
import { ADMIN_USER_STATUS } from '@/admin/constants/admin.constants'
import { useAdminResource } from '@/admin/hooks'
import { assignMailboxUsers, fetchAdminUsers } from '@/admin/services/admin.service'
import { UserAvatar } from '@/components/common/UserAvatar'
import { Button } from '@/components/ui/Button'

/**
 * @param {{
 *   isOpen: boolean,
 *   onClose: () => void,
 *   mailbox: object,
 *   onAssigned: () => void,
 * }} props
 */
export function AssignUsersDialog({ isOpen, onClose, mailbox, onAssigned }) {
  const [selected, setSelected] = useState([])
  const [error, setError] = useState(null)
  const [isSaving, setIsSaving] = useState(false)

  const { data, isLoading } = useAdminResource(
    (options) => fetchAdminUsers({ limit: 100, status: ADMIN_USER_STATUS.ACTIVE, ...options }),
    { enabled: isOpen },
  )

  /**
   * Everyone who already has access, locked so they cannot be un-ticked here.
   *
   * The connector plus current assignees. Locking rather than hiding is what
   * makes the count in the picker match the count on the mailbox — a hidden
   * member is a member the operator forgets exists.
   */
  const lockedIds = useMemo(
    () => [mailbox?.connector?.id, ...(mailbox?.assignees ?? []).map((a) => a.id)].filter(Boolean),
    [mailbox],
  )

  // Reset on open, not on close, so fields do not visibly empty during the
  // closing transition.
  useEffect(() => {
    if (isOpen) {
      setSelected([])
      setError(null)
    }
  }, [isOpen])

  const options = useMemo(
    () =>
      (data?.items ?? []).map((user) => ({
        id: user.id,
        primary: user.displayName ?? user.email,
        secondary: `${user.email} · ${user.roleLabel ?? user.role}`,
        leading: <UserAvatar name={user.displayName} email={user.email} size="xs" />,
      })),
    [data],
  )

  /** Only the genuinely new ids — the locked ones are already members. */
  const toAdd = useMemo(
    () => selected.filter((id) => !lockedIds.includes(id)),
    [selected, lockedIds],
  )

  const handleSave = async () => {
    if (toAdd.length === 0) return

    setIsSaving(true)
    setError(null)

    try {
      await assignMailboxUsers(mailbox.id, toAdd)
      onAssigned()
      onClose()
    } catch (caught) {
      setError(caught?.message ?? 'Those users could not be assigned.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <AdminModal
      isOpen={isOpen}
      onClose={onClose}
      busy={isSaving}
      size="lg"
      title="Assign users"
      description={`Choose who may send through ${mailbox?.emailAddress ?? 'this mailbox'}.`}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            isLoading={isSaving}
            loadingLabel="Assigning…"
            disabled={toAdd.length === 0}
          >
            <UserPlus className="size-3.5" aria-hidden="true" />
            {toAdd.length === 0 ? 'Assign' : `Assign ${toAdd.length}`}
          </Button>
        </>
      }
    >
      {error && (
        <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {isLoading ? (
        <p className="py-8 text-center text-sm text-slate-500">Loading users…</p>
      ) : (
        <AssignPicker
          options={options}
          value={selected}
          onChange={setSelected}
          lockedIds={lockedIds}
          searchPlaceholder="Search people by name, email or role…"
          emptyMessage="There are no active users to assign."
        />
      )}

      <p className="mt-3 text-xs text-slate-400">
        {MAILBOX_CONNECTOR_NOTICE} Suspended accounts cannot be assigned. Remove access one person
        at a time from the mailbox panel.
      </p>
    </AdminModal>
  )
}

export default AssignUsersDialog
