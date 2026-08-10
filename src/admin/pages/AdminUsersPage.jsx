/**
 * The enterprise user directory.
 *
 * Backed by `GET /api/v1/admin/users` and the two lifecycle endpoints. Search,
 * filtering, sorting and pagination all happen **on the server** — the client
 * sends parameters and renders a page. Filtering in the browser silently stops
 * being correct the moment the directory outgrows one page, because it filters
 * only the page it happens to hold.
 *
 * ## The directory's state lives in the URL
 *
 * Phase 14.5.1 moved every filter, the page and the sort out of component state
 * and into the query string. That is what makes Back work: returning from a
 * user's dashboard restores `?status=invited&page=3&sort=-lastLoginAt` because
 * the browser restored the URL, not because this component rebuilt it.
 *
 * It also makes a filtered directory shareable, and a refresh non-destructive.
 * `useScrollMemory` restores the one thing a URL cannot carry — where in the
 * list the reader had scrolled to.
 *
 * ## Rows navigate; they no longer open a drawer
 *
 * The Phase 14.3A profile drawer has been deleted. A panel could not be linked
 * to, reloaded, or navigated back out of, and it nested a scroll container
 * inside the one the shell already owns.
 */

import { useCallback, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { RefreshCw, UserCheck, UserPlus, UserX } from 'lucide-react'

import {
  AdminBadge,
  AdminCard,
  AdminEmptyState,
  AdminErrorState,
  AdminFilterBar,
  AdminFilterSelect,
  AdminPageContainer,
  AdminPagination,
  AdminSearch,
  AdminStatCard,
  AdminTable,
  AdminTableIdentity,
} from '@/admin/components'
import { Can } from '@/admin/components/Can'
import { ConfirmStatusDialog } from '@/admin/components/users/ConfirmStatusDialog'
import { InviteUserDialog } from '@/admin/components/users/InviteUserDialog'
import {
  ADMIN_PAGE_SIZE,
  ADMIN_SCOPE_NOTICE,
  ADMIN_TONE,
  ADMIN_USER_STATUS,
  ADMIN_USER_STATUS_LABELS,
  ADMIN_USER_STATUS_TONE,
} from '@/admin/constants/admin.constants'
import { ADMIN_ROLE_BADGE, ADMIN_ROLES } from '@/admin/constants/adminRoles.constants'
import { PERMISSIONS } from '@/admin/constants/permissions'
import {
  useAdminBreadcrumbs,
  useAdminResource,
  useDebouncedValue,
  useScrollMemory,
} from '@/admin/hooks'
import { usePermission } from '@/admin/hooks/usePermissions'
import { ADMIN_PATHS } from '@/admin/routes/adminPaths'
import {
  activateAdminUser,
  fetchAdminUsers,
  suspendAdminUser,
} from '@/admin/services/admin.service'
import { formatCount, formatDate, formatRelative } from '@/admin/utils/format'
import { UserAvatar } from '@/components/common/UserAvatar'
import { Button } from '@/components/ui/Button'

const STATUS_OPTIONS = Object.entries(ADMIN_USER_STATUS_LABELS).map(([value, label]) => ({
  value,
  label,
}))

/** Query-string keys and their defaults. A value equal to its default is omitted. */
const PARAM_DEFAULTS = {
  q: '',
  role: '',
  status: '',
  createdFrom: '',
  createdTo: '',
  lastLoginFrom: '',
  lastLoginTo: '',
  sort: '-createdAt',
  page: '1',
  limit: String(ADMIN_PAGE_SIZE),
}

export function AdminUsersPage() {
  const breadcrumb = useAdminBreadcrumbs()
  const navigate = useNavigate()
  const canInvite = usePermission(PERMISSIONS.USERS_INVITE)

  const [params, setParams] = useSearchParams()

  const read = useCallback(
    (key) => params.get(key) ?? PARAM_DEFAULTS[key],
    [params],
  )

  /**
   * Writes params, omitting anything at its default.
   *
   * Keeps the URL readable — `/admin/users` rather than a query string of eight
   * empty values — and means "no filters" has exactly one representation, so
   * Back never lands on a URL that looks different but means the same thing.
   */
  const write = useCallback(
    (changes, { resetPage = true } = {}) => {
      const next = new URLSearchParams(params)

      for (const [key, value] of Object.entries(changes)) {
        if (!value || value === PARAM_DEFAULTS[key]) next.delete(key)
        else next.set(key, String(value))
      }

      // Any filter change returns to page one: page 7 of a two-page result is
      // empty, and the reader concludes there are no matches.
      if (resetPage && !('page' in changes)) next.delete('page')

      // `replace` so adjusting a filter does not push a history entry per
      // keystroke — Back should return to the dashboard the reader came from,
      // not walk backwards through their own typing.
      setParams(next, { replace: true })
    },
    [params, setParams],
  )

  const searchInput = read('q')
  const search = useDebouncedValue(searchInput)

  const page = Number(read('page')) || 1
  const limit = Number(read('limit')) || ADMIN_PAGE_SIZE
  const sort = read('sort')

  const [showFilters, setShowFilters] = useState(
    () => Boolean(read('createdFrom') || read('createdTo') || read('lastLoginFrom') || read('lastLoginTo')),
  )

  // --- Overlays -------------------------------------------------------------
  const [isInviteOpen, setIsInviteOpen] = useState(false)
  const [confirm, setConfirm] = useState({ action: null, user: null })
  const [confirmError, setConfirmError] = useState(null)
  const [isMutating, setIsMutating] = useState(false)
  const [notice, setNotice] = useState(null)

  const query = useMemo(
    () => ({
      page,
      limit,
      sort,
      search,
      role: read('role'),
      status: read('status'),
      createdFrom: read('createdFrom'),
      createdTo: read('createdTo'),
      lastLoginFrom: read('lastLoginFrom'),
      lastLoginTo: read('lastLoginTo'),
    }),
    [page, limit, sort, search, read],
  )

  const loader = useCallback((options) => fetchAdminUsers({ ...query, ...options }), [query])

  const { data, error, isLoading, isRefreshing, refresh } = useAdminResource(loader, {
    deps: [query],
  })

  // Restored only once rows exist — an offset applied against a skeleton is
  // clamped to the bottom of a shorter page.
  useScrollMemory({ enabled: !isLoading })

  const items = data?.items ?? []
  const pagination = data?.pagination ?? { page, limit, total: 0 }
  const statusCounts = data?.statusCounts ?? {}

  const activeFilterCount = [
    search,
    read('role'),
    read('status'),
    read('createdFrom'),
    read('createdTo'),
    read('lastLoginFrom'),
    read('lastLoginTo'),
  ].filter(Boolean).length

  const resetFilters = () => setParams(new URLSearchParams(), { replace: true })

  const toggleSort = (key) =>
    write({ sort: sort === key ? `-${key}` : key })

  const sortState = sort.startsWith('-')
    ? { key: sort.slice(1), direction: 'desc' }
    : { key: sort, direction: 'asc' }

  const roleOptions = useMemo(
    () =>
      (data?.roles ?? []).map((key) => ({
        value: key,
        label: ADMIN_ROLES.find((role) => role.key === key)?.label ?? key,
      })),
    [data?.roles],
  )

  const openUser = (user) => navigate(ADMIN_PATHS.USER_DETAIL.replace(':id', user.id))

  // --- Mutations ------------------------------------------------------------
  const runTransition = async () => {
    const { action, user } = confirm
    setIsMutating(true)
    setConfirmError(null)

    try {
      const result =
        action === 'activate' ? await activateAdminUser(user.id) : await suspendAdminUser(user.id)

      setConfirm({ action: null, user: null })
      setNotice(
        action === 'activate'
          ? `${result.user.email} can now sign in.`
          : `${result.user.email} has been suspended and signed out.`,
      )
      refresh()
      setTimeout(() => setNotice(null), 6000)
    } catch (caught) {
      setConfirmError(caught?.message ?? 'That change could not be applied.')
    } finally {
      setIsMutating(false)
    }
  }

  const columns = useMemo(
    () => [
      {
        key: 'displayName',
        header: 'Full name',
        sortable: true,
        render: (user) => (
          <AdminTableIdentity
            leading={<UserAvatar name={user.displayName} email={user.email} size="sm" />}
            primary={user.displayName ?? 'Not signed in yet'}
            secondary={user.jobTitle}
          />
        ),
      },
      { key: 'email', header: 'Email', sortable: true, cellClassName: 'text-slate-600' },
      {
        key: 'role',
        header: 'Role',
        sortable: true,
        render: (user) => (
          <AdminBadge className={ADMIN_ROLE_BADGE[user.role]}>
            {user.roleLabel ?? user.role ?? '—'}
          </AdminBadge>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        render: (user) => (
          <AdminBadge tone={ADMIN_USER_STATUS_TONE[user.status] ?? 'neutral'} dot>
            {user.statusLabel ?? user.status}
          </AdminBadge>
        ),
      },
      {
        key: 'lastLoginAt',
        header: 'Last login',
        sortable: true,
        render: (user) => (
          <span className="text-slate-600">
            {user.lastLoginAt ? formatRelative(user.lastLoginAt) : 'Never'}
          </span>
        ),
      },
      {
        key: 'createdAt',
        header: 'Created',
        sortable: true,
        render: (user) => <span className="text-slate-600">{formatDate(user.createdAt)}</span>,
      },
      {
        key: 'mailboxes',
        header: 'Mailboxes',
        align: 'right',
        render: (user) =>
          user.mailboxes.total === 0 ? (
            <span className="text-slate-400">—</span>
          ) : (
            <span className="tabular-nums text-slate-600">
              {user.mailboxes.connected} / {user.mailboxes.total}
            </span>
          ),
      },
      {
        key: 'actions',
        header: 'Actions',
        srOnlyHeader: true,
        align: 'right',
        width: 'w-52',
        render: (user) => (
          // `stopPropagation` so an action never also triggers the row's
          // navigation — a click that both suspends somebody and leaves the
          // page is a click whose outcome the operator cannot see.
          <div
            className="flex items-center justify-end gap-1"
            onClick={(event) => event.stopPropagation()}
          >
            <Button size="sm" variant="ghost" onClick={() => openUser(user)}>
              Open
            </Button>

            {user.availableActions?.activate && (
              <Can do={PERMISSIONS.USERS_ACTIVATE}>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setConfirmError(null)
                    setConfirm({ action: 'activate', user })
                  }}
                >
                  <UserCheck className="size-3.5" aria-hidden="true" />
                  Activate
                </Button>
              </Can>
            )}

            {user.availableActions?.suspend && (
              <Can do={PERMISSIONS.USERS_SUSPEND}>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={() => {
                    setConfirmError(null)
                    setConfirm({ action: 'suspend', user })
                  }}
                >
                  <UserX className="size-3.5" aria-hidden="true" />
                  Suspend
                </Button>
              </Can>
            )}
          </div>
        ),
      },
    ],
    // `openUser` is stable enough for the row link, and rebuilding the column
    // set on every render would defeat the memo it sits in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const actions = (
    <>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setShowFilters((previous) => !previous)}
        aria-expanded={showFilters}
      >
        {showFilters ? 'Hide' : 'More'} filters
      </Button>
      <Button variant="secondary" size="sm" onClick={refresh} isLoading={isRefreshing}>
        <RefreshCw className="size-3.5" aria-hidden="true" />
        Refresh
      </Button>
      <Can do={PERMISSIONS.USERS_INVITE}>
        <Button size="sm" onClick={() => setIsInviteOpen(true)}>
          <UserPlus className="size-3.5" aria-hidden="true" />
          Invite user
        </Button>
      </Can>
    </>
  )

  if (error) {
    return (
      <AdminPageContainer
        title="Users"
        subtitle="Everyone with access to this deployment"
        breadcrumb={breadcrumb}
        actions={actions}
      >
        <AdminErrorState error={error} onRetry={refresh} />
      </AdminPageContainer>
    )
  }

  return (
    <AdminPageContainer
      title="Users"
      subtitle="Everyone with access to this deployment"
      breadcrumb={breadcrumb}
      notice={ADMIN_SCOPE_NOTICE}
      isRefreshing={isRefreshing}
      actions={actions}
    >
      {notice && (
        <p
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800"
        >
          {notice}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard label="Total users" value={formatCount(pagination.total)} isLoading={isLoading} />
        <AdminStatCard
          label="Active"
          value={formatCount(statusCounts[ADMIN_USER_STATUS.ACTIVE] ?? 0)}
          tone={ADMIN_TONE.SUCCESS}
          isLoading={isLoading}
        />
        <AdminStatCard
          label="Invited"
          value={formatCount(statusCounts[ADMIN_USER_STATUS.INVITED] ?? 0)}
          tone={ADMIN_TONE.BRAND}
          hint="Waiting to be activated"
          isLoading={isLoading}
        />
        <AdminStatCard
          label="Suspended"
          value={formatCount(statusCounts[ADMIN_USER_STATUS.SUSPENDED] ?? 0)}
          tone={
            (statusCounts[ADMIN_USER_STATUS.SUSPENDED] ?? 0) > 0
              ? ADMIN_TONE.DANGER
              : ADMIN_TONE.NEUTRAL
          }
          isLoading={isLoading}
        />
      </div>

      <AdminCard padded={false}>
        <AdminFilterBar
          activeCount={activeFilterCount}
          onReset={resetFilters}
          search={
            <AdminSearch
              value={searchInput}
              onChange={(value) => write({ q: value })}
              placeholder="Search name, email, role, status…"
              label="Search users"
            />
          }
        >
          <AdminFilterSelect
            label="Role"
            value={read('role')}
            onChange={(value) => write({ role: value })}
            options={roleOptions}
            allLabel="All roles"
          />
          <AdminFilterSelect
            label="Status"
            value={read('status')}
            onChange={(value) => write({ status: value })}
            options={STATUS_OPTIONS}
            allLabel="All statuses"
          />
        </AdminFilterBar>

        {showFilters && (
          <div className="grid grid-cols-1 gap-4 border-b border-slate-100 bg-slate-50/60 px-5 py-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { key: 'createdFrom', label: 'Created from' },
              { key: 'createdTo', label: 'Created to' },
              { key: 'lastLoginFrom', label: 'Last login from' },
              { key: 'lastLoginTo', label: 'Last login to' },
            ].map((field) => (
              <label key={field.key} className="block">
                <span className="block text-xs font-medium text-slate-600">{field.label}</span>
                <input
                  type="date"
                  value={read(field.key)}
                  onChange={(event) => write({ [field.key]: event.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </label>
            ))}
          </div>
        )}

        <AdminTable
          columns={columns}
          rows={items}
          isLoading={isLoading}
          sort={sortState}
          onSortChange={toggleSort}
          onRowClick={openUser}
          caption="Users with access to this deployment"
          empty={
            activeFilterCount > 0 ? (
              <AdminEmptyState
                variant="filtered"
                title="No users match these filters"
                description="Try a different role, status or date range — or clear the filters to see everyone."
                actionLabel="Clear filters"
                onAction={resetFilters}
                compact
              />
            ) : (
              <AdminEmptyState
                title="No users yet"
                description="Invite the first person, or wait for someone to sign in with Google."
                actionLabel={canInvite ? 'Invite user' : undefined}
                onAction={canInvite ? () => setIsInviteOpen(true) : undefined}
              />
            )
          }
        />

        {!isLoading && pagination.total > 0 && (
          <div className="border-t border-slate-100 px-5 py-3">
            <AdminPagination
              page={pagination.page}
              pageSize={pagination.limit}
              totalItems={pagination.total}
              onPageChange={(next) => write({ page: String(next) }, { resetPage: false })}
              onPageSizeChange={(next) => write({ limit: String(next) })}
              disabled={isRefreshing}
            />
          </div>
        )}
      </AdminCard>

      <InviteUserDialog
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        roles={data?.roles}
        onInvited={(result) => {
          /**
           * `assignment` is present only when a workbook was uploaded *and* it
           * imported. The dialog reports a failed import itself and does not
           * reach here with a half-result, so this only ever adds good news.
           */
          const assigned = result.assignment
            ? ` ${result.assignment.created.toLocaleString()} lead(s) assigned.` +
              (result.assignment.invalid + result.assignment.failed > 0
                ? ` ${result.assignment.invalid + result.assignment.failed} row(s) were skipped.`
                : '')
            : ''

          setNotice(
            `${result.user.email} has been invited. Activate them when they are ready.${assigned}`,
          )
          refresh()
          setTimeout(() => setNotice(null), 6000)
        }}
      />

      <ConfirmStatusDialog
        isOpen={Boolean(confirm.action)}
        action={confirm.action}
        user={confirm.user}
        error={confirmError}
        isBusy={isMutating}
        onConfirm={runTransition}
        onClose={() => {
          setConfirm({ action: null, user: null })
          setConfirmError(null)
        }}
      />
    </AdminPageContainer>
  )
}

export default AdminUsersPage
