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
 * ## Read-only, and not by omission
 *
 * System roles are constants, not documents: the brief is explicit that no
 * `Role` collection is created. There is nothing to edit, and an editor that
 * appeared to change a permission while the constant stayed put would be worse
 * than none — it would read as a control that had been set.
 */

import { useCallback, useMemo } from 'react'
import { Info, KeyRound, Lock, RefreshCw, ShieldCheck } from 'lucide-react'

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
import { fetchAdminRoles, fetchAdminUsers } from '@/admin/services/admin.service'
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
        subtitle="What each role may do"
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
      subtitle="The permission bundles this CRM enforces"
      breadcrumb={breadcrumb}
      isRefreshing={isRefreshing}
      actions={actions}
    >
      <div className="flex items-start gap-2.5 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-card">
        <Info className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden="true" />
        <div className="min-w-0 text-sm">
          <p className="font-medium text-slate-900">These roles are enforced</p>
          <p className="mt-0.5 text-slate-600">
            Every API endpoint and every screen requires a permission, and roles are the bundles
            that grant them. This table is generated from the same constants the server checks on
            each request, so it cannot describe access the server would not honour. System roles are
            fixed and cannot be edited.
          </p>
        </div>
      </div>

      {/* --- Your own access ------------------------------------------------ */}
      <AdminSection
        title="My permissions"
        description="What your account can do. Useful when a screen or button is not where you expect it."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <AdminStatCard label="My role" value={mine?.label ?? myRole ?? '—'} tone={ADMIN_TONE.BRAND} />
          <AdminStatCard label="Permissions held" value={formatCount(myPermissions.size)} />
          <AdminStatCard
            label="Roles defined"
            value={formatCount(roles.length)}
            isLoading={isLoading}
          />
        </div>

        <AdminCard
          title={
            <span className="flex items-center gap-2">
              <KeyRound className="size-4 text-slate-400" aria-hidden="true" />
              Everything your role grants
            </span>
          }
        >
          <PermissionList
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
                  description={`${entry.permissions.length} of ${Object.keys(catalogue).length} permissions`}
                  action={
                    <span className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Lock className="size-3.5" aria-hidden="true" />
                      System
                    </span>
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
                    granted={entry.permissions}
                    showMissing
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
