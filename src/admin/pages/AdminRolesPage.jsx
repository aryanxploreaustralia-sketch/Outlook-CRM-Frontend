/**
 * Roles and permissions.
 *
 * ## This screen renders what is actually enforced
 *
 * Phase 14.1 described the designed hierarchy from a static constant, and 14.3A
 * added real member counts beside it. Both were honest at the time, and both
 * could drift from the code that decides access.
 *
 * The matrix now comes from `GET /admin/roles`, derived server-side from the
 * same `roleMatrix.js` the middleware resolves on every request. A role's
 * permission list on this page and the answer a guard gives are the same data —
 * they cannot disagree.
 *
 * ## Editable, over a matrix that is still the default
 *
 * The roles began as constants and still are: `roleMatrix.js` defines every
 * bundle, and a role nobody has changed resolves from it exactly as before.
 * What was added is a sparse override table — a role is stored only once
 * somebody departs from the default, and the built-in matrix remains the
 * fallback and the definition of "reset".
 *
 * So the checkboxes here change what the server enforces, not a second
 * description of it. `permissionsForRole()` reads the override; every guard in
 * the product reads `permissionsForRole()`.
 *
 * ## Every rule shown here is also a rule there
 *
 * Owner is not editable, nobody edits their own role, and nobody grants a
 * permission they do not themselves hold. This page reflects those so a reader
 * is not offered something that will be refused — but it decides none of them.
 * The server re-checks each against the request's own actor, so a client that
 * ignored all three would still be refused.
 *
 * There is deliberately **no** list of permissions that are too important to
 * edit. `users.invite` was one until it became clear that a permission nobody
 * can grant is not a safety feature, it is a missing feature with a padlock on
 * it. What made it dangerous — an invitation naming any role at all — is now
 * checked where invitations are created, against the inviter's own rank.
 */

import { useCallback, useMemo, useState } from 'react'
import { AlertTriangle, Lock, RefreshCw, ShieldCheck } from 'lucide-react'

import {
  AdminBadge,
  AdminCard,
  AdminErrorState,
  AdminListLoading,
  AdminPageContainer,
  AdminSection,
  AdminStatCard,
} from '@/admin/components'
import { PermissionList } from '@/admin/components/users/PermissionList'
import { ADMIN_TONE } from '@/admin/constants/admin.constants'
import { useAdminBreadcrumbs, useAdminResource } from '@/admin/hooks'
import { usePermissions } from '@/admin/hooks/usePermissions'
import {
  fetchAdminRoles,
  fetchAdminUsers,
  updateAdminRolePermissions,
} from '@/admin/services/admin.service'
import { formatCount } from '@/admin/utils/format'
import { Button } from '@/components/ui/Button'

export function AdminRolesPage() {
  const breadcrumb = useAdminBreadcrumbs()
  const { role: myRole, permissions: myPermissions, groups, catalogue, can } = usePermissions()

  const loader = useCallback((options) => fetchAdminRoles(options), [])
  const { data, error, isLoading, isRefreshing, refresh } = useAdminResource(loader)

  /**
   * Member counts, fetched separately and only when permitted.
   *
   * The roles endpoint deliberately does not carry them: it describes the model,
   * and the model is the same whether anybody holds a role or not. Somebody with
   * `roles.view` but not `users.view` still gets the full matrix — they simply do
   * not get told who is in it.
   */
  const canReadUsers = can('users.view')

  const usersLoader = useCallback((options) => fetchAdminUsers({ limit: 100, ...options }), [])
  const { data: userData } = useAdminResource(usersLoader, { enabled: canReadUsers })

  const counts = useMemo(() => {
    const byRole = new Map()
    for (const user of userData?.items ?? []) {
      byRole.set(user.role, (byRole.get(user.role) ?? 0) + 1)
    }
    return byRole
  }, [userData])

  const canManageRoles = can('roles.manage')

  /**
   * The permission sets currently on screen.
   *
   * Seeded from the response and updated optimistically, so a tick responds
   * immediately rather than after a round trip. `null` means "nothing has been
   * edited yet, use the server's answer" — which is what makes Refresh and a
   * background reload able to replace the whole table without stale local edits
   * surviving underneath.
   */
  const [draft, setDraft] = useState(null)
  const [pending, setPending] = useState(new Set())
  const [notice, setNotice] = useState(null)

  const permissionsOf = useCallback(
    (entry) => draft?.[entry.role] ?? entry.permissions,
    [draft],
  )

  /**
   * Applies a change and persists it, reverting precisely if the server refuses.
   *
   * The revert restores the list the change was computed from rather than
   * removing the one permission — a concurrent edit could otherwise leave the
   * screen showing a set that never existed on either side. Rule 13: what is on
   * screen after a failure is what the server holds.
   */
  const applyChange = useCallback(
    async (entry, nextPermissions, touched) => {
      const previous = permissionsOf(entry)

      setNotice(null)
      setDraft((current) => ({ ...current, [entry.role]: nextPermissions }))
      setPending((current) => new Set([...current, ...touched]))

      try {
        const result = await updateAdminRolePermissions(entry.role, nextPermissions)

        // Reconcile against what the server actually stored, not what was sent.
        setDraft((current) => ({ ...current, [entry.role]: result?.permissions ?? nextPermissions }))
      } catch (thrown) {
        setDraft((current) => ({ ...current, [entry.role]: previous }))
        setNotice(thrown?.message ?? 'That permission could not be changed.')
      } finally {
        setPending((current) => {
          const next = new Set(current)
          for (const permission of touched) next.delete(permission)
          return next
        })
      }
    },
    [permissionsOf],
  )

  const togglePermission = useCallback(
    (entry, permission, granted) => {
      const current = permissionsOf(entry)
      const next = granted
        ? [...current, permission]
        : current.filter((held) => held !== permission)

      return applyChange(entry, next, [permission])
    },
    [applyChange, permissionsOf],
  )

  const toggleGroup = useCallback(
    (entry, permissions, granted) => {
      const current = new Set(permissionsOf(entry))
      for (const permission of permissions) {
        if (granted) current.add(permission)
        else current.delete(permission)
      }

      return applyChange(entry, [...current], permissions)
    },
    [applyChange, permissionsOf],
  )

  const actions = (
    <Button variant="secondary" size="sm" onClick={refresh} isLoading={isRefreshing}>
      <RefreshCw className="size-3.5" aria-hidden="true" />
      Refresh
    </Button>
  )

  if (error) {
    return (
      <AdminPageContainer
        title="Roles & permissions"
        subtitle="Manage and review access permissions."
        breadcrumb={breadcrumb}
        actions={actions}
      >
        <AdminErrorState error={error} onRetry={refresh} />
      </AdminPageContainer>
    )
  }

  const roles = data?.roles ?? []
  const mine = roles.find((entry) => entry.role === myRole)

  return (
    <AdminPageContainer
      title="Roles & permissions"
      subtitle="Manage and review access permissions."
      breadcrumb={breadcrumb}
      isRefreshing={isRefreshing}
      actions={actions}
    >
      {/*
        A refusal, shown once at the top rather than beside the checkbox.
        The control has already snapped back to what the server holds, so this
        is the only thing left to explain — and the server's own message is
        specific ("would leave no active user able to administer this
        deployment"), which is far more useful than a generic failure.
      */}
      {notice && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden="true" />
          <div className="min-w-0">
            <p className="font-medium text-amber-900">That change was not applied</p>
            <p className="mt-0.5 text-amber-800">{notice}</p>
          </div>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="ml-auto shrink-0 rounded px-2 py-0.5 text-xs font-medium text-amber-800 hover:bg-amber-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* --- Your own access ------------------------------------------------ */}
      {/* The three figures stand on their own above the detail rather than
          inside a section with it. They answer "who am I here" in one line;
          the panel below answers "what does that get me". */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <AdminStatCard label="My role" value={mine?.label ?? myRole ?? '—'} tone={ADMIN_TONE.BRAND} />
        <AdminStatCard label="Permissions held" value={formatCount(myPermissions.size)} />
        <AdminStatCard
          label="Roles defined"
          value={formatCount(roles.length)}
          isLoading={isLoading}
        />
      </div>

      <AdminSection title="Your permissions" description="Access available to your current role.">
        {/*
          `padded={false}` because the panel's own rows carry the gutter: each
          category header is a full-width target, and a card inset would leave
          its hover state floating in a margin instead of filling the row.
        */}
        <AdminCard padded={false}>
          <PermissionList
            variant="grouped"
            groups={groups}
            catalogue={catalogue}
            granted={myPermissions}
            emptyMessage="Your role grants no permissions."
          />
        </AdminCard>
      </AdminSection>

      {/* --- The matrix ------------------------------------------------------ */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <AdminCard key={index}>
              <AdminListLoading rows={5} />
            </AdminCard>
          ))}
        </div>
      ) : (
        <AdminSection
          title="System roles"
          description="Ordered most privileged first. A tick is granted; a cross is withheld."
        >
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {roles.map((entry) => {
              const held = counts.get(entry.role) ?? 0
              const isMine = entry.role === myRole
              const permissions = permissionsOf(entry)

              /*
               * Why this role's checkboxes are or are not offered.
               *
               * Each of these mirrors a server rule, and the reason is shown
               * rather than the control simply being absent — "System" on a card
               * with no explanation is what makes an administrator think the
               * feature is broken instead of deliberate.
               */
              const lockReason = !canManageRoles
                ? 'You need roles.manage'
                : !entry.editable
                  ? entry.role === 'owner'
                    ? 'Owner is the recovery path and cannot be changed'
                    : 'Protected role'
                  : isMine
                    ? 'You cannot edit your own role'
                    : null

              const editable = lockReason === null

              /*
               * The only permissions withheld here are ones the actor does not
               * hold themselves — granting those would be escalation, and an
               * Owner holds everything, so an Owner sees no padlocks at all.
               *
               * Nothing is withheld for being "important". `users.invite` is an
               * ordinary checkbox on every role now; the escalation it used to
               * carry is blocked at the invite endpoint instead, which applies
               * the inviter's own role ceiling.
               */
              const locked = new Set(
                Object.keys(catalogue ?? {}).filter(
                  (permission) => !myPermissions.has(permission),
                ),
              )

              return (
                <AdminCard
                  key={entry.role}
                  className={isMine ? 'ring-1 ring-brand-500/40' : ''}
                  title={
                    <span className="flex flex-wrap items-center gap-2">
                      {entry.label}
                      {isMine && <AdminBadge tone="brand">Your role</AdminBadge>}
                      {entry.adminAccess ? (
                        <AdminBadge tone="violet">
                          <ShieldCheck className="size-3" aria-hidden="true" />
                          Admin console
                        </AdminBadge>
                      ) : (
                        <AdminBadge tone="neutral">CRM only</AdminBadge>
                      )}
                    </span>
                  }
                  // Counted from what is on screen, so it moves with each tick.
                  description={`${permissions.length} of ${Object.keys(catalogue).length} permissions`}
                  action={
                    lockReason ? (
                      <span
                        className="flex items-center gap-1.5 text-xs text-slate-500"
                        title={lockReason}
                      >
                        <Lock className="size-3.5" aria-hidden="true" />
                        {lockReason}
                      </span>
                    ) : entry.customised ? (
                      <AdminBadge tone="warning">Customised</AdminBadge>
                    ) : (
                      <span className="text-xs text-slate-400">Default</span>
                    )
                  }
                  footer={
                    canReadUsers ? (
                      <span className="text-xs text-slate-600">
                        {held > 0 ? (
                          <>
                            <span className="font-medium text-slate-900">{held}</span> account
                            {held === 1 ? '' : 's'} hold this role
                          </>
                        ) : (
                          <span className="text-slate-400">Nobody holds this role yet</span>
                        )}
                      </span>
                    ) : null
                  }
                >
                  {/* `showMissing` renders the full catalogue with the absences
                      struck through — on this screen the question is as much
                      "what does this role *not* include?" as what it does. */}
                  <PermissionList
                    groups={groups}
                    catalogue={catalogue}
                    granted={permissions}
                    showMissing
                    editable={editable}
                    locked={locked}
                    lockedReason="Reserved to the Owner, or beyond your own permissions — the server refuses it either way."
                    pending={pending}
                    onToggle={(permission, granted) => togglePermission(entry, permission, granted)}
                    onToggleGroup={(list, granted) => toggleGroup(entry, list, granted)}
                  />
                </AdminCard>
              )
            })}
          </div>
        </AdminSection>
      )}
    </AdminPageContainer>
  )
}

export default AdminRolesPage
