/**
 * Take back access to every enquiry this manager owns.
 *
 * The mirror of `BulkShareLeadsDialog`, and deliberately a separate screen
 * rather than a second mode inside it. Giving access and taking it away are
 * opposite intentions, and a single dialog that does both depending on which
 * button is pressed is how somebody revokes a team by accident.
 *
 * ## Only ever narrows
 *
 * The endpoint pulls the selected people out of `sharedWith` and touches
 * nothing else — colleagues who are not selected keep their access, ownership
 * does not move, and no enquiry is deleted. The dialog says all of that before
 * the confirm button, because "remove access to all my Leads" is a sentence
 * people should be able to check before they act on it.
 *
 * ## Who already has access is shown, not guessed
 *
 * The bulk preview returns `sharedUserIds` — the distinct set across this
 * register — so colleagues who actually hold something are listed first and
 * marked. Without it the reader would be picking names out of the whole
 * directory with no idea which of them had anything to lose.
 *
 * Online only, like every other sharing action.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CloudOff, UserMinus, Users } from 'lucide-react'

import { AdminModal } from '@/admin/components/AdminModal'
import { AssignPicker } from '@/admin/components/mailboxes/AssignPicker'
import { UserAvatar } from '@/components/common/UserAvatar'
import { Button } from '@/components/ui/Button'
import { bulkRevokeLeadSharing, fetchShareableUsers } from '@/api/services/lead.service'
import { isCancelledError } from '@/utils/apiError'

/** Turns a failure into something the operator can act on. */
function describeFailure(error) {
  if (error?.isNetwork) {
    return 'Could not reach the server. Check your connection and try again — nothing was changed.'
  }

  const status = error?.status

  if (status === 401) return 'Your session has expired. Sign in again and retry — nothing was changed.'
  if (status === 403) return 'Only a manager can manage sharing across their whole register.'

  return (
    error?.response?.data?.message ??
    error?.message ??
    'The access could not be removed. Nothing was changed.'
  )
}

/**
 * @param {{
 *   isOpen: boolean,
 *   onClose: () => void,
 *   leadCount: number,
 *   sharedUserIds?: string[],
 *   isOffline?: boolean,
 *   onRevoked?: (summary: { modifiedCount: number, userIds: string[] }) => void,
 * }} props
 */
export function ManageLeadSharingDialog({
  isOpen,
  onClose,
  leadCount = 0,
  sharedUserIds = [],
  isOffline = false,
  onRevoked,
}) {
  const [users, setUsers] = useState([])
  const [selected, setSelected] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState(null)
  const [isConfirming, setIsConfirming] = useState(false)

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

  const holders = useMemo(() => new Set(sharedUserIds.map(String)), [sharedUserIds])

  /**
   * Colleagues who hold access first, then everybody else.
   *
   * Removing access from somebody who has none is a no-op, so the people worth
   * looking at are listed together at the top and labelled. The rest stay
   * selectable — a stale preview must not make a genuine revoke impossible.
   */
  const options = useMemo(() => {
    const mapped = users.map((user) => ({
      id: String(user.id),
      primary: user.name,
      secondary: holders.has(String(user.id))
        ? `${user.email ?? ''}${user.email ? ' · ' : ''}has access`
        : (user.email ?? undefined),
      leading: <UserAvatar name={user.name} email={user.email} size="sm" />,
      _holds: holders.has(String(user.id)),
    }))

    return [...mapped].sort((a, b) => Number(b._holds) - Number(a._holds))
  }, [users, holders])

  const holderIds = useMemo(
    () => options.filter((option) => option._holds).map((option) => option.id),
    [options],
  )

  const revoke = useCallback(async () => {
    setIsSaving(true)
    setError(null)

    try {
      const result = await bulkRevokeLeadSharing(selected)
      onRevoked?.({
        modifiedCount: result?.modifiedCount ?? 0,
        userIds: result?.userIds ?? selected,
      })
      onClose()
    } catch (caught) {
      setError(describeFailure(caught))
      // Back to the picker: the confirmation panel has no control that could
      // correct whatever went wrong.
      setIsConfirming(false)
    } finally {
      setIsSaving(false)
    }
  }, [selected, onRevoked, onClose])

  const hasNoLeads = leadCount === 0

  return (
    <AdminModal
      isOpen={isOpen}
      onClose={onClose}
      busy={isSaving}
      title="Manage Lead Sharing"
      description="Remove users’ access to the Leads owned by you."
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
            <Button variant="danger" size="sm" onClick={revoke} isLoading={isSaving} disabled={isSaving}>
              <UserMinus className="size-3.5" aria-hidden="true" />
              Remove Access
            </Button>
          ) : (
            <Button
              variant="danger"
              size="sm"
              onClick={() => setIsConfirming(true)}
              disabled={isLoading || isOffline || hasNoLeads || selected.length === 0}
            >
              <UserMinus className="size-3.5" aria-hidden="true" />
              Remove Access
            </Button>
          )}
        </>
      }
    >
      {isOffline ? (
        <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-inset ring-amber-200">
          <CloudOff className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            Managing sharing needs a connection. Reopen this once you’re back online.
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
              You don’t own any enquiries yet, so there is no access to manage.
            </p>
          ) : isConfirming ? (
            /* --- Step 2: what is about to happen --------------------------- */
            <div className="space-y-3">
              <p className="flex items-start gap-2 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-900 ring-1 ring-inset ring-rose-200">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>
                  You are about to remove access to your Leads for{' '}
                  <span className="font-semibold">
                    {selected.length} user{selected.length === 1 ? '' : 's'}
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
                      {!option._holds && (
                        <span className="shrink-0 text-xs text-slate-400">no access to remove</span>
                      )}
                    </li>
                  ))}
              </ul>

              <p className="text-xs text-slate-500">
                Nothing is deleted and you stay the owner of every enquiry. Colleagues you have not
                selected keep their access.
              </p>
            </div>
          ) : (
            /* --- Step 1: choose the people --------------------------------- */
            <>
              <p className="mb-3 flex items-center gap-2 text-xs text-slate-500">
                <Users className="size-3.5 shrink-0" aria-hidden="true" />
                {holderIds.length === 0
                  ? `None of your ${leadCount.toLocaleString()} Leads are shared with anyone.`
                  : `${holderIds.length} user${holderIds.length === 1 ? '' : 's'} currently ${
                      holderIds.length === 1 ? 'has' : 'have'
                    } access to some of your ${leadCount.toLocaleString()} Leads.`}
              </p>

              {isLoading ? (
                <div className="space-y-2" aria-busy="true">
                  {Array.from({ length: 5 }, (_, index) => (
                    <div key={index} className="h-11 animate-pulse rounded-lg bg-slate-100" />
                  ))}
                </div>
              ) : options.length === 0 ? (
                <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600 ring-1 ring-inset ring-slate-200">
                  There are no other users in the CRM yet.
                </p>
              ) : (
                <>
                  <div className="mb-2 flex items-center gap-2">
                    {/* Selects everybody who actually holds access — the common
                        case, and far more useful here than "select all". */}
                    {holderIds.length > 0 && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() =>
                          setSelected(
                            holderIds.every((id) => selected.includes(id)) ? [] : holderIds,
                          )
                        }
                      >
                        {holderIds.every((id) => selected.includes(id))
                          ? 'Clear all'
                          : 'Select everyone with access'}
                      </Button>
                    )}
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
                    emptyMessage="There is nobody to remove."
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

export default ManageLeadSharingDialog
