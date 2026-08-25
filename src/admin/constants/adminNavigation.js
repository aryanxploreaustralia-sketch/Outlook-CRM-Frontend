/**
 * Admin sidebar registry.
 *
 * Mirrors the shape of `@/config/navigation` on purpose, so `AdminSidebarNavItem`
 * and the CRM's `SidebarNavItem` stay conceptually interchangeable and a future
 * merge of the two is a rename rather than a rewrite.
 *
 * Every entry has a route and navigates. There is no placeholder entry and no
 * "coming soon" state: Billing was the only one and it was removed in Phase
 * 14.2, because billing is not part of this CRM.
 *
 * ## The `permission` field
 *
 * Every item declares the permission that gates it. `AdminSidebar` filters on
 * them, so an item the caller cannot open is **removed from the menu** rather
 * than shown disabled — an unauthorized user should not learn the page exists.
 *
 * Recording them here from Phase 14.1 is what made Phase 14.4 a single
 * `.filter()` call rather than ten decisions re-derived under time pressure.
 */

import {
  Activity,
  Building2,
  FileClock,
  Gauge,
  Inbox,
  LayoutDashboard,
  Megaphone,
  ShieldCheck,
  Target,
  Trophy,
  Users,
} from 'lucide-react'

import { ADMIN_PATHS } from '@/admin/routes/adminPaths'

/**
 * @typedef  {object}  AdminNavItem
 * @property {string}  id
 * @property {string}  label
 * @property {string}  path        Every admin item navigates; none is a stub.
 * @property {object}  icon        A lucide-react component.
 * @property {boolean} [end]       Match the path exactly (index routes).
 * @property {string}  [description] Accessible title/tooltip.
 * @property {string}  [permission]  Gates the item. Read by `AdminSidebar`.
 */

/** Operations — the day-to-day admin surface. */
export const ADMIN_NAV_OVERVIEW = Object.freeze([
  {
    id: 'admin-dashboard',
    label: 'Dashboard',
    path: ADMIN_PATHS.DASHBOARD,
    icon: LayoutDashboard,
    // Exact, or this row would stay highlighted on every child route and two
    // items would appear selected at once — the same reason `/mail` is exact
    // in the CRM navigation.
    end: true,
    description: 'Platform overview and health summary',
    permission: 'analytics.view',
  },
  {
    id: 'admin-analytics',
    label: 'Analytics',
    path: ADMIN_PATHS.ANALYTICS,
    icon: Gauge,
    end: false,
    description: 'Leads, mail, campaigns and reply performance',
    permission: 'analytics.view',
  },
  {
    id: 'admin-team',
    label: 'Team performance',
    path: ADMIN_PATHS.TEAM,
    icon: Trophy,
    end: false,
    description: 'Contribution and activity by team member',
    // `analytics.view`. The endpoint behind it requires the same, and a menu
    // item that opens a 403 is worse than no menu item.
    permission: 'analytics.view',
  },
])

/** Access control. */
export const ADMIN_NAV_ACCESS = Object.freeze([
  {
    id: 'admin-users',
    label: 'Users',
    path: ADMIN_PATHS.USERS,
    icon: Users,
    end: false,
    description: 'People with access to this workspace',
    permission: 'users.view',
  },
  {
    id: 'admin-roles',
    label: 'Roles & permissions',
    path: ADMIN_PATHS.ROLES,
    icon: ShieldCheck,
    end: false,
    description: 'Role hierarchy and what each one may do',
    permission: 'roles.view',
  },
  {
    id: 'admin-mailboxes',
    label: 'Mailboxes',
    path: ADMIN_PATHS.MAILBOXES,
    icon: Inbox,
    end: false,
    description: 'Connected mailboxes, assignment and health',
    permission: 'mailboxes.view',
  },
])

/** Cross-user monitoring. */
export const ADMIN_NAV_MONITORING = Object.freeze([
  {
    id: 'admin-campaigns',
    label: 'Campaign monitor',
    path: ADMIN_PATHS.CAMPAIGN_MONITOR,
    icon: Megaphone,
    end: false,
    description: 'Every campaign in the workspace, live',
    // `analytics.view`, not `campaigns.view`: this reads across every user, and
    // every role holds `campaigns.view`. Matches the endpoint's own guard.
    permission: 'analytics.view',
  },
  {
    id: 'admin-leads',
    label: 'Lead monitor',
    path: ADMIN_PATHS.LEAD_MONITOR,
    icon: Target,
    end: false,
    description: 'Pipeline health, stale and unassigned enquiries',
    // Same reasoning as the campaign monitor above.
    permission: 'analytics.view',
  },
])

/** Governance and platform. */
export const ADMIN_NAV_PLATFORM = Object.freeze([
  {
    id: 'admin-audit',
    label: 'Audit logs',
    path: ADMIN_PATHS.AUDIT,
    icon: FileClock,
    end: false,
    description: 'Who did what, when, from where',
    permission: 'audit.view',
  },
  {
    id: 'admin-health',
    label: 'System health',
    path: ADMIN_PATHS.HEALTH,
    icon: Activity,
    end: false,
    description: 'Database, Graph, schedulers, queues and storage',
    permission: 'systemhealth.view',
  },
  {
    id: 'admin-organization',
    label: 'Organization',
    path: ADMIN_PATHS.ORGANIZATION,
    icon: Building2,
    end: false,
    description: 'Company identity, branding and regional settings',
    permission: 'organization.view',
  },
])

/**
 * Sections the admin sidebar renders in order.
 *
 * Empty sections are filtered out, so a heading can never appear above nothing —
 * the same guarantee `NAV_SECTIONS` gives the CRM sidebar, and the mechanism
 * Phase 14.2 will rely on when permission filtering empties a whole section.
 */
export const ADMIN_NAV_SECTIONS = Object.freeze(
  [
    { id: 'overview', label: null, items: ADMIN_NAV_OVERVIEW },
    /*
     * Monitoring sits above access control: the console's daily work is the
     * lead register, and access control is administration somebody visits when
     * a person joins or leaves. Order of the sections only — every item, route,
     * icon and permission is untouched.
     */
    { id: 'monitoring', label: 'Monitoring', items: ADMIN_NAV_MONITORING },
    { id: 'access', label: 'Access control', items: ADMIN_NAV_ACCESS },
    { id: 'platform', label: 'Platform', items: ADMIN_NAV_PLATFORM },
  ].filter((section) => section.items.length > 0),
)

export default ADMIN_NAV_SECTIONS
