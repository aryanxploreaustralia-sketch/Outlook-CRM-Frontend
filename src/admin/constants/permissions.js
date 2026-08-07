/**
 * Permission keys, as the client refers to them.
 *
 * ## Why this file exists at all
 *
 * The registry lives on the server, in `backend/src/constants/permissions.js`,
 * and that is the authority. But the two packages share no module graph — the
 * client cannot import from the backend — so the keys it needs have to be named
 * somewhere on this side.
 *
 * The alternative is worse, not better: raw strings scattered through JSX. A
 * typo in `<Can do="users.invte">` renders nothing, forever, silently, and looks
 * exactly like a correctly-hidden control.
 *
 * ## How drift is caught rather than assumed away
 *
 * `/admin/me/permissions` returns the server's **full catalogue** alongside the
 * caller's grants. `usePermissions().can()` checks every key it is asked about
 * against that catalogue and warns in development when it sees one the server
 * has never heard of. So a key that drifts out of step is reported the first
 * time it is used, rather than discovered as a missing button months later.
 *
 * Keys are duplicated; **authority is not**. The server decides what the caller
 * holds, and the server refuses regardless of what the client rendered.
 */

export const PERMISSIONS = Object.freeze({
  // --- CRM: overview -------------------------------------------------------
  DASHBOARD_VIEW: 'dashboard.view',

  // --- Directory -----------------------------------------------------------
  USERS_VIEW: 'users.view',
  USERS_INVITE: 'users.invite',
  USERS_ACTIVATE: 'users.activate',
  USERS_SUSPEND: 'users.suspend',
  USERS_DELETE: 'users.delete',

  // --- Roles ---------------------------------------------------------------
  ROLES_VIEW: 'roles.view',
  ROLES_MANAGE: 'roles.manage',

  // --- Mailboxes -----------------------------------------------------------
  MAILBOXES_VIEW: 'mailboxes.view',
  MAILBOXES_ASSIGN: 'mailboxes.assign',
  MAILBOXES_DEFAULT: 'mailboxes.default',

  // --- Reporting -----------------------------------------------------------
  ANALYTICS_VIEW: 'analytics.view',

  // --- Campaigns -----------------------------------------------------------
  CAMPAIGNS_VIEW: 'campaigns.view',
  CAMPAIGNS_CREATE: 'campaigns.create',
  CAMPAIGNS_EDIT: 'campaigns.edit',
  CAMPAIGNS_DELETE: 'campaigns.delete',

  // --- Templates -----------------------------------------------------------
  TEMPLATES_VIEW: 'templates.view',
  TEMPLATES_MANAGE: 'templates.manage',

  // --- Sales register ------------------------------------------------------
  LEADS_VIEW: 'leads.view',
  LEADS_CREATE: 'leads.create',
  LEADS_EDIT: 'leads.edit',
  LEADS_DELETE: 'leads.delete',
  LEADS_EXPORT: 'leads.export',
  CONTACTS_VIEW: 'contacts.view',
  COMPANIES_VIEW: 'companies.view',

  // --- Replies -------------------------------------------------------------
  REPLYSYNC_VIEW: 'replysync.view',
  NOTIFICATIONS_VIEW: 'notifications.view',

  // --- Mail ----------------------------------------------------------------
  COMPOSE_SEND: 'compose.send',
  MAILHISTORY_VIEW: 'mailhistory.view',

  // --- Workbook ------------------------------------------------------------
  WORKBOOK_IMPORT: 'workbook.import',
  WORKBOOK_HISTORY: 'workbook.history',

  // --- Scheduler -----------------------------------------------------------
  SCHEDULER_VIEW: 'scheduler.view',
  SCHEDULER_MANAGE: 'scheduler.manage',

  // --- Organization --------------------------------------------------------
  ORGANIZATION_VIEW: 'organization.view',
  ORGANIZATION_MANAGE: 'organization.manage',

  // --- Governance ----------------------------------------------------------
  AUDIT_VIEW: 'audit.view',
  SYSTEMHEALTH_VIEW: 'systemhealth.view',
  SYSTEMHEALTH_MANAGE: 'systemhealth.manage',
})

export const PERMISSION_VALUES = Object.freeze(Object.values(PERMISSIONS))

export default PERMISSIONS
