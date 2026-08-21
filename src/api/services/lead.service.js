/**
 * Leads, companies and workbook import.
 *
 * The transport boundary for the travel sales pages. Components and hooks call
 * these; nothing outside this folder touches Axios or knows a URL.
 */

import { ENDPOINTS } from '@/api/endpoints'
import { httpClient } from '@/api/httpClient'

/** Strips empty parameters so the server applies its own defaults. */
function clean(params = {}) {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => {
      if (value === '' || value === null || value === undefined) return false
      if (Array.isArray(value) && value.length === 0) return false
      return true
    }),
  )
}

// ---------------------------------------------------------------------------
// Leads
// ---------------------------------------------------------------------------

/** @returns {Promise<{ items: object[], pagination: ?object }>} */
export async function fetchLeads(params = {}, { signal } = {}) {
  const response = await httpClient.get(ENDPOINTS.leads.list, { params: clean(params), signal })

  return {
    items: response.data?.data?.items ?? [],
    pagination: response.data?.meta?.pagination ?? null,
  }
}

export async function fetchLead(id, { signal } = {}) {
  const response = await httpClient.get(ENDPOINTS.leads.detail(id), { signal })
  return response.data?.data ?? null
}

/**
 * Creates one enquiry by hand.
 *
 * Every value is sent as a **string**, unparsed. The server hands them to the
 * same validator the workbook importer uses, which is what makes a typed date,
 * a two-number phone cell or `2A + 2C` behave identically here and in an
 * upload. Parsing them in the browser would produce a second interpretation.
 *
 * @returns {Promise<{ lead, company, contact, mail, warnings }>}
 */
export async function createLead(payload, { signal } = {}) {
  const response = await httpClient.post(ENDPOINTS.leads.create, payload, { signal })
  return response.data?.data ?? null
}

/**
 * The reference the server would allocate next, for the form's placeholder.
 *
 * Passing `reference` turns this into an availability check instead.
 *
 * @returns {Promise<{ reference: string, available?: boolean }>}
 */
export async function fetchNextReference({ market, reference } = {}, { signal } = {}) {
  const response = await httpClient.get(ENDPOINTS.leads.nextReference, {
    params: clean({ market, reference }),
    signal,
  })
  return response.data?.data ?? null
}

/**
 * Downloads the filtered register as a workbook.
 *
 * `params` is whatever the list is currently filtered by, passed straight
 * through — the server applies them with the same filter builder the list
 * uses, so the file always matches the screen.
 *
 * A blob rather than the JSON envelope, because the response is a binary file.
 * The timeout is raised well above the default: serialising tens of thousands
 * of rows legitimately takes longer than a page request should.
 */
export async function exportLeads(params = {}, { signal } = {}) {
  const response = await httpClient.get(ENDPOINTS.leads.export, {
    params: clean(params),
    signal,
    responseType: 'blob',
    timeout: 120_000,
  })

  // The server names the file; Content-Disposition is CORS-exposed for this.
  const disposition = response.headers['content-disposition'] ?? ''
  const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? 'leads.xlsx'

  const url = URL.createObjectURL(response.data)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.append(anchor)
  anchor.click()
  anchor.remove()

  // Released on the next tick; revoking immediately can cancel the download in
  // some browsers before it has started.
  setTimeout(() => URL.revokeObjectURL(url), 1000)

  return {
    filename,
    count: Number(response.headers['x-export-count'] ?? 0),
    truncated: response.headers['x-export-truncated'] === 'true',
  }
}

/**
 * Updates the enquiry, its contact and its company in one request.
 *
 * `payload` is `{ lead?, contact?, company? }`; omit a section and it is not
 * touched. The contact and company ids are never sent — the server reads them
 * off the enquiry, which is what stops this endpoint being a lever on records
 * the caller has no claim to.
 */
export async function updateLeadFull(id, payload, { signal } = {}) {
  const response = await httpClient.put(ENDPOINTS.leads.detailFull(id), payload, { signal })
  return response.data?.data ?? response.data
}

export async function updateLead(id, payload, { signal } = {}) {
  const response = await httpClient.put(ENDPOINTS.leads.detail(id), payload, { signal })
  return response.data?.data?.lead ?? null
}

export async function deleteLead(id, { signal } = {}) {
  const response = await httpClient.delete(ENDPOINTS.leads.detail(id), { signal })
  return response.data?.data ?? null
}

export async function bulkStage({ ids, stage, reason }, { signal } = {}) {
  const response = await httpClient.post(
    ENDPOINTS.leads.bulkStage,
    clean({ ids, stage, reason }),
    { signal },
  )
  return response.data?.data ?? null
}

/** Distinct cities, handlers, markets, travel months and companies. */
export async function fetchLeadFacets({ signal } = {}) {
  const response = await httpClient.get(ENDPOINTS.leads.facets, { signal })
  return response.data?.data ?? null
}

export async function fetchLeadStatistics({ signal } = {}) {
  const response = await httpClient.get(ENDPOINTS.leads.statistics, { signal })
  return response.data?.data ?? null
}

/** The pipeline board: ten stage columns with counts and the newest few cards. */
export async function fetchPipeline({ perStage = 10, signal } = {}) {
  const response = await httpClient.get(ENDPOINTS.leads.pipeline, {
    params: { perStage },
    signal,
  })
  return response.data?.data ?? null
}

/** Leads, companies and contacts in one response. */
export async function searchEverything(query, { limit = 10, signal } = {}) {
  const response = await httpClient.get(ENDPOINTS.leads.search, {
    params: { q: query, limit },
    signal,
  })
  return response.data?.data ?? null
}

/**
 * Resolves a campaign audience from lead criteria.
 *
 * Returns contact ids, not lead ids: one message goes to a person, however many
 * enquiries they have open. The server also drops ineligible stages, so the
 * count returned here is what will actually be mailed.
 */
export async function resolveLeadAudience(criteria = {}, { signal } = {}) {
  const response = await httpClient.post(ENDPOINTS.leads.audience, clean(criteria), { signal })
  return response.data?.data ?? null
}

// ---------------------------------------------------------------------------
// Companies
// ---------------------------------------------------------------------------

export async function fetchCompanies(params = {}, { signal } = {}) {
  const response = await httpClient.get(ENDPOINTS.companies.list, { params: clean(params), signal })

  return {
    items: response.data?.data?.items ?? [],
    pagination: response.data?.meta?.pagination ?? null,
  }
}

export async function fetchCompany(id, { signal } = {}) {
  const response = await httpClient.get(ENDPOINTS.companies.detail(id), { signal })
  return response.data?.data ?? null
}

/**
 * Edits a company.
 *
 * The server owns which fields are writable — `companyUpdateSchema` rejects
 * anything else — so this sends the patch as given rather than keeping a second
 * list of editable fields that would drift from it.
 */
export async function updateCompany(id, payload, { signal } = {}) {
  const response = await httpClient.put(ENDPOINTS.companies.detail(id), payload, { signal })

  return response.data?.data?.company ?? null
}

/**
 * Soft-deletes one company.
 *
 * Its enquiries are deliberately untouched by the server — a lead keeps
 * pointing at the company it came from. Nothing here needs to compensate.
 */
export async function deleteCompany(id, { signal } = {}) {
  const response = await httpClient.delete(ENDPOINTS.companies.detail(id), { signal })

  return response.data?.data ?? null
}

/**
 * Bulk delete: either named ids, or every company in the register.
 *
 * `all` is resolved on the server against the database, not against whatever
 * page happened to be loaded. The two are mutually exclusive and the server
 * rejects a body carrying both, so exactly one is sent.
 *
 * Axios puts a DELETE body under `data`, not as the second argument.
 *
 * @param {{ ids?: string[], all?: true }} payload
 */
export async function deleteCompanies(payload, { signal } = {}) {
  const response = await httpClient.delete(ENDPOINTS.companies.list, { data: payload, signal })

  return response.data?.data ?? { deleted: 0 }
}

// ---------------------------------------------------------------------------
// Workbook import
// ---------------------------------------------------------------------------

/**
 * Uploads the workbook and reports what each worksheet is.
 *
 * The file goes up as a raw body rather than multipart — the endpoint always
 * takes exactly one file, and the filename travels in a header.
 */
export async function inspectWorkbook(file, { signal, onUploadProgress } = {}) {
  const response = await httpClient.post(ENDPOINTS.leads.inspectWorkbook, file, {
    headers: { 'Content-Type': 'application/octet-stream', 'X-Filename': file.name },
    signal,
    onUploadProgress,
  })
  return response.data?.data ?? null
}

/**
 * Imports one worksheet.
 *
 * `dryRun` runs the identical code path without writing, so the preview cannot
 * disagree with the outcome.
 */
export async function importWorkbook(
  file,
  { sheet, mapping = null, overwriteStage = false, dryRun = false, signal, onUploadProgress } = {},
) {
  const response = await httpClient.post(ENDPOINTS.leads.importWorkbook, file, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'X-Filename': file.name,
      'X-Import-Options': JSON.stringify(clean({ sheet, mapping, overwriteStage, dryRun })),
    },
    signal,
    onUploadProgress,
  })
  return response.data?.data ?? null
}

/**
 * The morning run.
 *
 * Compares today's workbook with the database, creates the enquiries it has
 * never seen, and emails exactly those. `dryRun` runs the identical comparison
 * without writing or sending, so the preview cannot promise something the
 * import then fails to do.
 */
export async function syncWorkbook(
  file,
  { sheet, mapping = null, dryRun = false, sendMail = true, forceResend = false, templateId = null, signal, onUploadProgress } = {},
) {
  const response = await httpClient.post(ENDPOINTS.leads.syncWorkbook, file, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'X-Filename': file.name,
      'X-Import-Options': JSON.stringify(
        clean({ sheet, mapping, dryRun, sendMail, forceResend, templateId }),
      ),
    },
    signal,
    onUploadProgress,
  })
  return response.data?.data ?? null
}

/** Every upload, newest first. */
export async function fetchWorkbookHistory(params = {}, { signal } = {}) {
  const response = await httpClient.get(ENDPOINTS.leads.workbookHistory, {
    params: clean(params),
    signal,
  })

  return {
    items: response.data?.data?.items ?? [],
    pagination: response.data?.meta?.pagination ?? null,
  }
}

/** Today's workbook, last upload, pending emails — the dashboard widgets. */
export async function fetchWorkbookStatistics({ signal } = {}) {
  const response = await httpClient.get(ENDPOINTS.leads.workbookStatistics, { signal })
  return response.data?.data ?? null
}

/** Re-sends the introduction to named leads. Always explicit. */
export async function resendIntroduction(leadIds, { templateId = null, signal } = {}) {
  const response = await httpClient.post(
    ENDPOINTS.leads.resendIntroduction,
    clean({ leadIds, templateId }),
    { signal },
  )
  return response.data?.data ?? null
}

/**
 * What a purge would remove, without removing it.
 *
 * The confirmation dialog shows a measured number — "delete 1,671 leads" is a
 * materially different decision from "delete 3".
 */
export async function fetchPurgePreview({ signal } = {}) {
  const response = await httpClient.get(ENDPOINTS.leads.purgePreview, { signal })
  return response.data?.data ?? null
}

/**
 * Deletes every lead.
 *
 * Companies, contacts, campaigns, mail history, conversations, import history
 * and the Microsoft connection are untouched. Requires owner or admin.
 */
export async function deleteAllLeads({ signal } = {}) {
  const response = await httpClient.delete(ENDPOINTS.leads.deleteAll, { signal })
  return { ...(response.data?.data ?? {}), message: response.data?.message ?? null }
}

export async function rollbackImport(importJob, { signal } = {}) {
  const response = await httpClient.post(ENDPOINTS.leads.rollback(importJob), {}, { signal })
  return response.data?.data ?? null
}

export default {
  fetchLeads,
  fetchLead,
  updateLead,
  deleteLead,
  bulkStage,
  fetchLeadFacets,
  fetchLeadStatistics,
  fetchPipeline,
  searchEverything,
  resolveLeadAudience,
  fetchCompanies,
  fetchCompany,
  updateCompany,
  inspectWorkbook,
  importWorkbook,
  syncWorkbook,
  fetchWorkbookHistory,
  fetchWorkbookStatistics,
  resendIntroduction,
  fetchPurgePreview,
  deleteAllLeads,
  rollbackImport,
}
