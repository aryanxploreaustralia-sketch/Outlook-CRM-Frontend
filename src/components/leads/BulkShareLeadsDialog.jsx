/**
 * Who this manager's whole register is shared with.
 *
 * One dialog, one question: tick the colleagues who should have access. A tick
 * grants it, an un-tick takes it back, and Save applies both — so there is no
 * separate "remove access" screen to find, and no way to be looking at the
 * wrong one.
 *
 * ## The checkboxes are the state, not a queue of actions
 *
 * It opens showing what is true right now: everybody who currently holds access
 * arrives ticked. Whatever the boxes say when Save is pressed is what the
 * register will be shared with.
 *
 * ## Only what actually changed is sent as a change
 *
 * The server computes the difference against what is genuinely shared, which
 * matters more than it looks. A colleague may hold access to three enquiries
 * out of a thousand; they still show as one ticked box, and re-saving without
 * touching them must not quietly promote them to the whole register. Leaving a
 * tick alone therefore changes nothing at all.
 *
 * ## Two steps, because the blast radius is large
 *
 * Ticking is reversible; applying it across a few thousand enquiries is the
 * part worth pausing on. The confirmation names both halves separately — who is
 * gaining access and who is losing it — because those are different things to
 * agree to.
 *
 * Online only, like every other sharing action. Nothing here touches the sync
 * queue.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CloudOff, UserMinus, UserPlus, Users } from 'lucide-react'

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
 * worded separately rather than passed through from the server — which for a
 * 401 or a dropped connection says nothing a person can act on.
 */
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
    'The sharing could not be saved. Nothing was changed.'
  )
}

/**
 * @param {{
 *   isOpen: boolean,
 *   onClose: () => void,
 *   leadCount: number,
 *   sharedUserIds?: string[],
 *   isOffline?: boolean,
 *   onSaved?: (summary: {
 *     modifiedCount: number, added: string[], removed: string[], userIds: string[],
 *   }) => void,
 * }} props
 */
export function BulkShareLeadsDialog({
  isOpen,
  onClose,
  leadCount = 0,
  sharedUserIds = [],
  isOffline = false,
  onSaved,
}) {
  const [users, setUsers] = useState([])
  const [selected, setSelected] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState(null)
  /** `false` while choosing, `true` on the confirmation step. */
  const [isConfirming, setIsConfirming] = useState(false)

  /**
   * Who held access when the dialog opened.
   *
   * Frozen at open rather than read live from the prop, so the diff shown in
   * the footer is measured against the state the reader actually saw.
   */
  const [initial, setInitial] = useState([])

  // Loaded when the dialog opens rather than with the register, so a reader who
  // never shares anything never fetches the people list.
  useEffect(() => {
    if (!isOpen || isOffline) return undefined

    const controller = new AbortController()
    setIsLoading(true)
    setError(null)
    setIsConfirming(false)

    const held = (sharedUserIds ?? []).map(String)
    setSelected(held)
    setInitial(held)

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
    // `sharedUserIds` is intentionally not a dependency: the snapshot is taken
    // once per opening, and a background refresh must not move it underneath
    // somebody who is mid-selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isOffline])

  const holders = useMemo(() => new Set(initial), [initial])

  /** Colleagues who already hold access first, then everybody else. */
  const options = useMemo(() => {
    const mapped = users.map((user) => ({
      id: String(user.id),
      primary: user.name,
      secondary: user.email ?? undefined,
      leading: <UserAvatar name={user.name} email={user.email} size="sm" />,
      _holds: holders.has(String(user.id)),
    }))

    return [...mapped].sort((a, b) => Number(b._holds) - Number(a._holds))
  }, [users, holders])

  const allIds = useMemo(() => options.map((option) => option.id), [options])
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.includes(id))

  const added = useMemo(() => selected.filter((id) => !initial.includes(id)), [selected, initial])
  const removed = useMemo(() => initial.filter((id) => !selected.includes(id)), [selected, initial])
  const hasChanges = added.length > 0 || removed.length > 0

  const nameOf = useCallback(
    (id) => options.find((option) => option.id === id)?.primary ?? 'Unknown user',
    [options],
  )

  const save = useCallback(async () => {
    setIsSaving(true)
    setError(null)

    try {
      const result = await bulkShareLeads(selected)
      onSaved?.({
        modifiedCount: result?.modifiedCount ?? 0,
        added: result?.added ?? added,
        removed: result?.removed ?? removed,
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
  }, [selected, added, removed, onSaved, onClose])

  const hasNoLeads = leadCount === 0

  return (
    <AdminModal
      isOpen={isOpen}
      onClose={onClose}
      busy={isSaving}
      title="Share My Leads"
      description="Choose who has access to all Leads owned by you. Ticking grants access; un-ticking removes it."
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
            <Button size="sm" onClick={save} isLoading={isSaving} disabled={isSaving}>
              Save Changes
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => setIsConfirming(true)}
              disabled={isLoading || isOffline || hasNoLeads || !hasChanges}
            >
              Save Changes
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
            /* --- Step 2: the two halves, stated separately ------------------ */
            <div className="space-y-3">
              <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-inset ring-amber-200">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>
                  This will change access across{' '}
                  <span className="font-semibold">
                    {leadCount.toLocaleString()} Lead{leadCount === 1 ? '' : 's'}
                  </span>{' '}
                  owned by you.
                </span>
              </p>

              {added.length > 0 && (
                <div>
                  <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                    <UserPlus className="size-3.5" aria-hidden="true" />
                    Gaining access ({added.length})
                  </p>
                  <ul className="max-h-32 space-y-0.5 overflow-y-auto rounded-lg border border-emerald-200 bg-emerald-50/40 p-2 text-sm text-slate-800">
                    {added.map((id) => (
                      <li key={id} className="truncate px-1">{nameOf(id)}</li>
                    ))}
                  </ul>
                </div>
              )}

              {removed.length > 0 && (
                <div>
                  <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-rose-700">
                    <UserMinus className="size-3.5" aria-hidden="true" />
                    Losing access ({removed.length})
                  </p>
                  <ul className="max-h-32 space-y-0.5 overflow-y-auto rounded-lg border border-rose-200 bg-rose-50/40 p-2 text-sm text-slate-800">
                    {removed.map((id) => (
                      <li key={id} className="truncate px-1">{nameOf(id)}</li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="text-xs text-slate-500">
                Nothing is deleted and you stay the owner of every enquiry. Colleagues you left
                ticked keep exactly the access they already had.
              </p>
            </div>
          ) : (
            /* --- Step 1: the permission selector ---------------------------- */
            <>
              <p className="mb-3 flex items-center gap-2 text-xs text-slate-600">
                <Users className="size-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                {initial.length === 0
                  ? `None of your ${leadCount.toLocaleString()} Leads are shared with anyone yet.`
                  : `${initial.length} user${initial.length === 1 ? '' : 's'} currently ${
                      initial.length === 1 ? 'has' : 'have'
                    } access to your ${leadCount.toLocaleString()} Leads.`}
              </p>

              {isLoading ? (
                <div className="space-y-2" aria-busy="true">
                  {Array.from({ length: 5 }, (_, index) => (
                    <div key={index} className="h-11 animate-pulse rounded-lg bg-slate-100" />
                  ))}
                </div>
              ) : options.length === 0 ? (
                <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600 ring-1 ring-inset ring-slate-200">
                  There is nobody else in the CRM to share your enquiries with yet.
                </p>
              ) : (
                <>
                  {/*
                    Select all / Clear live here rather than inside
                    `AssignPicker`, which is the mailbox screen's component and
                    is shared with the admin console. They operate on the same
                    value, so the behaviour is identical either way.
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

                  {/*
                    The pending change, before the confirmation step — so a
                    reader who un-ticked somebody by accident sees it here
                    rather than discovering it two clicks later.
                  */}
                  {hasChanges && (
                    <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                      {added.length > 0 && (
                        <span className="font-medium text-emerald-700">
                          +{added.length} gaining access
                        </span>
                      )}
                      {removed.length > 0 && (
                        <span className="font-medium text-rose-700">
                          −{removed.length} losing access
                        </span>
                      )}
                    </p>
                  )}
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
