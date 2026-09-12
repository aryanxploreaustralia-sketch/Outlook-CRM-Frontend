/**
 * Share every enquiry this manager owns, in one operation.
 *
 * The register-wide counterpart to `ShareLeadDialog`, which shares one enquiry.
 * Both are kept: sharing a single quotation with a colleague and handing a whole
 * desk to a team are different acts, and collapsing them into one screen would
 * make the smaller one feel as consequential as the larger.
 *
 * ## Two steps, because the blast radius is large
 *
 * Picking people is reversible; applying the grant to several thousand
 * enquiries is the part worth pausing on. So the dialog selects first and
 * confirms second, and the confirmation states both numbers — how many people
 * and how many enquiries — before the button that does it.
 *
 * ## Additive, and the wording says so
 *
 * The endpoint adds the selected people and removes nobody, so this screen
 * cannot un-share anything. That is stated in the confirmation rather than left
 * for the reader to infer from an absence, because "share with these three"
 * reasonably reads as "and only these three". Removing access stays on the
 * single-enquiry dialog, where the reader can see whom they are removing.
 *
 * ## Online only
 *
 * Like single-enquiry sharing: this is an access-control change against the
 * server's own register, and the offline cache holds one user's owned rows from
 * an owner-scoped feed. Nothing here touches the sync queue.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CloudOff, Share2, Users } from 'lucide-react'

import { AdminModal } from '@/admin/components/AdminModal'
import { AssignPicker } from '@/admin/components/mailboxes/AssignPicker'
import { UserAvatar } from '@/components/common/UserAvatar'
import { Button } from '@/components/ui/Button'
import { bulkShareLeads, fetchShareableUsers } from '@/api/services/lead.service'
import { isCancelledError } from '@/utils/apiError'

/**
 * Turns a failure into something the operator can act on.
 *
 * Each branch is a different situation and a different next step, so they are
 * worded separately rather than collapsed into the server's message — which for
 * a 401 or a dropped connection is not something a person can act on.
 */
function describeFailure(error) {
  if (error?.isNetwork) {
    return 'Could not reach the server. Check your connection and try again — nothing was changed.'
  }

  const status = error?.status

  if (status === 401) return 'Your session has expired. Sign in again and retry — nothing was changed.'
  if (status === 403) return 'Only a manager can share their whole register at once.'

  return (
    error?.response?.data?.message ??
    error?.message ??
    'The enquiries could not be shared. Nothing was changed.'
  )
}

/**
 * @param {{
 *   isOpen: boolean,
 *   onClose: () => void,
 *   leadCount: number,
 *   isOffline?: boolean,
 *   onShared?: (summary: { updatedCount: number, userIds: string[] }) => void,
 * }} props
 */
export function BulkShareLeadsDialog({
  isOpen,
  onClose,
  leadCount = 0,
  isOffline = false,
  onShared,
}) {
  const [users, setUsers] = useState([])
  const [selected, setSelected] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState(null)
  /** `false` while choosing people, `true` on the confirmation step. */
  const [isConfirming, setIsConfirming] = useState(false)

  // Loaded when the dialog opens rather than with the register, so a reader who
  // never shares anything never fetches the people list.
  useEffect(() => {
    if (!isOpen || isOffline) return undefined

    const controller = new AbortController()
    setIsLoading(true)
    setError(null)
    setSelected([])
    setIsConfirming(false)

    fetchShareableUsers({ signal: controller.signal })
      .then((data) => setUsers(data?.items ?? []))
      .catch((caught) => {
        if (isCancelledError(caught)) return
        setError(describeFailure(caught))
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })

    return () => controller.abort()
  }, [isOpen, isOffline])

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

  const allIds = useMemo(() => options.map((option) => option.id), [options])
  const allSelected = allIds.length > 0 && selected.length === allIds.length

  const share = useCallback(async () => {
    setIsSaving(true)
    setError(null)

    try {
      const result = await bulkShareLeads(selected)
      onShared?.({
        updatedCount: result?.updatedCount ?? 0,
        userIds: result?.userIds ?? selected,
      })
      onClose()
    } catch (caught) {
      setError(describeFailure(caught))
      // Back to the picker: the confirmation panel has no controls to correct
      // whatever went wrong, and leaving the reader on it is a dead end.
      setIsConfirming(false)
    } finally {
      setIsSaving(false)
    }
  }, [selected, onShared, onClose])

  /** The register is empty, so there is nothing a grant could cover. */
  const hasNoLeads = leadCount === 0

  return (
    <AdminModal
      isOpen={isOpen}
      onClose={onClose}
      busy={isSaving}
      title="Share My Leads"
      description="Give selected users access to all Leads owned by you."
      footer={
        <>
          <Button
            variant="secondary"
            size="sm"
            onClick={isConfirming ? () => setIsConfirming(false) : onClose}
            disabled={isSaving}
          >
            {isConfirming ? 'Back' : 'Cancel'}
          </Button>

          {isConfirming ? (
            <Button size="sm" onClick={share} isLoading={isSaving} disabled={isSaving}>
              <Share2 className="size-3.5" aria-hidden="true" />
              Share All My Leads
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => setIsConfirming(true)}
              disabled={isLoading || isOffline || hasNoLeads || selected.length === 0}
            >
              <Share2 className="size-3.5" aria-hidden="true" />
              Share All My Leads
            </Button>
          )}
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

          {hasNoLeads ? (
            <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600 ring-1 ring-inset ring-slate-200">
              You don’t own any enquiries yet, so there is nothing to share.
            </p>
          ) : isConfirming ? (
            /* --- Step 2: what is about to happen --------------------------- */
            <div className="space-y-3">
              <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-inset ring-amber-200">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>
                  You are about to share all of your Leads with{' '}
                  <span className="font-semibold">
                    {selected.length} user{selected.length === 1 ? '' : 's'}
                  </span>
                  . This will affect{' '}
                  <span className="font-semibold">
                    {leadCount.toLocaleString()} Lead{leadCount === 1 ? '' : 's'}
                  </span>
                  .
                </span>
              </p>

              <ul className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
                {options
                  .filter((option) => selected.includes(option.id))
                  .map((option) => (
                    <li key={option.id} className="flex items-center gap-2.5 px-1.5 py-1 text-sm">
                      {option.leading}
                      <span className="min-w-0 flex-1 truncate text-slate-800">{option.primary}</span>
                      {option.secondary && (
                        <span className="truncate text-xs text-slate-400">{option.secondary}</span>
                      )}
                    </li>
                  ))}
              </ul>

              {/* Said explicitly: this screen only ever adds. */}
              <p className="text-xs text-slate-500">
                You stay the owner of every enquiry. Anyone already shared on a Lead keeps their
                access — this only adds people.
              </p>
            </div>
          ) : (
            /* --- Step 1: choose the people --------------------------------- */
            <>
              <p className="mb-3 flex items-center gap-2 text-xs text-slate-500">
                <Users className="size-3.5 shrink-0" aria-hidden="true" />
                {leadCount.toLocaleString()} Lead{leadCount === 1 ? '' : 's'} owned by you will be
                shared.
              </p>

              {isLoading ? (
                <div className="space-y-2" aria-busy="true">
                  {Array.from({ length: 5 }, (_, index) => (
                    <div key={index} className="h-11 animate-pulse rounded-lg bg-slate-100" />
                  ))}
                </div>
              ) : options.length === 0 ? (
                <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600 ring-1 ring-inset ring-slate-200">
                  There is nobody to share your enquiries with yet. Colleagues appear here once they
                  have an active account with CRM access.
                </p>
              ) : (
                <>
                  {/*
                    Select all / Clear live here rather than inside
                    `AssignPicker`, which is the mailbox screen's component and
                    is shared with the admin console. Adding controls to it for
                    one caller would change a screen this work is not allowed to
                    touch; they operate on the same value, so the behaviour is
                    identical either way.
                  */}
                  <div className="mb-2 flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setSelected(allSelected ? [] : allIds)}
                    >
                      {allSelected ? 'Clear all' : 'Select all'}
                    </Button>
                    {selected.length > 0 && (
                      <Button variant="ghost" size="sm" onClick={() => setSelected([])}>
                        Clear selection
                      </Button>
                    )}
                    <span className="ml-auto text-xs font-medium text-slate-600">
                      {selected.length} user{selected.length === 1 ? '' : 's'} selected
                    </span>
                  </div>

                  <AssignPicker
                    options={options}
                    value={selected}
                    onChange={setSelected}
                    searchPlaceholder="Search people…"
                    emptyMessage="There is nobody to share with."
                  />
                </>
              )}
            </>
          )}
        </>
      )}
    </AdminModal>
  )
}

export default BulkShareLeadsDialog
