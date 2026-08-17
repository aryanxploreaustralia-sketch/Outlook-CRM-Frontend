/**
 * The user 360° dashboard.
 *
 * Replaces the Phase 14.3A profile drawer, which has been deleted. A drawer was
 * the right shape for four facts and two buttons; it is the wrong shape for nine
 * sections, because a panel cannot be linked to, cannot be reloaded, cannot be
 * navigated back out of, and puts a scroll container inside a scroll container.
 *
 * ## What a route buys that a drawer could not
 *
 * `/admin/users/:id` is addressable — an administrator can send it to a
 * colleague. Browser Back works because it is history rather than component
 * state. A refresh lands on the same person. And the permission gate is the
 * router's, so typing the URL is refused by the same mechanism that hides the
 * link.
 *
 * ## Requests are deferred until a section is reached
 *
 * The profile and mailboxes load immediately — the header needs both. Analytics,
 * campaigns and leads load the first time their section scrolls into view, so a
 * visitor who only wanted to check somebody's role makes two requests, not five.
 * `useSectionObserver` drives that with the same observer that highlights the
 * navigation.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  CalendarClock,
  ChevronDown,
  Inbox,
  MoreHorizontal,
  RotateCcw,
  Trash2,
  UserCheck,
  UserX,
} from 'lucide-react'

import { AdminBadge, AdminErrorState } from '@/admin/components'
import { Can } from '@/admin/components/Can'
import { ConfirmStatusDialog } from '@/admin/components/users/ConfirmStatusDialog'
import { UserMailboxesDialog } from '@/admin/components/mailboxes/UserMailboxesDialog'
import { UserSectionNav } from '@/admin/components/users/detail/UserSectionNav'
import {
  UserOverviewSection,
  UserPerformanceSection,
} from '@/admin/components/users/detail/UserProfileSections'
import { AuditDetailDrawer } from '@/admin/components/audit/AuditDetailDrawer'
import {
  UserDocumentsSection,
  UserEmployeeProfileSection,
} from '@/admin/components/users/detail/UserEmployeeSections'
import { UserIdentitySection } from '@/admin/components/users/detail/UserIdentitySection'
import { UserImportLeadsSection } from '@/admin/components/users/detail/UserImportLeadsSection'
import { UserPerformanceDashboardSection } from '@/admin/components/users/detail/UserPerformanceDashboardSection'
import { UserTasksSection } from '@/admin/components/users/detail/UserTasksSection'
import { UserRoleSection } from '@/admin/components/users/detail/UserRoleSection'
import { UserTrendSection } from '@/admin/components/users/detail/UserTrendSection'
import {
  UserCampaignsSection,
  UserLeadsSection,
  UserMailboxesSection,
  UserRepliesSection,
} from '@/admin/components/users/detail/UserWorkSections'
import {
  UserActivitySection,
  UserPermissionsSection,
  UserSecuritySection,
} from '@/admin/components/users/detail/UserAccessSections'
import {
  ADMIN_USER_STATUS_TONE,
} from '@/admin/constants/admin.constants'
import { ADMIN_ROLE_BADGE } from '@/admin/constants/adminRoles.constants'
import { PERMISSIONS } from '@/admin/constants/permissions'
import { useAdminResource, useScrollToTop, useSectionObserver } from '@/admin/hooks'
import { usePermissions } from '@/admin/hooks/usePermissions'
import { ADMIN_PATHS } from '@/admin/routes/adminPaths'
import {
  activateAdminUser,
  deleteAdminUser,
  restoreAdminUser,
  fetchAdminAnalytics,
  fetchAdminCampaigns,
  deleteAdminUserLeads,
  fetchAdminLeads,
  fetchAdminUser,
  fetchUserMailboxes,
  suspendAdminUser,
  unassignMailboxUsers,
} from '@/admin/services/admin.service'
import { EMPTY, formatCount, formatDate, formatRelative } from '@/admin/utils/format'
import { UserAvatar } from '@/components/common/UserAvatar'
import { LoadingScreen } from '@/components/common/LoadingScreen'
import { Button } from '@/components/ui/Button'

/** Section order. Drives the navigation, the observer and the render order. */
const SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'role', label: 'Role' },
  { id: 'identity', label: 'Sign-in identities' },
  { id: 'employee-profile', label: 'Employee profile' },
  { id: 'documents', label: 'Documents' },
  { id: 'performance-dashboard', label: 'Employee performance' },
  { id: 'tasks', label: 'Tasks and goals' },
  { id: 'performance', label: 'Performance' },
  { id: 'trend', label: 'Activity over time' },
  { id: 'mailboxes', label: 'Mailboxes' },
  { id: 'campaigns', label: 'Campaigns' },
  { id: 'leads', label: 'Leads' },
  // Placed immediately after Leads: it is the same subject — what this account
  // owns — and the natural next question once you have looked at the register.
  { id: 'import-leads', label: 'Import leads' },
  { id: 'replies', label: 'Replies' },
  { id: 'permissions', label: 'Permissions' },
  { id: 'security', label: 'Security' },
  { id: 'activity', label: 'Activity' },
]

const SECTION_IDS = SECTIONS.map((section) => section.id)

/**
 * The header's "more actions" dropdown.
 *
 * A local component rather than a shared one: the console has no menu
 * primitive, and the two behaviours a menu owes the reader — close on Escape,
 * close on an outside click — are a dozen lines. Introducing a dependency for
 * that would be the larger change.
 *
 * The trigger is a real `<button>` and is never disabled, so it shows a pointer
 * and responds to Enter and Space for free. `aria-expanded` and `aria-haspopup`
 * tell a screen reader what it is.
 */
function MoreActionsMenu({ isDeleted, onDelete, onRestore }) {
  const [isOpen, setIsOpen] = useState(false)
  const wrapper = useRef(null)

  useEffect(() => {
    if (!isOpen) return undefined

    const onPointerDown = (event) => {
      if (!wrapper.current?.contains(event.target)) setIsOpen(false)
    }
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setIsOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [isOpen])

  // Chosen once, so the menu cannot offer Delete and Restore together.
  const item = isDeleted
    ? { label: 'Restore user', Icon: RotateCcw, run: onRestore, tone: 'text-slate-700' }
    : { label: 'Delete user', Icon: Trash2, run: onDelete, tone: 'text-red-600' }

  return (
    <div className="relative" ref={wrapper}>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setIsOpen((previous) => !previous)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label="More actions"
      >
        <MoreHorizontal className="size-4" aria-hidden="true" />
        <ChevronDown className="size-3" aria-hidden="true" />
      </Button>

      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 min-w-44 rounded-lg border border-slate-200 bg-white py-1 shadow-dropdown"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              // Closed before the dialog opens, so the menu is never left
              // hanging behind a modal.
              setIsOpen(false)
              item.run()
            }}
            className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 ${item.tone}`}
          >
            <item.Icon className="size-4" aria-hidden="true" />
            {item.label}
          </button>
        </div>
      )}
    </div>
  )
}

export function AdminUserDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { groups, catalogue, can } = usePermissions()

  const canSeeMailboxes = can(PERMISSIONS.MAILBOXES_VIEW)
  const canSeeAnalytics = can(PERMISSIONS.ANALYTICS_VIEW)
  const canSeeCampaigns = canSeeAnalytics && can(PERMISSIONS.CAMPAIGNS_VIEW)
  const canSeeLeads = canSeeAnalytics && can(PERMISSIONS.LEADS_VIEW)

  const { activeId, hasSeen, register, scrollTo } = useSectionObserver(SECTION_IDS)

  /**
   * Open at Overview, whatever the previous page was scrolled to.
   *
   * `#admin-main` belongs to `AdminLayout`, the parent route, so it survives
   * the navigation from the directory and arrives holding the directory's
   * offset. Keyed on `id` so going straight from one user to another starts at
   * the top for the second as well.
   *
   * It does not interfere with the section navigation below: this runs only
   * when `id` changes, and choosing a section from the sidebar does not change
   * it.
   */
  useScrollToTop(id)

  // --- Overlays and inline actions -----------------------------------------
  const [confirm, setConfirm] = useState({ action: null, user: null })
  const [confirmError, setConfirmError] = useState(null)
  const [isMutating, setIsMutating] = useState(false)
  const [isAssignOpen, setIsAssignOpen] = useState(false)
  const [busyMailboxId, setBusyMailboxId] = useState(null)
  const [notice, setNotice] = useState(null)

  /** The audit entry open in the drawer, if any. */
  const [auditEntryId, setAuditEntryId] = useState(null)

  // --- Eager: the header needs both ----------------------------------------
  const profileLoader = useCallback((options) => fetchAdminUser(id, options), [id])
  const { data: user, error, isLoading, refresh } = useAdminResource(profileLoader, { deps: [id] })

  const mailboxLoader = useCallback((options) => fetchUserMailboxes(id, options), [id])
  const {
    data: mailboxData,
    isLoading: mailboxesLoading,
    refresh: refreshMailboxes,
  } = useAdminResource(mailboxLoader, { deps: [id], enabled: canSeeMailboxes })

  // --- Deferred: only once the section has been reached --------------------
  const analyticsLoader = useCallback((options) => fetchAdminAnalytics(options), [])
  const { data: analytics, isLoading: analyticsLoading } = useAdminResource(analyticsLoader, {
    enabled: canSeeAnalytics && hasSeen('performance'),
  })

  const campaignsLoader = useCallback((options) => fetchAdminCampaigns(options), [])
  const { data: campaignData, isLoading: campaignsLoading } = useAdminResource(campaignsLoader, {
    enabled: canSeeCampaigns && hasSeen('campaigns'),
  })

  /**
   * This person's enquiries, selected by the **server**.
   *
   * It used to fetch the global monitor page and filter it down here. That was
   * only ever accidentally right: the endpoint returns the newest page across
   * every owner, so unless this person happened to own some of those newest
   * rows the section rendered "no enquiries" — including immediately after
   * importing a thousand of them for them.
   *
   * `owner` scopes the query, so the rows and the total both describe this
   * person and nobody else.
   */
  const leadsLoader = useCallback(
    (options) => fetchAdminLeads({ owner: id, limit: 10, ...options }),
    [id],
  )
  const {
    data: leadData,
    isLoading: leadsLoading,
    refresh: refreshLeads,
  } = useAdminResource(leadsLoader, {
    enabled: canSeeLeads && hasSeen('leads'),
  })

  const mailboxes = mailboxData?.items ?? []

  /**
   * This person's rows, selected by **owner id**.
   *
   * The monitoring endpoints return the whole deployment; matching on the
   * display name would attribute one person's pipeline to another whenever two
   * names collide, which is why the rows carry an id.
   */
  const campaigns = useMemo(
    () => (campaignData?.items ?? []).filter((row) => row.ownerId === id).slice(0, 10),
    [campaignData, id],
  )

  // Already this person's, already the page size asked for — no client-side
  // filtering, so the count below is the database's answer rather than
  // whatever survived a filter.
  const leads = leadData?.items ?? []
  const leadTotal = leadData?.pagination?.total ?? null

  const performance = useMemo(
    () => (analytics?.userPerformance ?? []).find((row) => row.id === id) ?? null,
    [analytics, id],
  )

  // --- Actions --------------------------------------------------------------
  const runTransition = async () => {
    const { action } = confirm
    setIsMutating(true)
    setConfirmError(null)

    try {
      /**
       * One handler for all four transitions.
       *
       * `delete` and `restore` join `activate` and `suspend` rather than
       * getting their own handler: they share the confirmation dialog, the busy
       * flag, the error surface and the refresh, and a second copy of that
       * would only be a second place for them to drift.
       *
       * Every one calls a service that already existed. No deletion logic is
       * written here — `deleteAdminUser` is the same soft delete the directory
       * uses, and the server is what enforces who may call it.
       */
      const SERVICES = {
        activate: () => activateAdminUser(id),
        suspend: () => suspendAdminUser(id),
        delete: () => deleteAdminUser(id),
        restore: () => restoreAdminUser(id),
      }

      const MESSAGES = {
        activate: 'This account can now sign in.',
        suspend: 'This account has been suspended and signed out.',
        delete: 'This account has been deleted. Its data is retained and it can be restored.',
        restore: 'This account has been restored.',
      }

      await SERVICES[action]()
      setConfirm({ action: null, user: null })
      setNotice(MESSAGES[action])
      refresh()
      setTimeout(() => setNotice(null), 6000)
    } catch (caught) {
      setConfirmError(caught?.message ?? 'That change could not be applied.')
    } finally {
      setIsMutating(false)
    }
  }

  const removeMailbox = async (mailbox) => {
    setBusyMailboxId(mailbox.id)
    try {
      await unassignMailboxUsers(mailbox.id, [id])
      refreshMailboxes()
      refresh()
    } catch (caught) {
      setNotice(caught?.message ?? 'That assignment could not be removed.')
      setTimeout(() => setNotice(null), 6000)
    } finally {
      setBusyMailboxId(null)
    }
  }

  /**
   * Back to the directory.
   *
   * `navigate(-1)` when there is history to go back to, so the directory's
   * filters, page and scroll position are restored by the browser rather than
   * reconstructed. A direct visit has no history entry to return to, so it falls
   * through to the directory's own URL.
   */
  const goBack = () => {
    if (window.history.state?.idx > 0) navigate(-1)
    else navigate(ADMIN_PATHS.USERS)
  }

  // --- Render ---------------------------------------------------------------
  if (isLoading) {
    return <LoadingScreen fullScreen message="Loading user" detail="One moment." />
  }

  if (error) {
    return (
      <div className="mx-auto w-full max-w-(--spacing-page) px-4 py-6 sm:px-6 sm:py-8 xl:px-8">
        <Button variant="secondary" size="sm" onClick={goBack} className="mb-6">
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          Back to users
        </Button>
        <AdminErrorState error={error} onRetry={refresh} />
      </div>
    )
  }

  if (!user) return null

  const actions = user.availableActions ?? {}

  return (
    <div className="mx-auto w-full max-w-(--spacing-page) px-4 py-6 sm:px-6 sm:py-8 xl:px-8">
      {/* --- Breadcrumb + back ------------------------------------------- */}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" size="sm" onClick={goBack}>
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          Back to users
        </Button>
        <nav aria-label="Breadcrumb" className="text-xs text-slate-500">
          <Link to={ADMIN_PATHS.DASHBOARD} className="hover:text-brand-700 hover:underline">
            Administration
          </Link>
          <span className="mx-1 text-slate-300">/</span>
          <Link to={ADMIN_PATHS.USERS} className="hover:text-brand-700 hover:underline">
            Users
          </Link>
          <span className="mx-1 text-slate-300">/</span>
          <span className="font-medium text-slate-700">{user.displayName ?? user.email}</span>
        </nav>
      </div>

      {notice && (
        <p
          role="status"
          className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800"
        >
          {notice}
        </p>
      )}

      {/* --- Header ------------------------------------------------------- */}
      <header className="mt-4 rounded-xl border border-slate-200 bg-white p-5 shadow-card sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-4 sm:gap-5">
            <UserAvatar
              name={user.displayName}
              email={user.email}
              size="xl"
              className="shrink-0"
            />

            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
                {user.displayName ?? 'Not signed in yet'}
              </h1>
              <p className="mt-0.5 truncate text-sm text-slate-500">{user.email}</p>

              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <AdminBadge className={ADMIN_ROLE_BADGE[user.role]} size="md">
                  {user.roleLabel ?? user.role}
                </AdminBadge>
                <AdminBadge tone={ADMIN_USER_STATUS_TONE[user.status] ?? 'neutral'} size="md" dot>
                  {user.statusLabel}
                </AdminBadge>
                {user.isSelf && <AdminBadge tone="brand" size="md">This is you</AdminBadge>}
              </div>
            </div>
          </div>

          {/* --- Header actions ------------------------------------------ */}
          <div className="flex flex-wrap items-center gap-2">
            <Can do={PERMISSIONS.MAILBOXES_ASSIGN}>
              <Button variant="secondary" size="sm" onClick={() => setIsAssignOpen(true)}>
                <Inbox className="size-3.5" aria-hidden="true" />
                Assign mailbox
              </Button>
            </Can>

            {actions.activate && (
              <Can do={PERMISSIONS.USERS_ACTIVATE}>
                <Button
                  size="sm"
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

            {actions.suspend && (
              <Can do={PERMISSIONS.USERS_SUSPEND}>
                <Button
                  variant="secondary"
                  size="sm"
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

            <MoreActionsMenu
              /* Soft-deleted accounts offer Restore; every other state offers
                 Delete. Activate and Suspend are not repeated here — they are
                 already buttons to the left. */
              isDeleted={user.isDeleted === true}
              onDelete={() => setConfirm({ action: 'delete', user })}
              onRestore={() => setConfirm({ action: 'restore', user })}
            />
          </div>
        </div>

        {/* --- At-a-glance strip ----------------------------------------- */}
        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-slate-100 pt-5 sm:grid-cols-3 xl:grid-cols-5">
          {[
            { label: 'Department', value: <span className="text-slate-400">Not recorded</span> },
            { label: 'Joined', value: formatDate(user.createdAt) },
            {
              label: 'Last login',
              value: user.lastLoginAt ? formatRelative(user.lastLoginAt) : 'Never',
            },
            {
              label: 'Last activity',
              value: user.activity?.lastActivityAt
                ? formatRelative(user.activity.lastActivityAt)
                : 'No live session',
            },
            {
              label: 'Mailboxes',
              value: canSeeMailboxes
                ? `${formatCount(mailboxes.length)} assigned`
                : EMPTY,
            },
          ].map((item) => (
            <div key={item.label} className="min-w-0">
              <dt className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-slate-400">
                {item.label === 'Joined' && (
                  <CalendarClock className="size-3" aria-hidden="true" />
                )}
                {item.label}
              </dt>
              <dd className="mt-1 truncate text-sm font-medium text-slate-800">{item.value}</dd>
            </div>
          ))}
        </dl>
      </header>

      {/* --- Two columns on desktop, one on mobile ---------------------- */}
      <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-start">
        <UserSectionNav sections={SECTIONS} activeId={activeId} onSelect={scrollTo} />

        {/* `min-w-0` lets this column shrink below its content, which is what
            stops a wide table widening the whole page. */}
        <div className="min-w-0 flex-1 space-y-10">
          <UserOverviewSection user={user} registerRef={register} />

          {/*
            Phase 14.8A. Directly after the overview, because "what is this
            person allowed to do" is the second question anybody opening an
            account asks — and above the work sections, which are consequences
            of the answer.
          */}
          <UserRoleSection
            user={user}
            registerRef={register}
            /**
             * Loaded eagerly, unlike the heavy sections further down.
             *
             * Deferral exists to stop nine requests firing for a visitor who
             * only wanted the header. This is one small query for the section
             * directly beneath it, and it is the section whose entire body
             * depends on the response — so deferring it bought nothing and made
             * it the one panel that could sit on a skeleton indefinitely if the
             * observer never reported it. The trend and audit sections below
             * stay deferred; they are genuinely expensive.
             */
            enabled
            // Refetches the account so the header badge and the permission list
            // below reflect the new role without a manual reload.
            onChanged={refresh}
          />

          {/*
            Phase 14.8C. Directly after Role, because the two answer adjacent
            questions: what this person may do, and how they get in.
          */}
          <UserIdentitySection user={user} registerRef={register} onChanged={refresh} />

          {/*
            Phase 17.2. After the identities, before the work sections: who
            this person is, then what they have been doing. Both are deferred —
            they are two extra requests, and an administrator who came to check
            a role never scrolls this far.
          */}
          <UserEmployeeProfileSection
            user={user}
            registerRef={register}
            enabled={hasSeen('employee-profile')}
          />

          <UserDocumentsSection
            user={user}
            registerRef={register}
            enabled={hasSeen('documents')}
          />

          {/*
            Phase 17.3. Above the 14.6 performance card, which is the narrower
            question — that one compares this person against the team's
            analytics; this one is their own dashboard.
          */}
          <UserPerformanceDashboardSection
            user={user}
            registerRef={register}
            enabled={hasSeen('performance-dashboard')}
          />

          {/*
            Phase 18. Directly after the performance dashboard, because assigned
            work is the part of somebody's output that was *decided* rather than
            measured — and the two are read together.
          */}
          <UserTasksSection user={user} registerRef={register} enabled={hasSeen('tasks')} />

          <UserPerformanceSection
            user={user}
            performance={performance}
            isLoading={canSeeAnalytics && analyticsLoading}
            registerRef={register}
          />

          <UserTrendSection
            userId={id}
            canSee={canSeeAnalytics}
            enabled={hasSeen('trend')}
            registerRef={register}
          />

          <UserMailboxesSection
            mailboxes={mailboxes}
            isLoading={mailboxesLoading}
            canSee={canSeeMailboxes}
            busyId={busyMailboxId}
            onRemove={removeMailbox}
            onManage={() => setIsAssignOpen(true)}
            registerRef={register}
          />

          <UserCampaignsSection
            campaigns={campaigns}
            isLoading={campaignsLoading}
            canSee={canSeeCampaigns}
            registerRef={register}
          />

          <UserLeadsSection
            leads={leads}
            total={leadTotal}
            isLoading={leadsLoading}
            canSee={canSeeLeads}
            registerRef={register}
            /* Owner and Admin only — the same pair the endpoint itself admits. */
            userName={user.displayName ?? user.email}
            canDelete={can(PERMISSIONS.LEADS_DELETE) && can(PERMISSIONS.USERS_VIEW)}
            onDelete={async (payload) => {
              const result = await deleteAdminUserLeads(id, payload)
              // Re-read this person's register and their activity counts, so
              // the rows, the total and the profile all agree afterwards.
              refreshLeads()
              refresh()
              return result
            }}
          />

          {/* Gated on `users.invite` — the same capability the invitation flow
              uses to create an account and stock it. The server enforces it
              again; this only decides whether the form is worth showing. */}
          <UserImportLeadsSection
            user={user}
            canImport={can(PERMISSIONS.USERS_INVITE)}
            registerRef={register}
            /**
             * Re-read this person's data once the import has committed.
             *
             * Both matter: `refreshLeads` repopulates the Leads section below,
             * and `refresh` re-reads the profile itself, whose activity counts
             * include enquiries. Without them the admin sees the import's own
             * success summary sitting above a lead list that still shows the
             * pre-import state, which reads as the import not having worked.
             *
             * The target user's own CRM needs nothing here — no lead data is
             * cached anywhere, so their register fetches fresh on next load.
             */
            onImported={() => {
              refreshLeads()
              refresh()
            }}
          />

          <UserRepliesSection
            conversationCount={user.activity?.conversations ?? 0}
            registerRef={register}
          />

          <UserPermissionsSection
            user={user}
            groups={groups}
            catalogue={catalogue}
            isSelf={user.isSelf}
            registerRef={register}
          />

          <UserSecuritySection user={user} registerRef={register} />

          <UserActivitySection
            user={user}
            registerRef={register}
            // Deferred like every other heavy section on this page: the audit
            // feed is two queries and lives at the very bottom.
            enabled={hasSeen('activity')}
            onSelectEntry={(entry) => setAuditEntryId(entry.id)}
          />
        </div>
      </div>

      {/* --- Overlays ---------------------------------------------------- */}
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

      <AuditDetailDrawer
        entryId={auditEntryId}
        isOpen={Boolean(auditEntryId)}
        onClose={() => setAuditEntryId(null)}
      />

      <UserMailboxesDialog
        isOpen={isAssignOpen}
        onClose={() => setIsAssignOpen(false)}
        user={user}
        onSaved={() => {
          refreshMailboxes()
          refresh()
        }}
      />
    </div>
  )
}

export default AdminUserDetailPage
