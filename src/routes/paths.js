/**
 * Route registry.
 *
 * Both the router and the navigation read from here, which makes it impossible
 * for a nav link to point at a route that does not exist.
 */

export const ROUTE_PATHS = Object.freeze({
  /** Public Phase 1 overview page. */
  ROOT: '/',
  /** Public sign-in page. OAuth failures redirect here. */
  LOGIN: '/login',
  /** Authenticated dashboard home. */
  DASHBOARD: '/dashboard',
  /** Authenticated Microsoft account management. */
  ACCOUNT: '/account',
  /** Authenticated compose screen. */
  COMPOSE: '/mail/compose',
  /** Authenticated send history. */
  MAIL: '/mail',
  /** Provider connection and synchronisation control. */
  PROVIDER: '/provider',
  /** Mailbox folders and their canonical mapping. */
  PROVIDER_FOLDERS: '/provider/folders',
  /** Synchronisation run history. */
  PROVIDER_HISTORY: '/provider/history',

  /** Address book. */
  CONTACTS: '/contacts',
  CONTACT_NEW: '/contacts/new',
  CONTACT_GROUPS: '/contacts/groups',
  CONTACT_IMPORT: '/contacts/import',
  /** `:id` is substituted at the call site. */
  CONTACT_DETAIL: '/contacts/:id',
  CONTACT_EDIT: '/contacts/:id/edit',
  /** Bulk outreach campaigns. */
  CAMPAIGNS: '/campaigns',
  CAMPAIGN_NEW: '/campaigns/new',
  CAMPAIGN_TEMPLATES: '/campaigns/templates',
  CAMPAIGN_ANALYTICS: '/campaigns/analytics',
  /** `:id` is substituted at the call site. */
  CAMPAIGN_DETAIL: '/campaigns/:id',

  /**
   * Email templates — the wording of every automatic message.
   *
   * Deliberately top-level rather than under /campaigns: the active template is
   * what the morning workbook run sends, which is the product's core loop, not
   * a campaign concern.
   */
  TEMPLATES: '/templates',
  TEMPLATE_NEW: '/templates/new',
  /** `:id` is substituted at the call site. */
  TEMPLATE_EDIT: '/templates/:id',

  /** Travel sales register. */
  LEADS: '/leads',

  /** Phase 18 — assigned work and the goals set against it. */
  TASKS: '/tasks',
  LEAD_PIPELINE: '/leads/pipeline',
  LEAD_IMPORT: '/leads/import',
  /** Manual entry. Literal, so it is registered before `/leads/:id`. */
  LEAD_NEW: '/leads/new',
  /** `:id` is substituted at the call site. */
  LEAD_DETAIL: '/leads/:id',

  /** B2B partners. */
  COMPANIES: '/companies',
  COMPANY_DETAIL: '/companies/:id',

  /**
   * Workspace settings.
   *
   * Currently the morning scheduler and nothing else. Top-level rather than
   * nested under /leads, because "when does the automation run?" is a property
   * of the workspace, not of the enquiry register it happens to write to.
   */
  SETTINGS: '/settings',

  /** Public Phase 1 service diagnostics. */
  SYSTEM: '/system',
  NOT_FOUND: '*',
})

/**
 * Items in the Phase 1 public header.
 *
 * Retained so the original `RootLayout` keeps working exactly as before; the
 * dashboard chrome uses `SIDEBAR_NAV` instead.
 */
export const NAV_ITEMS = Object.freeze([
  { path: ROUTE_PATHS.ROOT, label: 'Overview', end: true },
  { path: ROUTE_PATHS.DASHBOARD, label: 'Dashboard', end: false },
  { path: ROUTE_PATHS.SYSTEM, label: 'System', end: false },
])

export default ROUTE_PATHS
