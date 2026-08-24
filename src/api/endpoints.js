/**
 * Central registry of backend endpoints.
 *
 * Components never hard-code URL strings; they import from here. When a route
 * changes on the server it is corrected in exactly one place.
 *
 * ## What a path here may contain
 *
 * Every entry starts at the API **version** — `/v1/...` — and never earlier.
 * The origin and the server's `/api` prefix are contributed by the base URL, so
 * writing `/api/v1/...` here would request `/api/api/v1/...`. `@/api/apiUrl`
 * strips the prefix and warns if it ever appears, but the fix belongs in this
 * file.
 *
 * Paths are joined onto `env.apiBaseUrl` by `httpClient` for requests, and by
 * `apiUrl()` for the handful of URLs the browser navigates to itself.
 */

export const ENDPOINTS = Object.freeze({
  health: {
    /** Liveness + dependency status for the API process. */
    status: '/v1/health',
  },

  auth: {
    /**
     * Sign-in entry point.
     *
     * Reached by a full-page browser navigation, not by fetch — the browser must
     * follow the redirect chain to Microsoft and back. Axios cannot be used for
     * it, so this value is consumed via `window.location.assign`.
     */
    login: '/v1/auth/login',
    logout: '/v1/auth/logout',
    profile: '/v1/auth/profile',
    status: '/v1/auth/status',

    /**
     * Phase 13.1 — Google sign-in.
     *
     * Reached the same way `login` is: a full-page navigation, because the
     * browser must follow the redirect to Google and return with a cookie.
     * Independent of the Microsoft entry point above, which continues to
     * authorise mailboxes rather than identify users.
     */
    google: '/v1/auth/google',

    /**
     * Administrator sign-in with Microsoft (Phase 14.8B).
     *
     * Distinct from `login` above, which is the legacy Microsoft flow that
     * mints a CRM user and is gated off by the server. This one links a
     * verified Microsoft identity to an account that already exists and creates
     * a session only for an organization administrator.
     *
     * Reached by full-page navigation, like the other two: an XHR cannot follow
     * a cross-origin redirect chain or render Microsoft's consent screen.
     */
    microsoftAdmin: '/v1/auth/microsoft/admin/login',
  },

  dashboard: {
    /** Everything the dashboard needs in one authenticated request. */
    overview: '/v1/dashboard',
  },

  account: {
    /** Profile, Microsoft account, role and provider. */
    profile: '/v1/account',
    /** Backend, database, Graph, authentication and token expiry. */
    status: '/v1/account/status',
  },

  mail: {
    /** Sends immediately via Microsoft Graph and records the attempt. */
    send: '/v1/mail/send',
    /** Saves a draft locally and to the user's Outlook drafts folder. */
    draft: '/v1/mail/draft',
    /** Paginated send history. Accepts page, limit, status and search. */
    history: '/v1/mail/history',
    /**
     * One message in full, including its HTML body.
     * A function rather than a string because the id is part of the path.
     */
    detail: (id) => `/v1/mail/${id}`,
  },

  /**
   * Phase 13.2 — connected mailboxes.
   *
   * Distinct from `provider` below, which addresses *the* resolved mailbox in
   * the singular and is unchanged. These address the set: a CRM user
   * authenticated by Google may attach several Microsoft mailboxes, view them,
   * choose a default, and disconnect them individually.
   */
  mailboxes: {
    /** Every mailbox this workspace has connected, default first. */
    list: '/v1/mailboxes',
    /**
     * Starts the Microsoft consent flow for an *additional* mailbox.
     *
     * A full-page navigation like the sign-in entry points, and for the same
     * reason: the browser must follow the redirect to Microsoft and back. It
     * does not create a session — the user must already have one.
     */
    connect: '/v1/mailboxes/connect',
    /** Makes one mailbox the workspace's default sender. */
    setDefault: (id) => `/v1/mailboxes/${id}/default`,
    /** Revokes one mailbox's authorisation. Keeps all mail history. */
    disconnect: (id) => `/v1/mailboxes/${id}`,
  },

  provider: {
    /** Connection state, sync state and the last run, in one request. */
    status: '/v1/provider/status',
    /** Live round trip to the provider, unlike `status` which reads stored state. */
    validate: '/v1/provider/validate',
    folders: '/v1/provider/folders',
    connect: '/v1/provider/connect',
    disconnect: '/v1/provider/disconnect',
    sync: '/v1/provider/sync',
    syncInbox: '/v1/provider/sync/inbox',
    syncSent: '/v1/provider/sync/sent',
    syncDrafts: '/v1/provider/sync/drafts',
    syncArchive: '/v1/provider/sync/archive',
    history: '/v1/provider/history',
  },

  contacts: {
    /** List, search and filter. Also the create target. */
    list: '/v1/contacts',
    statistics: '/v1/contacts/statistics',
    duplicates: '/v1/contacts/duplicates',
    providers: '/v1/contacts/providers',
    sync: '/v1/contacts/sync',
    import: '/v1/contacts/import',
    /** Streams a file rather than the JSON envelope. */
    export: '/v1/contacts/export',
    bulk: '/v1/contacts/bulk',
    detail: (id) => `/v1/contacts/${id}`,
    restore: (id) => `/v1/contacts/${id}/restore`,
    merge: (id) => `/v1/contacts/${id}/merge`,
  },

  contactGroups: {
    list: '/v1/contact-groups',
    detail: (id) => `/v1/contact-groups/${id}`,
    members: (id) => `/v1/contact-groups/${id}/members`,
  },

  campaigns: {
    /** List and filter. Also the create target. */
    list: '/v1/campaigns',
    /** Cross-campaign totals for the analytics page and dashboard card. */
    analytics: '/v1/campaigns/analytics',
    /** Sending mailboxes with rotation health. */
    mailboxes: '/v1/campaigns/mailboxes',
    templates: '/v1/campaigns/templates',
    template: (id) => `/v1/campaigns/templates/${id}`,
    sequences: '/v1/campaigns/sequences',
    detail: (id) => `/v1/campaigns/${id}`,
    audience: (id) => `/v1/campaigns/${id}/audience`,
    /** Renders the first few recipients without sending anything. */
    preview: (id) => `/v1/campaigns/${id}/preview`,
    launch: (id) => `/v1/campaigns/${id}/launch`,
    /** Drains a batch. Rate limited server-side; see the route comment. */
    send: (id) => `/v1/campaigns/${id}/send`,
    control: (id) => `/v1/campaigns/${id}/control`,
    clone: (id) => `/v1/campaigns/${id}/clone`,
    recipients: (id) => `/v1/campaigns/${id}/recipients`,
    events: (id) => `/v1/campaigns/${id}/events`,
    campaignAnalytics: (id) => `/v1/campaigns/${id}/analytics`,
  },

  /**
   * Email templates — the wording of every automatic message.
   *
   * Distinct from `campaigns.templates`, which remains exactly as it was. Both
   * read the same library; this is the surface that owns its lifecycle.
   */
  templates: {
    list: '/v1/templates',
    /** What the morning workbook run would send, or null. */
    active: '/v1/templates/active',
    /** The variable picker's catalogue, with a worked example for each. */
    variables: '/v1/templates/variables',
    /** Renders a template — saved or unsaved — against a real enquiry. */
    preview: '/v1/templates/preview',
    /** Sends to a typed address. Records nothing. */
    testEmail: '/v1/templates/test-email',
    detail: (id) => `/v1/templates/${id}`,
    activate: (id) => `/v1/templates/${id}/activate`,
    deactivate: (id) => `/v1/templates/${id}/deactivate`,
    archive: (id) => `/v1/templates/${id}/archive`,
    restore: (id) => `/v1/templates/${id}/restore`,
    duplicate: (id) => `/v1/templates/${id}/duplicate`,
  },

  /**
   * Background workbook execution.
   *
   * Distinct from `leads.syncWorkbook`, which runs the same import inside the
   * request and returns the summary. This queues it and returns a job id, so a
   * large morning run is never bounded by how long a proxy holds a connection.
   */
  workbook: {
    /** Queues an upload. Answers 202 with a job id. */
    sync: '/v1/workbook/sync',
    /** Recent background runs. */
    jobs: '/v1/workbook/jobs',
    /** Live progress for one run. Polled while it is in flight. */
    job: (id) => `/v1/workbook/jobs/${id}`,
    /** Asks the worker to stop at the next batch boundary. */
    cancelJob: (id) => `/v1/workbook/jobs/${id}/cancel`,
  },

  /**
   * The morning scheduler.
   *
   * Decides *when* the workbook run above starts, and nothing else — it hands
   * the file to the same queue, so an automatic run and a manual upload produce
   * identical results.
   */
  scheduler: {
    /** Configuration, last run, next run and recent attempts, in one request. */
    settings: '/v1/scheduler',
    /** Every attempt, paginated. */
    runs: '/v1/scheduler/runs',
    /** Runs today's scheduler immediately. Administrators only. */
    run: '/v1/scheduler/run',
    /** Reads the inbox now, through the same worker the timer uses. */
    replySyncRun: '/v1/scheduler/reply-sync/run',
  },

  /**
   * Lead correspondence.
   *
   * The reply engine has existed since Phase 9; this is the first client for
   * it. `leadTimeline` returns the enquiry, its messages, its activity and its
   * attachments in one request — the enquiry screen needs all four.
   */
  conversations: {
    /** Everything the enquiry screen shows about correspondence. */
    leadTimeline: (leadId) => `/v1/conversations/lead/${leadId}`,
    /** Reads the inbox. Same code path as the background worker. */
    sync: '/v1/conversations/sync',
    /** Streams an attachment's bytes. */
    attachment: (id) => `/v1/conversations/attachments/${id}/download`,
  },

  /** The notification bell. */
  /**
   * Global search (Phase 15.1).
   *
   * One endpoint across nine sources. Which of them a caller's search covers is
   * decided by the server from their permissions — `sources` reports that, so
   * the palette can state its own scope.
   */
  search: {
    query: '/v1/search',
    sources: '/v1/search/sources',
  },

  /**
   * Employee self-service profile (Phase 17.2).
   *
   * Uploads are raw-body PUT/POST with the filename and metadata in headers —
   * the mechanism the workbook import already uses. `file` and `photo` are
   * plain URLs because the browser fetches those directly, which is what gets
   * the download filename and the progress indicator for free.
   */
  profile: {
    self: '/v1/profile',
    photo: '/v1/profile/photo',
    photoOf: (id) => `/v1/profile/photo/${id}`,
    documents: '/v1/profile/documents',
    document: (id) => `/v1/profile/documents/${id}`,
    documentFile: (id) => `/v1/profile/documents/${id}/file`,
    /**
     * The signed-in person's own performance (17.3).
     *
     * No id: the subject is the session. The same engine serves the admin's
     * view of the same person, so the two cannot show different numbers.
     */
    performance: '/v1/profile/performance',
  },

  /**
   * Assigned work and the targets set against it (Phase 18).
   *
   * CRM endpoints, not admin ones: the people who use them are the people doing
   * the work. Assigning and goal-setting are gated server-side on the existing
   * `users.delete` capability, so the same paths serve both audiences and the
   * client renders from what the server says each task allows.
   */
  tasks: {
    list: '/v1/tasks',
    detail: (id) => `/v1/tasks/${id}`,
    summary: '/v1/tasks/summary',
    workspace: '/v1/tasks/workspace',
    report: '/v1/tasks/report',
    highlights: '/v1/tasks/highlights',
    comments: (id) => `/v1/tasks/${id}/comments`,
    attachments: (id) => `/v1/tasks/${id}/attachments`,
    attachment: (id, attachmentId) => `/v1/tasks/${id}/attachments/${attachmentId}`,
  },

  goals: {
    list: '/v1/goals',
    summary: '/v1/goals/summary',
    detail: (id) => `/v1/goals/${id}`,
  },

  notifications: {
    /** Newest first, with the unread count alongside. */
    list: '/v1/notifications',
    markRead: (id) => `/v1/notifications/${id}/read`,
    markAllRead: '/v1/notifications/read-all',
    /** Just the badge — what the 30-second poll asks for. */
    unread: '/v1/notifications/unread',
    /** Dismisses one. Soft on the server, so it cannot come back. */
    dismiss: (id) => `/v1/notifications/${id}`,
  },

  leads: {
    /** List, filter and search the enquiry register. */
    list: '/v1/leads',
    facets: '/v1/leads/facets',
    statistics: '/v1/leads/statistics',
    pipeline: '/v1/leads/pipeline',
    /** Cross-entity search: leads, companies and contacts in one response. */
    search: '/v1/leads/search',
    /** Resolves a campaign audience from lead criteria. */
    audience: '/v1/leads/audience',
    bulkStage: '/v1/leads/bulk-stage',
    /** The managers an enquiry may be assigned to. */
    assignees: '/v1/leads/assignees',
    /** The enquiry, its contact and its company in one save. */
    detailFull: (id) => `/v1/leads/${id}/full`,
    /** Enquiries introduced but never answered, and the send that chases them. */
    followUp: '/v1/leads/follow-up',
    followUpSend: '/v1/leads/follow-up/send',
    detail: (id) => `/v1/leads/${id}`,

    /**
     * Phase 12 — manual entry.
     *
     * `POST /v1/leads` is the same path the list is read from, which is the
     * REST convention the rest of this API follows. `nextReference` doubles as
     * the availability check when given a `reference` query parameter.
     */
    create: '/v1/leads',
    nextReference: '/v1/leads/next-reference',

    /**
     * Phase 12 — export.
     *
     * Accepts the same query parameters as `list`, so the exported workbook is
     * always exactly what the screen is showing.
     */
    export: '/v1/leads/export',

    /** Reads every worksheet and classifies it, without writing. */
    inspectWorkbook: '/v1/leads/workbook/inspect',

    /**
     * The morning run: compare today's workbook, create only what is new, and
     * email exactly those. `dryRun` returns the comparison without doing any
     * of it.
     */
    syncWorkbook: '/v1/leads/workbook/sync',
    workbookHistory: '/v1/leads/workbook/history',
    workbookStatistics: '/v1/leads/workbook/statistics',
    resendIntroduction: '/v1/leads/resend',

    /** Development convenience: clear the register between test imports. */
    purgePreview: '/v1/leads/purge-preview',
    deleteAll: '/v1/leads/all',
    importWorkbook: '/v1/leads/workbook/import',
    rollback: (importJob) => `/v1/leads/workbook/${importJob}/rollback`,
  },

  companies: {
    list: '/v1/companies',
    detail: (id) => `/v1/companies/${id}`,
  },
})

export default ENDPOINTS
