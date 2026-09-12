/**
 * Share one enquiry with colleagues.
 *
 * ## Set semantics, matching the endpoint
 *
 * The dialog holds the complete selection and saves that. Ticking a name adds
 * access, un-ticking removes it, and Save applies both in one request — so the
 * list on screen is always exactly what the enquiry will be shared with. The
 * server computes the additions and removals itself; nothing here sends a diff
 * that could disagree with the picker.
 *
 * ## What it deliberately does not do
 *
 * It never touches ownership. The enquiry belongs to whoever it belonged to
 * before the dialog opened, and the footer says so, because "share" is a word
 * people reasonably read as "hand over".
 *
 * ## Online only
 *
 * Sharing is an access-control change and the offline layer caches enquiries
 * per user from an owner-scoped feed, so a grant made offline could not be
 * applied or reasoned about until it synced. Rather than queue something whose
 * effect is invisible until then, the dialog says it needs a connection and the
 * Save button stays out of reach. Nothing about the offline queue is involved.
 *
 * Reuses `AdminModal` and `AssignPicker` — the same dialog shell and the same
 * searchable multi-select the mailbox assignment screen uses. The name on the
 * picker is the console's; the behaviour is generic, and a second multi-select
 * would be one more thing to keep in step.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CloudOff, Share2 } from 'lucide-react'

import { AdminModal } from '@/admin/components/AdminModal'
import { AssignPicker } from '@/admin/components/mailboxes/AssignPicker'
import { UserAvatar } from '@/components/common/UserAvatar'
import { Button } from '@/components/ui/Button'
import { fetchLeadSharing, fetchShareableUsers, updateLeadSharing } from '@/api/services/lead.service'
import { isCancelledError } from '@/utils/apiError'

const messageOf = (error, fallback) =>
  error?.response?.data?.message ?? error?.message ?? fallback

/**
 * @param {{
 *   isOpen: boolean,
 *   onClose: () => void,
 *   lead: object,
 *   isOffline?: boolean,
 *   onSaved?: (userIds: string[]) => void,
 * }} props
 */
export function ShareLeadDialog({ isOpen, onClose, lead, isOffline = false, onSaved }) {
  const [users, setUsers] = useState([])
  const [selected, setSelected] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState(null)

  const leadId = lead?.id ?? null

  /*
   * Loaded when the dialog opens, not when the page does.
   *
   * Most readers never share an enquiry, and the user list is a request that
   * would otherwise be made on every lead they open.
   */
  useEffect(() => {
    if (!isOpen || !leadId || isOffline) return undefined

    const controller = new AbortController()
    setIsLoading(true)
    setError(null)

    Promise.all([
      fetchShareableUsers({ signal: controller.signal }),
      fetchLeadSharing(leadId, { signal: controller.signal }),
    ])
      .then(([available, current]) => {
        setUsers(available?.items ?? [])
        setSelected((current?.items ?? []).map((user) => String(user.id)))
      })
      .catch((caught) => {
        if (isCancelledError(caught)) return
        setError(messageOf(caught, 'The people list could not be loaded.'))
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })

    return () => controller.abort()
  }, [isOpen, leadId, isOffline])

  const options = useMemo(
    () =>
      users.map((user) => ({
        id: String(user.id),
        primary: user.name,
        secondary: user.email ?? undefined,
        leading: <UserAvatar name={user.name} email={user.email} size="sm" />,
      })),
    [users],
  )

  const save = useCallback(async () => {
    if (!leadId) return

    setIsSaving(true)
    setError(null)

    try {
      const result = await updateLeadSharing(leadId, selected)
      onSaved?.(result?.sharedWith ?? selected)
      onClose()
    } catch (caught) {
      setError(messageOf(caught, 'The access could not be saved.'))
    } finally {
      setIsSaving(false)
    }
  }, [leadId, selected, onSaved, onClose])

  return (
    <AdminModal
      isOpen={isOpen}
      onClose={onClose}
      busy={isSaving}
      title="Share enquiry"
      description={
        lead?.reference
          ? `Give colleagues access to ${lead.reference}. They can view and edit it — nothing else.`
          : 'Give colleagues access to this enquiry.'
      }
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={save}
            isLoading={isSaving}
            disabled={isSaving || isLoading || isOffline}
          >
            <Share2 className="size-3.5" aria-hidden="true" />
            Save access
          </Button>
        </>
      }
    >
      {isOffline ? (
        <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-inset ring-amber-200">
          <CloudOff className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            Sharing needs a connection. Your other work is still saved on this device — reopen this
            once you’re back online.
          </span>
        </p>
      ) : (
        <>
          {error && (
            <p
              role="alert"
              className="mb-3 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-inset ring-rose-200"
            >
              {error}
            </p>
          )}

          {isLoading ? (
            <div className="space-y-2" aria-busy="true">
              {Array.from({ length: 5 }, (_, index) => (
                <div key={index} className="h-11 animate-pulse rounded-lg bg-slate-100" />
              ))}
            </div>
          ) : (
            <AssignPicker
              options={options}
              value={selected}
              onChange={setSelected}
              searchPlaceholder="Search people…"
              emptyMessage="There is nobody else to share this enquiry with."
            />
          )}

          {/*
            Said plainly, because "share" is a word people reasonably read as
            "hand over". Ownership is not what this screen changes.
          */}
          <p className="mt-3 text-xs text-slate-500">
            You stay the owner of this enquiry. Shared colleagues can view and edit it; they cannot
            delete it or share it with anyone else.
          </p>
        </>
      )}
    </AdminModal>
  )
}

export default ShareLeadDialog
