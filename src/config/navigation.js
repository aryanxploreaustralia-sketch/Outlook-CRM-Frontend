/**
 * Sidebar navigation registry.
 *
 * A single declarative source for the whole menu. Adding a future module means
 * flipping `enabled` to true and pointing `path` at the new route — the sidebar,
 * its badges, its tooltips and its keyboard behaviour all follow automatically.
 *
 * Disabled items are rendered rather than hidden on purpose: showing the product
 * roadmap in place sets expectations, and it is how mature SaaS products signal
 * what is coming without a separate changelog.
 */

import {
  Building2,
  ClipboardList,
  Cloud,
  FileText,
  LayoutDashboard,
  Megaphone,
  PenSquare,
  Send,
  Settings,
  UserCircle,
} from 'lucide-react'

import { ROUTE_PATHS } from '@/routes/paths'

/**
 * @typedef  {object}  NavItem
 * @property {string}  id
 * @property {string}  label
 * @property {?string} path      Null for items with no route yet.
 * @property {object}  icon      A lucide-react component.
 * @property {boolean} enabled   Disabled items are visible but not interactive.
 * @property {boolean} [end]     Match the path exactly (for index routes).
 * @property {string}  [badge]   Short label, e.g. "Soon".
 * @property {string}  [description] Used as the accessible title/tooltip.
 */

/** Live navigation available in this phase. */
export const PRIMARY_NAV = Object.freeze([
  {
    id: 'dashboard',
    label: 'Dashboard',
    path: ROUTE_PATHS.DASHBOARD,
    icon: LayoutDashboard,
    enabled: true,
    end: true,
    description: 'Account, connection and system overview',
  },
  {
    id: 'compose',
    label: 'Compose',
    path: ROUTE_PATHS.COMPOSE,
    icon: PenSquare,
    enabled: true,
    end: true,
    description: 'Write and send a message through Outlook',
  },
  {
    id: 'mail',
    label: 'Mail history',
    path: ROUTE_PATHS.MAIL,
    icon: Send,
    enabled: true,
    // Exact match, or this item would also highlight while /mail/compose is
    // active and two nav entries would appear selected at once.
    end: true,
    description: 'Every message sent, including failures',
  },
    {
    id: 'leads',
    label: 'Leads',
    path: ROUTE_PATHS.LEADS,
    icon: ClipboardList,
    enabled: true,
    // Not exact: the pipeline, import wizard and enquiry detail are children of
    // this section and should keep it highlighted.
    end: false,
    description: 'Quotation enquiries, pipeline and workbook import',
  },
  {
    id: 'companies',
    label: 'Companies',
    path: ROUTE_PATHS.COMPANIES,
    icon: Building2,
    enabled: true,
    end: false,
    description: 'Travel agencies and corporate clients',
  },
  {
    id: 'templates',
    label: 'Email templates',
    path: ROUTE_PATHS.TEMPLATES,
    icon: FileText,
    enabled: true,
    // Not exact: the editor is a child of this section and should keep it
    // highlighted.
    end: false,
    description: 'The message every new enquiry receives automatically',
  },
  {
    id: 'campaigns',
    label: 'Campaigns',
    path: ROUTE_PATHS.CAMPAIGNS,
    icon: Megaphone,
    enabled: true,
    // Not exact: the builder, detail, templates and analytics pages are all
    // children of this section and should keep it highlighted.
    end: false,
    description: 'Bulk outreach campaigns, templates and analytics',
  },
  {
    id: 'provider',
    label: 'Provider',
    path: ROUTE_PATHS.PROVIDER,
    icon: Cloud,
    enabled: true,
    // Not exact: /provider/folders and /provider/history are children of this
    // section and should keep it highlighted.
    end: false,
    description: 'Mailbox connection and synchronisation',
  },
  {
    id: 'account',
    label: 'Account',
    path: ROUTE_PATHS.ACCOUNT,
    icon: UserCircle,
    enabled: true,
    end: false,
    description: 'Manage your connected Microsoft account',
  },
  {
    id: 'settings',
    label: 'Settings',
    path: ROUTE_PATHS.SETTINGS,
    icon: Settings,
    enabled: true,
    end: false,
    description: 'The morning scheduler and workspace automation',
  },
])

/**
 * Reserved for later phases.
 *
 * `path: null` guarantees these can never navigate even if a rendering bug let a
 * click through — the item has nowhere to go by construction.
 *
 * Empty since Phase H3, when Settings shipped and moved up into `PRIMARY_NAV`.
 * Kept rather than deleted because the pattern is the one the next reserved item
 * will use, and `NAV_SECTIONS` already drops the section while it is empty.
 */
export const UPCOMING_NAV = Object.freeze([])

/**
 * Section groupings the sidebar renders in order.
 *
 * Empty sections are filtered out, so a "Coming soon" heading never appears
 * above nothing.
 */
export const NAV_SECTIONS = Object.freeze(
  [
    { id: 'primary', label: null, items: PRIMARY_NAV },
    { id: 'upcoming', label: 'Coming soon', items: UPCOMING_NAV },
  ].filter((section) => section.items.length > 0),
)

export default NAV_SECTIONS
