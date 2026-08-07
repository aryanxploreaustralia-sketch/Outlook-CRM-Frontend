/**
 * Contact groups.
 *
 * Create, rename, recolour and delete groups. Membership is managed from a
 * contact's own page and from bulk selection on the list, which is where a user
 * is when they decide something belongs in a group.
 */

import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, Users } from 'lucide-react'

import { createGroup, deleteGroup, fetchGroups, updateGroup } from '@/api/services/contact.service'
import { ErrorScreen } from '@/components/common/ErrorScreen'
import { Button } from '@/components/ui/Button'
import { useApiResource } from '@/hooks/useApiResource'
import { ROUTE_PATHS } from '@/routes/paths'
import { resolveErrorVariant } from '@/utils/apiError'

/** The palette offered when creating a group. Mirrors GROUP_COLORS server-side. */
const COLORS = [
  '#2563eb', '#7c3aed', '#db2777', '#dc2626',
  '#ea580c', '#ca8a04', '#16a34a', '#0891b2', '#475569',
]

export function ContactGroupsPage() {
  const [isCreating, setIsCreating] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState(COLORS[0])
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState(null)

  const fetcher = useCallback(({ signal }) => fetchGroups({ limit: 100 }, { signal }), [])
  const { data, isInitialLoading, isError, error: loadError, refresh } = useApiResource(fetcher)

  const groups = data?.items ?? []

  const handleCreate = useCallback(
    async (event) => {
      event.preventDefault()
      if (!name.trim()) return

      setIsCreating(true)
      setError(null)

      try {
        await createGroup({ name: name.trim(), description: description.trim() || null, color })
        setName('')
        setDescription('')
        setColor(COLORS[0])
        await refresh({ isBackground: true })
      } catch (caught) {
        setError(caught)
      } finally {
        setIsCreating(false)
      }
    },
    [name, description, color, refresh],
  )

  const handleDelete = useCallback(
    async (group) => {
      if (!window.confirm(`Delete the group “${group.name}”? Its contacts are not affected.`)) return

      setBusyId(group.id)
      try {
        await deleteGroup(group.id)
        await refresh({ isBackground: true })
      } catch (caught) {
        setError(caught)
      } finally {
        setBusyId(null)
      }
    },
    [refresh],
  )

  const handleRecolour = useCallback(
    async (group, nextColor) => {
      setBusyId(group.id)
      try {
        await updateGroup(group.id, { color: nextColor })
        await refresh({ isBackground: true })
      } finally {
        setBusyId(null)
      }
    },
    [refresh],
  )

  if (isError && groups.length === 0) {
    return (
      <ErrorScreen variant={resolveErrorVariant(loadError)} message={loadError?.message} onRetry={refresh} />
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Link
        to={ROUTE_PATHS.CONTACTS}
        className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 transition-colors hover:text-brand-600"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        Contacts
      </Link>

      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
          Contact groups
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Organise contacts into named lists. Deleting a group never deletes its contacts.
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800">
          {error.message}
        </p>
      )}

      {/* --- Create --------------------------------------------------------- */}
      <form onSubmit={handleCreate} className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">New group</h2>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Name</span>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Key Accounts"
              maxLength={128}
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Description</span>
            <input
              type="text"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Optional"
              maxLength={1000}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
            />
          </label>
        </div>

        <div>
          <span className="mb-1.5 block text-xs font-medium text-slate-600">Colour</span>
          <div className="flex flex-wrap gap-2">
            {COLORS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setColor(option)}
                aria-label={`Use colour ${option}`}
                aria-pressed={color === option}
                style={{ backgroundColor: option }}
                className={`size-7 rounded-full transition-transform ${
                  color === option ? 'scale-110 ring-2 ring-slate-900 ring-offset-2' : ''
                }`}
              />
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <Button type="submit" isLoading={isCreating} disabled={!name.trim()}>
            <Plus className="size-4" aria-hidden="true" />
            Create group
          </Button>
        </div>
      </form>

      {/* --- List ----------------------------------------------------------- */}
      {isInitialLoading ? (
        <div className="space-y-2" aria-busy="true">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-16 animate-pulse rounded-lg bg-slate-200/70" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white py-10 text-center">
          <Users className="mx-auto size-8 text-slate-300" aria-hidden="true" />
          <p className="mt-3 text-sm font-medium text-slate-700">No groups yet</p>
          <p className="mt-1 text-sm text-slate-500">Create one above to start organising contacts.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {groups.map((group) => (
            <li
              key={group.id}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3"
            >
              <span
                className="size-3 shrink-0 rounded-full"
                style={{ backgroundColor: group.color }}
                aria-hidden="true"
              />

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900">{group.name}</p>
                {group.description && (
                  <p className="truncate text-xs text-slate-500">{group.description}</p>
                )}
              </div>

              <Link
                to={`${ROUTE_PATHS.CONTACTS}?group=${group.id}`}
                className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-200"
              >
                {group.memberCount} member{group.memberCount === 1 ? '' : 's'}
              </Link>

              <div className="flex shrink-0 gap-1">
                {COLORS.slice(0, 5).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => handleRecolour(group, option)}
                    aria-label={`Recolour ${group.name}`}
                    style={{ backgroundColor: option }}
                    className="size-4 rounded-full opacity-40 transition-opacity hover:opacity-100"
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={() => handleDelete(group)}
                disabled={busyId === group.id}
                aria-label={`Delete ${group.name}`}
                className="grid size-7 shrink-0 place-items-center rounded text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default ContactGroupsPage
