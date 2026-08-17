/**
 * The admin route branch.
 *
 * Exported as a **single route object** rather than as edits scattered through
 * `router.jsx`. That is the whole containment strategy of this phase: the CRM
 * router gains one array entry, and deleting that entry removes the entire admin
 * surface with no other file touched.
 *
 * ## Conventions carried over from the CRM router
 *
 *  - **`lazy` per page**, so signing in does not download eleven admin bundles.
 *    React Router's `lazy` rather than `React.lazy`, because the router awaits
 *    the module during its own navigation transition and no Suspense fallback
 *    flashes on route change.
 *  - **`handle: { title, subtitle }`**, read by `AdminLayout` via `useMatches`,
 *    so a page never passes its title upward.
 *  - **`handle.breadcrumb`**, read by `useAdminBreadcrumbs` for the same reason.
 *  - **`errorElement`**, so a failure inside the admin shell renders the CRM's
 *    error page rather than blanking the application.
 *
 * ## Authentication and authorization
 *
 * The branch is wrapped in the CRM's own `ProtectedRoute`, unmodified — signing
 * in is the same act for both surfaces, and a second opinion about who is signed
 * in is how two answers to that question come to exist.
 *
 * Every child page is then wrapped in `AdminRoute` with the permission it
 * requires, and `AdminLayout` gates the console as a whole on holding any admin
 * capability at all.
 *
 * None of that is the security boundary. It exists so the product behaves
 * sensibly; the server refuses independently, with a 403, whatever the client
 * chose to render.
 */

import { ProtectedRoute } from '@/components/routing/ProtectedRoute'
import { AdminLayout } from '@/admin/layouts/AdminLayout'
import { AdminRoute } from '@/admin/components/AdminRoute'
import { PERMISSIONS } from '@/admin/constants/permissions'
import { ADMIN_PATHS } from '@/admin/routes/adminPaths'
import { ErrorPage } from '@/pages/ErrorPage'

/**
 * Wraps a lazily-loaded page in its permission gate.
 *
 * Applied inside `lazy` rather than around the route element, so the page's
 * bundle is still code-split *and* the gate is impossible to forget: adding a
 * route means calling this, and calling it means naming a permission.
 *
 * Typing the URL directly reaches the gate and is refused. That is convenience,
 * not security — every screen behind it loads from an endpoint that enforces the
 * same permission server-side.
 */
const gated = (permission, load) => async () => {
  const Component = await load()

  return {
    Component: () => (
      <AdminRoute permission={permission}>
        <Component />
      </AdminRoute>
    ),
  }
}

export const adminRoute = {
  path: ADMIN_PATHS.ROOT,
  element: (
    <ProtectedRoute>
      <AdminLayout />
    </ProtectedRoute>
  ),
  errorElement: <ErrorPage />,
  children: [
    {
      index: true,
      handle: { title: 'Dashboard', subtitle: 'Workspace activity and platform health' },
      lazy: gated(PERMISSIONS.ANALYTICS_VIEW, async () => (await import('@/admin/pages/AdminDashboardPage')).AdminDashboardPage),
    },
    {
      path: 'users',
      handle: { title: 'Users', subtitle: 'Access, roles and status', breadcrumb: 'Users' },
      lazy: gated(PERMISSIONS.USERS_VIEW, async () => (await import('@/admin/pages/AdminUsersPage')).AdminUsersPage),
    },
    {
      /**
       * The user 360 dashboard.
       *
       * Registered after the literal `users` path, and safe there: `users` is an
       * exact segment and `users/:id` is one deeper, so neither can capture the
       * other. Lazily loaded like every other page, so the directory does not
       * carry nine sections of dashboard it may never show.
       */
      path: 'users/:id',
      handle: { title: 'User', subtitle: 'Profile, access and activity', breadcrumb: 'Users' },
      lazy: gated(
        PERMISSIONS.USERS_VIEW,
        async () => (await import('@/admin/pages/users/AdminUserDetailPage')).AdminUserDetailPage,
      ),
    },
    {
      path: 'roles',
      handle: {
        title: 'Roles & permissions',
        subtitle: 'The role hierarchy and what each role may do',
        breadcrumb: 'Roles & permissions',
      },
      lazy: gated(PERMISSIONS.ROLES_VIEW, async () => (await import('@/admin/pages/AdminRolesPage')).AdminRolesPage),
    },
    {
      path: 'mailboxes',
      handle: {
        title: 'Mailboxes',
        subtitle: 'Connection, assignment and health',
        breadcrumb: 'Mailboxes',
      },
      lazy: gated(PERMISSIONS.MAILBOXES_VIEW, async () => (await import('@/admin/pages/AdminMailboxesPage')).AdminMailboxesPage),
    },
    {
      path: 'analytics',
      handle: {
        title: 'Analytics',
        subtitle: 'Enquiries, delivery and reply performance',
        breadcrumb: 'Analytics',
      },
      lazy: gated(PERMISSIONS.ANALYTICS_VIEW, async () => (await import('@/admin/pages/AdminAnalyticsPage')).AdminAnalyticsPage),
    },
    {
      path: 'team',
      handle: {
        title: 'Team performance',
        subtitle: 'Contribution and activity by team member',
        breadcrumb: 'Team performance',
      },
      lazy: gated(PERMISSIONS.ANALYTICS_VIEW, async () => (await import('@/admin/pages/AdminTeamPage')).AdminTeamPage),
    },
    {
      path: 'campaigns',
      handle: {
        title: 'Campaign monitor',
        subtitle: 'Every campaign in the workspace',
        breadcrumb: 'Campaign monitor',
      },
      lazy: gated(PERMISSIONS.CAMPAIGNS_VIEW, async () => (await import('@/admin/pages/AdminCampaignMonitorPage')).AdminCampaignMonitorPage),
    },
    {
      path: 'leads/:id',
      handle: { title: 'Enquiry', subtitle: 'Full detail, whoever owns it' },
      lazy: gated(PERMISSIONS.LEADS_VIEW, async () => (await import('@/admin/pages/AdminLeadDetailPage')).AdminLeadDetailPage),
    },
    {
      path: 'leads',
      handle: {
        title: 'Lead monitor',
        subtitle: 'Pipeline health across every consultant',
        breadcrumb: 'Lead monitor',
      },
      lazy: gated(PERMISSIONS.LEADS_VIEW, async () => (await import('@/admin/pages/AdminLeadMonitorPage')).AdminLeadMonitorPage),
    },
    {
      path: 'audit',
      handle: {
        title: 'Audit logs',
        subtitle: 'Every privileged action, append-only',
        breadcrumb: 'Audit logs',
      },
      lazy: gated(PERMISSIONS.AUDIT_VIEW, async () => (await import('@/admin/pages/AdminAuditPage')).AdminAuditPage),
    },
    {
      path: 'health',
      handle: {
        title: 'System health',
        subtitle: 'Deep probes across every dependency',
        breadcrumb: 'System health',
      },
      lazy: gated(PERMISSIONS.SYSTEMHEALTH_VIEW, async () => (await import('@/admin/pages/AdminHealthPage')).AdminHealthPage),
    },
    {
      path: 'organization',
      handle: {
        title: 'Organization',
        subtitle: 'Identity, branding and regional settings',
        breadcrumb: 'Organization',
      },
      lazy: gated(PERMISSIONS.ORGANIZATION_VIEW, async () => (await import('@/admin/pages/AdminOrganizationPage')).AdminOrganizationPage),
    },
  ],
}

export default adminRoute
