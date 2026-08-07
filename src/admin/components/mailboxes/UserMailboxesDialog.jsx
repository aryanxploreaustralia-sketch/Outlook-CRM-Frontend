/**
 * Assign mailboxes to one person.
 *
 * The user side of the same relationship the mailbox drawer manages. It submits
 * a **set** — the complete list this person should have — so adds and removes
 * happen in one save and cannot disagree with each other.
 *
 * That is the difference from `AssignUsersDialog`, and it is deliberate rather
 * than inconsistent: removing a mailbox from one person affects one person, and
 * they are named at the top of the dialog. Removing a person from a mailbox
 * affects everybody who shares it, which is why that direction is one row at a
 * time with the name in front of you.
 *
 * ## Mailboxes the person connected are locked
 *
 * Their access comes from the OAuth grant. The server refuses to revoke it, so
 * the picker shows them ticked and disabled rather than offering a control that
 * fails.
 */

import { useEffect, useMemo, useState } from 'react'
import { Inbox, Save } from 'lucide-react'

import { AdminModal } from '@/admin/components/AdminModal'
import { AssignPicker } from '@/admin/components/mailboxes/AssignPicker'
import {
  MAILBOX_CONNECTOR_NOTICE,
  MAILBOX_HEALTH_LABELS,
} from '@/admin/constants/mailbox.constants'
import { useAdminResource } from '@/admin/hooks'
import {
  fetchAdminMailboxes,
  fetchUserMailboxes,
  setUserMailboxes,
} from '@/admin/services/admin.service'
import { Button } from '@/components/ui/Button'

/**
 * @param {{
 *   isOpen: boolean,
 *   onClose: () => void,
 *   user: object,
 *   onSaved: () => void,
 * }} props
 */
export function UserMailboxesDialog({ isOpen, onClose, user, onSaved }) {
  const [selected, setSelected] = useState([])
  const [error, setError] = useState(null)
  const [isSaving, setIsSaving] = useState(false)

  const { data: all, isLoading } = useAdminResource(
    (options) => fetchAdminMailboxes(options),
    { enabled: isOpen },
  )

  const { data: mine } = useAdminResource(
    (options) => fetchUserMailboxes(user?.id, options),
    { enabled: Boolean(isOpen && user?.id), deps: [user?.id] },
  )

  /** Mailboxes this person connected. Locked — the grant is theirs. */
  const lockedIds = useMemo(
    () => (mine?.items ?? []).filter((m) => m.accessVia === 'connector').map((m) => m.id),
    [mine],
  )

  // Seeded from the server's answer once it arrives, so the dialog opens showing
  // what is true rather than empty and then filling in.
  useEffect(() => {
    if (!isOpen || !mine) return

    setSelected((mine.items ?? []).filter((m) => m.accessVia === 'assigned').map((m) => m.id))
    setError(null)
  }, [isOpen, mine])

  const options = useMemo(
    () =>
      (all?.items ?? []).map((mailbox) => {
        const usable = mailbox.status === 'connected'

        return {
          id: mailbox.id,
          primary: mailbox.emailAddress ?? mailbox.displayName,
          secondary: `${mailbox.providerLabel} · ${MAILBOX_HEALTH_LABELS[mailbox.health.state] ?? mailbox.health.state}`,
          // A disconnected mailbox cannot be assigned — the server refuses it,
          // so the picker refuses it too rather than letting the save fail.
          disabled: !usable,
          disabledReason: usable ? undefined : 'Not connected',
        }
      }),
    [all],
  )

  const handleSave = async () => {
    setIsSaving(true)
    setError(null)

    try {
      await setUserMailboxes(user.id, selected)
      onSaved()
      onClose()
    } catch (caught) {
      setError(caught?.message ?? 'Those mailboxes could not be assigned.')
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
      title="Assign mailboxes"
      description={`Choose which mailboxes ${user?.displayName ?? user?.email ?? 'this person'} may send through.`}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} isLoading={isSaving} loadingLabel="Saving…">
            <Save className="size-3.5" aria-hidden="true" />
            Save assignments
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
        <p className="py-8 text-center text-sm text-slate-500">Loading mailboxes…</p>
      ) : (
        <AssignPicker
          options={options}
          value={selected}
          onChange={setSelected}
          lockedIds={lockedIds}
          searchPlaceholder="Search mailboxes by address…"
          emptyMessage="No mailboxes are connected yet."
        />
      )}

      <div className="mt-3 flex items-start gap-2.5 rounded-lg bg-slate-50 px-3 py-2.5">
        <Inbox className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden="true" />
        <p className="text-xs text-slate-500">
          This saves the complete list — anything unticked is removed. {MAILBOX_CONNECTOR_NOTICE}
        </p>
      </div>
    </AdminModal>
  )
}

export default UserMailboxesDialog
