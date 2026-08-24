/**
 * The admin API surface.
 *
 * Mirrors `@/api/endpoints` — same convention, same reason. Components and
 * services never hold a URL string, so a route change on the server is a
 * one-line edit here rather than a search across the module.
 *
 * Paths start at the API version (`/v1/...`) and never include the origin or
 * the `/api` prefix — those come from the base URL. See `@/api/endpoints` for
 * the full rule.
 *
 * ## Every entry exists on the server
 *
 * Phase 14.1 recorded the full designed surface here, including endpoints that
 * had not been built. Phase 14.2 trimmed it to what the server actually serves:
 * a registry listing routes that 404 cannot be trusted to answer "does this
 * exist?", which is most of what it is for.
 *
 * Phase 14.3A added the directory's three writes. Mailbox administration and
 * audit endpoints return when the phases that build them do.
 */

export const ADMIN_ENDPOINTS = Object.freeze({
  /**
   * What the caller may do, plus the server's full permission catalogue.
   *
   * Authentication only — a permission required to discover your own
   * permissions would be circular. Read once by `PermissionProvider`.
   */
  myPermissions: '/v1/admin/me/permissions',

  /** The role matrix, derived from the constants the middleware enforces. */
  roles: '/v1/admin/roles',

  /** Every headline count the admin home shows, in one request. */
  dashboard: '/v1/admin/dashboard',

  /**
   * The enterprise directory.
   *
   * `list` accepts page, limit, search, role, status, sort and four date
   * bounds. The three writes are the only mutating endpoints in the whole admin
   * module — there is no delete and no role update, by design.
   */
  users: {
    list: '/v1/admin/users',
    detail: (id) => `/v1/admin/users/${id}`,
    invite: '/v1/admin/users/invite',
    /**
     * Assigns a workbook of enquiries to one user, as the second half of
     * onboarding them. A raw upload like the workbook importer — the file is
     * the body and the name travels in `X-Filename`.
     */
    importLeads: (id) => `/v1/admin/users/${id}/leads/import`,
    /** Deletes this user's enquiries. Owner/Admin only, enforced server-side. */
    deleteLeads: (id) => `/v1/admin/users/${id}/leads`,
    activate: (id) => `/v1/admin/users/${id}/activate`,
    suspend: (id) => `/v1/admin/users/${id}/suspend`,
    /**
     * Role management (Phase 14.8A). The only endpoint that writes `role`.
     *
     * The GET reports which roles the caller may set on this person and why not
     * for the rest, so the dropdown offers only legal choices. It is a
     * convenience: the PATCH evaluates the same rules again, and that is the
     * control.
     */
    role: (id) => `/v1/admin/users/${id}/role`,
    /**
     * Soft delete and restore (Phase 15.2).
     *
     * `DELETE` removes access, never the document — every lead, campaign and
     * audit entry that references the account is retained.
     */
    remove: (id) => `/v1/admin/users/${id}`,
    restore: (id) => `/v1/admin/users/${id}/restore`,
    /** Employee profile and documents, read-only plus verification (17.2). */
    profile: (id) => `/v1/admin/users/${id}/profile`,
    documents: (id) => `/v1/admin/users/${id}/documents`,
    documentFile: (id, documentId) => `/v1/admin/users/${id}/documents/${documentId}/file`,
    verifyDocument: (id, documentId) => `/v1/admin/users/${id}/documents/${documentId}/verify`,
    rejectDocument: (id, documentId) => `/v1/admin/users/${id}/documents/${documentId}/reject`,
    /** One person's performance dashboard (17.3). */
    performance: (id) => `/v1/admin/users/${id}/performance`,
    /**
     * Identity linking (Phase 14.8C).
     *
     * PUT links a Microsoft address to this account; DELETE revokes it. Owner
     * capability, because linking onto an owner grants the organization door.
     */
    microsoftIdentity: (id) => `/v1/admin/users/${id}/microsoft-identity`,
    googleIdentity: (id) => `/v1/admin/users/${id}/google-identity`,
  },

  /**
   * Employee performance (Phase 17.3).
   *
   * Derived live from the CRM's own collections — there is no performance
   * table. `highlights` is the aggregate behind the dashboard widgets and the
   * leaderboard badges; `compare` puts two to four people side by side.
   */
  performance: {
    highlights: '/v1/admin/performance/highlights',
    compare: '/v1/admin/performance/compare',
  },

  /**
   * Tasks and goals (Phase 18).
   *
   * Deliberately the **CRM** paths rather than admin mirrors. There is one task
   * API; what an administrator may see is decided by their permissions, not by
   * a second set of endpoints that would have to be kept in step with the first.
   */
  tasks: {
    list: '/v1/tasks',
    highlights: '/v1/tasks/highlights',
    report: '/v1/tasks/report',
  },
  goals: {
    list: '/v1/goals',
    summary: '/v1/goals/summary',
  },

  /**
   * The mailbox registry and its assignments.
   *
   * `list` accepts search, status, provider, health and assignedTo. The three
   * writes are the assignment engine; connection itself is unchanged and still
   * lives on the CRM's own `/v1/mailboxes`.
   */
  mailboxes: {
    list: '/v1/admin/mailboxes',
    detail: (id) => `/v1/admin/mailboxes/${id}`,
    assign: (id) => `/v1/admin/mailboxes/${id}/assign`,
    unassign: (id) => `/v1/admin/mailboxes/${id}/unassign`,
    setDefault: (id) => `/v1/admin/mailboxes/${id}/default`,
  },

  /** The user-side view of the same relationship. */
  userMailboxes: (id) => `/v1/admin/users/${id}/mailboxes`,

  /**
   * Reporting.
   *
   * Every entry under here accepts the same global range — `preset`, or an
   * explicit `from`/`to` pair — which the server resolves. The console never
   * computes a window itself, so all widgets on a page describe the same days.
   */
  analytics: '/v1/admin/analytics',

  /** The leaderboard. Accepts the range plus search, role, sort, page, limit. */
  teamPerformance: '/v1/admin/analytics/team',

  /** One person's activity over time. Accepts the range plus `unit`. */
  userPerformance: (id) => `/v1/admin/analytics/users/${id}`,

  /** Per-mailbox send volume and health. */
  mailboxAnalytics: '/v1/admin/analytics/mailboxes',

  /** The enquiry funnel. */
  leadAnalytics: '/v1/admin/analytics/leads',

  /** The organisation timeline. Recent activity, not an audit trail. */
  activity: '/v1/admin/activity',

  /** Cross-user campaign monitoring. Accepts search, status. */
  campaigns: '/v1/admin/campaigns',

  /** Cross-user enquiry monitoring. Accepts search, stage, attention. */
  leads: '/v1/admin/leads',

  /** One enquiry, whoever owns it. Same guard as the list above. */
  leadDetail: (id) => `/v1/admin/leads/${id}`,

  /**
   * Deep dependency probes.
   *
   * Deliberately not `/v1/admin/health`: `/v1/health` is the public, shallow,
   * unauthenticated probe a load balancer polls, and two endpoints differing
   * only by prefix is how a monitor ends up pointed at the wrong one.
   */
  systemHealth: '/v1/admin/system-health',

  /** Audit counts and recent entries. Answers `available: false` when empty. */
  auditSummary: '/v1/admin/audit/summary',

  /**
   * The audit log (Phase 14.7).
   *
   * Under `/v1/audit`, not `/v1/admin/audit`: the log is its own module, written
   * by every part of the CRM and read through one permission. Grouped here in
   * the registry because the admin console is what reads it.
   *
   * Every entry is a GET. There is no endpoint that creates or deletes a record.
   */
  audit: {
    /** Filtered, cursor- or page-paginated. Accepts every filter the page offers. */
    logs: '/v1/audit/logs',
    detail: (id) => `/v1/audit/logs/${id}`,
    /** Filter options with counts for the current filter. */
    facets: '/v1/audit/facets',
    /** Extent, retention policy and coverage. */
    overview: '/v1/audit/overview',
    /** The same entries grouped Today / Yesterday / Earlier, server-side. */
    timeline: '/v1/audit/timeline',
    /** Returns a file, not the envelope. Opened directly, not through Axios. */
    export: '/v1/audit/export',
  },

  /** Derived organization information. Answers `configured: false` for now. */
  organization: '/v1/admin/organization',

  /** Whether the organization has been claimed, and by whom. */
  organizationBootstrap: '/v1/admin/organization/bootstrap',
})

export default ADMIN_ENDPOINTS
