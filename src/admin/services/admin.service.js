/**
 * Admin data access.
 *
 * Three layers, matching the CRM's own convention exactly:
 *
 *   page → hook (useAdminResource) → service (this file) → httpClient (axios)
 *
 * Pages never import Axios and never hold a URL. `httpClient` normalises every
 * failure into `{ message, status, code, details, isNetwork, isCanceled }`, so
 * nothing below repeats a defensive `err.response?.data?.message ?? …` chain and
 * every admin screen reacts to a 401 or a network drop identically.
 *
 * ## What changed in Phase 14.2 and 14.3A
 *
 * Every function in this file used to resolve a fixture behind an artificial
 * delay. They now issue real requests. The **exported names, their arguments and
 * their resolved shapes did not change**, which is why no page, component, hook
 * or constant needed editing for the data to become real — the seam was designed
 * for exactly this commit.
 *
 * `src/admin/data/` and the `delay()` helper are gone.
 *
 * Phase 14.3A added the directory's three writes — the only mutating calls in
 * the module. They use `httpClient` directly rather than the `get` helper
 * below, because the envelope they return carries an `event` alongside the
 * record and both are wanted.
 *
 * ## Cancellation
 *
 * Every function accepts an `AbortSignal`. React runs an effect, its cleanup and
 * the effect again on mount in development, so without one the first request is
 * left in flight to resolve into an unmounted component — and, worse, can
 * resolve *after* a newer request and overwrite it.
 */

import { ADMIN_ENDPOINTS } from '@/admin/services/adminEndpoints'
import { httpClient } from '@/api/httpClient'

/**
 * Issues a GET and unwraps the standard envelope.
 *
 * Every endpoint in this product answers `{ success, message, data, meta? }`.
 * Unwrapping here means a page consumes `data` directly and never learns the
 * envelope exists — and if the envelope ever changes, it changes in one place.
 *
 * `meta` is folded into the returned object when present, because the only
 * endpoint that sends it is the paginated one and its consumer wants both.
 */
async function get(url, { params, signal } = {}) {
  const response = await httpClient.get(url, { params, signal })
  const body = response.data

  if (body?.meta) return { ...body.data, pagination: body.meta }

  return body?.data ?? null
}

/**
 * Strips empty values from a query object.
 *
 * The filter controls use `''` for "no filter". Sent as-is, `?role=` reaches
 * Zod as an empty string and fails `z.enum()` — a 422 for a filter the user
 * cleared, which is the wrong answer to a perfectly ordinary action.
 */
function clean(params = {}) {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== '' && value !== null && value !== undefined),
  )
}

// ---------------------------------------------------------------------------
// Authorization
// ---------------------------------------------------------------------------

/**
 * The caller's effective permissions, and the catalogue to validate keys against.
 *
 * Read once by `PermissionProvider`. Everything the console renders depends on
 * it — and nothing it returns is trusted by the server, which checks again.
 */
export function fetchMyPermissions({ signal } = {}) {
  return get(ADMIN_ENDPOINTS.myPermissions, { signal })
}

/** The role matrix the middleware actually enforces. */
export function fetchAdminRoles({ signal } = {}) {
  return get(ADMIN_ENDPOINTS.roles, { signal })
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

export function fetchAdminDashboard({ signal } = {}) {
  return get(ADMIN_ENDPOINTS.dashboard, { signal })
}

// ---------------------------------------------------------------------------
// Directory
// ---------------------------------------------------------------------------

/**
 * @param {{ page?: number, limit?: number, search?: string, role?: string,
 *           status?: string, sort?: string, createdFrom?: string,
 *           createdTo?: string, lastLoginFrom?: string, lastLoginTo?: string,
 *           signal?: AbortSignal }} [options]
 */
export function fetchAdminUsers({ signal, ...params } = {}) {
  return get(ADMIN_ENDPOINTS.users.list, { params: clean(params), signal })
}

/** One account in full, for the profile drawer. */
export function fetchAdminUser(id, { signal } = {}) {
  return get(ADMIN_ENDPOINTS.users.detail(id), { signal })
}

// ---------------------------------------------------------------------------
// Directory writes
//
// The only mutating calls in the admin module. Each resolves to
// `{ event, user }` — `event` being the lifecycle event the server performed,
// which is the extension point audit recording will read when it arrives.
// ---------------------------------------------------------------------------

/**
 * Creates an invitation.
 *
 * No email is sent. The invitation is a real account row in `invited` state
 * that the person's first Google sign-in claims by verified address.
 *
 * @param {{ fullName: string, email: string, role: string, notes?: string }} input
 */
export async function inviteAdminUser(input) {
  const response = await httpClient.post(ADMIN_ENDPOINTS.users.invite, input)
  return response.data?.data ?? null
}

/** Moves an invited or suspended account to active. */
export async function activateAdminUser(id) {
  const response = await httpClient.patch(ADMIN_ENDPOINTS.users.activate(id))
  return response.data?.data ?? null
}

/** Suspends an account. Never deletes it — there is no delete. */
export async function suspendAdminUser(id) {
  const response = await httpClient.patch(ADMIN_ENDPOINTS.users.suspend(id))
  return response.data?.data ?? null
}

/**
 * Soft-deletes a user.
 *
 * Resolves to `{ revokedSessions, mailboxesUnassigned, preserved, user }` — the
 * confirmation reads `preserved` back, so what it promises comes from the
 * server rather than from copy that could drift from what actually happened.
 */
export async function deleteAdminUser(id, { reason } = {}) {
  const response = await httpClient.delete(ADMIN_ENDPOINTS.users.remove(id), {
    data: { reason: reason?.trim() || null },
  })
  return response.data?.data ?? null
}

/** Returns access. Sessions stay revoked — they must sign in again. */
export async function restoreAdminUser(id) {
  const response = await httpClient.post(ADMIN_ENDPOINTS.users.restore(id))
  return response.data?.data ?? null
}

/** Links a Microsoft address so this person can sign in through the admin door. */
export async function linkMicrosoftIdentity(id, microsoftEmail) {
  const response = await httpClient.put(ADMIN_ENDPOINTS.users.microsoftIdentity(id), {
    microsoftEmail,
  })
  return response.data?.data ?? null
}

/** Revokes that route in. Refuses if Microsoft is the only way into the account. */
export async function unlinkMicrosoftIdentity(id) {
  const response = await httpClient.delete(ADMIN_ENDPOINTS.users.microsoftIdentity(id))
  return response.data?.data ?? null
}

/** Whether the organization has been claimed. */
export function fetchBootstrapStatus({ signal } = {}) {
  return get(ADMIN_ENDPOINTS.organizationBootstrap, { signal })
}

/** One employee's profile, read-only for an administrator. */
export function fetchAdminUserProfile(id, { signal } = {}) {
  return get(ADMIN_ENDPOINTS.users.profile(id), { signal })
}

/** Their documents, with the verification state. */
export function fetchAdminUserDocuments(id, { signal } = {}) {
  return get(ADMIN_ENDPOINTS.users.documents(id), { signal })
}

/**
 * Records a verification decision.
 *
 * One function for both outcomes: they differ only in the endpoint, and two
 * near-identical wrappers is two things to keep in step.
 */
export async function decideAdminUserDocument(id, documentId, status, remarks) {
  const url =
    status === 'verified'
      ? ADMIN_ENDPOINTS.users.verifyDocument(id, documentId)
      : ADMIN_ENDPOINTS.users.rejectDocument(id, documentId)

  const response = await httpClient.patch(url, { remarks: remarks?.trim() || null })
  return response.data?.data ?? null
}

/** Where an administrator previews or downloads one of their documents. */
export function adminDocumentFileUrl(id, documentId, { download = false } = {}) {
  const base = httpClient.defaults.baseURL ?? ''
  return `${base}${ADMIN_ENDPOINTS.users.documentFile(id, documentId)}${download ? '?download=1' : ''}`
}

/**
 * One person's performance dashboard (Phase 17.3).
 *
 * Named for the dashboard rather than for the person, because
 * `fetchAdminUserPerformance` below already means something else: the 14.6
 * trend series behind the activity chart. Two similar names is a poor situation,
 * but two *identical* ones would be a silent overwrite.
 *
 * `range` is `{ preset }` or `{ from, to }` — resolved server-side so every
 * widget on the page agrees about what "last 7 days" means.
 */
export function fetchAdminUserPerformanceDashboard(id, { range = {}, timelineLimit, signal } = {}) {
  return get(ADMIN_ENDPOINTS.users.performance(id), {
    params: clean({ ...range, timelineLimit }),
    signal,
  })
}

/** The badges and dashboard widgets, over the whole team. */
export function fetchPerformanceHighlights({ range = {}, signal } = {}) {
  return get(ADMIN_ENDPOINTS.performance.highlights, { params: clean(range), signal })
}

/** Two to four people, side by side. */
export function fetchPerformanceComparison(userIds, { range = {}, signal } = {}) {
  return get(ADMIN_ENDPOINTS.performance.compare, {
    params: clean({ ...range, users: userIds.join(',') }),
    signal,
  })
}

/** Which roles the caller may set on this person, each with a reason if not. */
export function fetchAdminUserRole(id, { signal } = {}) {
  return get(ADMIN_ENDPOINTS.users.role(id), { signal })
}

/**
 * Changes a role.
 *
 * The only call in the console that alters what somebody may do. Resolves to
 * `{ event, from, to, fromLabel, toLabel, reason, user }`.
 */
export async function changeAdminUserRole(id, { role, reason }) {
  const response = await httpClient.patch(ADMIN_ENDPOINTS.users.role(id), { role, reason })
  return response.data?.data ?? null
}

// ---------------------------------------------------------------------------
// Mailboxes
// ---------------------------------------------------------------------------

/**
 * @param {{ search?: string, status?: string, provider?: string, health?: string,
 *           assignedTo?: string, signal?: AbortSignal }} [options]
 */
export function fetchAdminMailboxes({ signal, ...params } = {}) {
  return get(ADMIN_ENDPOINTS.mailboxes.list, { params: clean(params), signal })
}

/** One mailbox with the people who can use it. */
export function fetchAdminMailbox(id, { signal } = {}) {
  return get(ADMIN_ENDPOINTS.mailboxes.detail(id), { signal })
}

/** Every mailbox one person may use, marked with their default. */
export function fetchUserMailboxes(userId, { signal } = {}) {
  return get(ADMIN_ENDPOINTS.userMailboxes(userId), { signal })
}

// ---------------------------------------------------------------------------
// Assignment writes
//
// Each resolves to a payload carrying a structured `event` -
// MAILBOX_ASSIGNED / MAILBOX_UNASSIGNED / DEFAULT_CHANGED - which is the
// extension point audit recording consumes in a later phase.
// ---------------------------------------------------------------------------

/** Grants users access to a mailbox. Idempotent. */
export async function assignMailboxUsers(mailboxId, userIds) {
  const response = await httpClient.post(ADMIN_ENDPOINTS.mailboxes.assign(mailboxId), { userIds })
  return response.data?.data ?? null
}

/** Revokes access. Refuses to remove the connector. */
export async function unassignMailboxUsers(mailboxId, userIds) {
  const response = await httpClient.post(ADMIN_ENDPOINTS.mailboxes.unassign(mailboxId), { userIds })
  return response.data?.data ?? null
}

/** Makes a mailbox one user's default, clearing whatever was. */
export async function setMailboxDefaultFor(mailboxId, userId) {
  const response = await httpClient.patch(ADMIN_ENDPOINTS.mailboxes.setDefault(mailboxId), { userId })
  return response.data?.data ?? null
}

/**
 * Replaces a user's whole set of assigned mailboxes.
 *
 * A set, not a diff: a modal submitting "these are the mailboxes this person
 * should have" cannot leave an add-list and a remove-list inconsistent.
 */
export async function setUserMailboxes(userId, mailboxIds) {
  const response = await httpClient.put(ADMIN_ENDPOINTS.userMailboxes(userId), { mailboxIds })
  return response.data?.data ?? null
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

/** @param {{ from?: string, to?: string, granularity?: string, signal?: AbortSignal }} [options] */
export function fetchAdminAnalytics({ signal, ...params } = {}) {
  return get(ADMIN_ENDPOINTS.analytics, { params: clean(params), signal })
}

/**
 * The team leaderboard.
 *
 * Resolves to `{ items, totals, scoring, range, pagination }`. `scoring` carries
 * the weights and targets that produced the scores, so the interface explains
 * the number from the same response that supplied it — rather than restating the
 * formula in a component, where the two can drift apart.
 *
 * @param {{ preset?: string, from?: string, to?: string, search?: string,
 *           role?: string, sort?: string, page?: number, limit?: number,
 *           signal?: AbortSignal }} [options]
 */
export function fetchAdminTeamPerformance({ signal, ...params } = {}) {
  return get(ADMIN_ENDPOINTS.teamPerformance, { params: clean(params), signal })
}

/**
 * One person's activity over time, gap-filled.
 *
 * @param {string} id
 * @param {{ preset?: string, from?: string, to?: string,
 *           unit?: 'day'|'week'|'month'|'year', signal?: AbortSignal }} [options]
 */
export function fetchAdminUserPerformance(id, { signal, ...params } = {}) {
  return get(ADMIN_ENDPOINTS.userPerformance(id), { params: clean(params), signal })
}

/** @param {{ preset?: string, from?: string, to?: string, signal?: AbortSignal }} [options] */
export function fetchAdminMailboxAnalytics({ signal, ...params } = {}) {
  return get(ADMIN_ENDPOINTS.mailboxAnalytics, { params: clean(params), signal })
}

/** @param {{ preset?: string, from?: string, to?: string, signal?: AbortSignal }} [options] */
export function fetchAdminLeadAnalytics({ signal, ...params } = {}) {
  return get(ADMIN_ENDPOINTS.leadAnalytics, { params: clean(params), signal })
}

/** @param {{ preset?: string, from?: string, to?: string, limit?: number, signal?: AbortSignal }} [options] */
export function fetchAdminActivity({ signal, ...params } = {}) {
  return get(ADMIN_ENDPOINTS.activity, { params: clean(params), signal })
}

// ---------------------------------------------------------------------------
// Monitoring
// ---------------------------------------------------------------------------

/** @param {{ search?: string, status?: string, signal?: AbortSignal }} [options] */
export function fetchAdminCampaigns({ signal, ...params } = {}) {
  return get(ADMIN_ENDPOINTS.campaigns, { params: clean(params), signal })
}

/** @param {{ search?: string, stage?: string, attention?: string, signal?: AbortSignal }} [options] */
export function fetchAdminLeads({ signal, ...params } = {}) {
  return get(ADMIN_ENDPOINTS.leads, { params: clean(params), signal })
}

// ---------------------------------------------------------------------------
// Platform
// ---------------------------------------------------------------------------

export function fetchAdminHealth({ signal } = {}) {
  return get(ADMIN_ENDPOINTS.systemHealth, { signal })
}

export function fetchAdminAudit({ signal } = {}) {
  return get(ADMIN_ENDPOINTS.auditSummary, { signal })
}

// ---------------------------------------------------------------------------
// Audit (Phase 14.7)
//
// All reads. The export is deliberately absent from this module: it returns a
// file rather than the JSON envelope `get()` unwraps, so it is fetched by
// navigating to the URL — see `auditExportUrl` below.
// ---------------------------------------------------------------------------

/**
 * The audit log.
 *
 * @param {{ preset?: string, from?: string, to?: string, category?: string,
 *           action?: string, result?: string, severity?: string,
 *           entityType?: string, entityId?: string, actor?: string,
 *           mailboxId?: string, campaignId?: string, leadId?: string,
 *           search?: string, limit?: number, cursor?: string, page?: number,
 *           signal?: AbortSignal }} [options]
 */
export function fetchAuditLogs({ signal, ...params } = {}) {
  return get(ADMIN_ENDPOINTS.audit.logs, { params: clean(params), signal })
}

/** One entry in full, for the detail drawer. */
export function fetchAuditEntry(id, { signal } = {}) {
  return get(ADMIN_ENDPOINTS.audit.detail(id), { signal })
}

/** Filter options with counts for the current filter. */
export function fetchAuditFacets({ signal, ...params } = {}) {
  return get(ADMIN_ENDPOINTS.audit.facets, { params: clean(params), signal })
}

/** Extent, retention and coverage. */
export function fetchAuditOverview({ signal } = {}) {
  return get(ADMIN_ENDPOINTS.audit.overview, { signal })
}

/** Entries grouped Today / Yesterday / Earlier. Grouped by the server. */
export function fetchAuditTimeline({ signal, ...params } = {}) {
  return get(ADMIN_ENDPOINTS.audit.timeline, { params: clean(params), signal })
}

/**
 * The URL an export downloads from.
 *
 * A URL rather than a fetch: the response is a file with a
 * `Content-Disposition`, and letting the browser navigate to it gets the
 * filename, the progress indicator and the download-folder behaviour for free.
 * Fetching it into memory to re-wrap it in a Blob would discard all three and
 * hold the whole export in the tab.
 *
 * Same-origin, so the session cookie is sent — which is why this needs no token
 * handling of its own.
 */
export function auditExportUrl({ format = 'csv', ...params } = {}) {
  const query = new URLSearchParams(clean({ ...params, format }))
  return `${httpClient.defaults.baseURL ?? ''}${ADMIN_ENDPOINTS.audit.export}?${query}`
}

export function fetchAdminOrganization({ signal } = {}) {
  return get(ADMIN_ENDPOINTS.organization, { signal })
}

export default {
  activateAdminUser,
  adminDocumentFileUrl,
  changeAdminUserRole,
  decideAdminUserDocument,
  deleteAdminUser,
  fetchAdminUserDocuments,
  fetchAdminUserPerformanceDashboard,
  fetchAdminUserProfile,
  fetchPerformanceComparison,
  fetchPerformanceHighlights,
  fetchAdminUserRole,
  restoreAdminUser,
  fetchBootstrapStatus,
  linkMicrosoftIdentity,
  unlinkMicrosoftIdentity,
  assignMailboxUsers,
  fetchAdminMailbox,
  fetchUserMailboxes,
  setMailboxDefaultFor,
  setUserMailboxes,
  unassignMailboxUsers,
  fetchAdminActivity,
  fetchAdminAnalytics,
  fetchAdminLeadAnalytics,
  fetchAdminMailboxAnalytics,
  fetchAdminTeamPerformance,
  fetchAdminUserPerformance,
  fetchAdminRoles,
  fetchMyPermissions,
  fetchAdminAudit,
  auditExportUrl,
  fetchAuditEntry,
  fetchAuditFacets,
  fetchAuditLogs,
  fetchAuditOverview,
  fetchAuditTimeline,
  fetchAdminCampaigns,
  fetchAdminDashboard,
  fetchAdminHealth,
  fetchAdminLeads,
  fetchAdminMailboxes,
  fetchAdminOrganization,
  fetchAdminUser,
  fetchAdminUsers,
  inviteAdminUser,
  suspendAdminUser,
}
