/**
 * Employee profile transport.
 *
 * ## Uploads are raw bodies, not multipart
 *
 * The CRM has never had a multipart parser and this phase does not add one.
 * Bytes go up as the request body with the filename and metadata in headers,
 * exactly as the workbook import does — so `Content-Type` is the file's own
 * type and the server sniffs the magic numbers regardless.
 */

import { ENDPOINTS } from '@/api/endpoints'
import { apiUrl } from '@/api/apiUrl'
import { httpClient } from '@/api/httpClient'

/** Unwraps the standard envelope. */
const unwrap = (response) => response.data?.data ?? null

export async function fetchMyProfile({ signal } = {}) {
  return unwrap(await httpClient.get(ENDPOINTS.profile.self, { signal }))
}

export async function updateMyProfile(patch) {
  return unwrap(await httpClient.patch(ENDPOINTS.profile.self, patch))
}

/**
 * Uploads a profile photo.
 *
 * `File` is sent as the body directly. Axios passes a `Blob` through untouched,
 * so the bytes arrive exactly as the browser read them.
 */
export async function uploadMyPhoto(file) {
  return unwrap(
    await httpClient.put(ENDPOINTS.profile.photo, file, {
      headers: { 'Content-Type': file.type || 'application/octet-stream', 'x-filename': file.name },
    }),
  )
}

export async function removeMyPhoto() {
  return unwrap(await httpClient.delete(ENDPOINTS.profile.photo))
}

export async function fetchMyDocuments({ signal } = {}) {
  return unwrap(await httpClient.get(ENDPOINTS.profile.documents, { signal }))
}

/**
 * Uploads a document.
 *
 * Metadata rides in `x-document-meta` as JSON rather than in the query string:
 * a title is free text and would need escaping in a URL, and a URL is logged in
 * places a header is not.
 */
export async function uploadMyDocument(file, meta) {
  return unwrap(
    await httpClient.post(ENDPOINTS.profile.documents, file, {
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
        'x-filename': file.name,
        'x-document-meta': JSON.stringify(meta),
      },
    }),
  )
}

/** Replaces the bytes, the metadata, or both. */
export async function updateMyDocument(id, { file, meta } = {}) {
  return unwrap(
    await httpClient.patch(ENDPOINTS.profile.document(id), file ?? new Blob(), {
      headers: {
        'Content-Type': file?.type || 'application/octet-stream',
        ...(file ? { 'x-filename': file.name } : {}),
        'x-document-meta': JSON.stringify(meta ?? {}),
      },
    }),
  )
}

export async function deleteMyDocument(id) {
  return unwrap(await httpClient.delete(ENDPOINTS.profile.document(id)))
}

/**
 * The URL a document is previewed or downloaded from.
 *
 * A URL rather than a fetch: letting the browser navigate gets the filename
 * from `Content-Disposition`, the download indicator and the PDF viewer for
 * free. Fetching into a Blob would discard all three.
 */
/**
 * The signed-in person's own performance (Phase 17.3).
 *
 * The same payload an administrator sees for the same person — one endpoint
 * family, one engine, so an employee and their manager can never be looking at
 * two different sets of numbers.
 */
export async function fetchMyPerformance({ range = {}, signal } = {}) {
  const response = await httpClient.get(ENDPOINTS.profile.performance, {
    params: Object.fromEntries(Object.entries(range).filter(([, value]) => value)),
    signal,
  })

  return response.data?.data ?? null
}

export function documentFileUrl(id, { download = false } = {}) {
  return apiUrl(ENDPOINTS.profile.documentFile(id), { download: download ? '1' : null })
}

/**
 * Absolute URL for a user's profile photo.
 *
 * Built here rather than taken from the profile response. The API returns a
 * relative `/api/v1/...` path, and this deployment serves the API from a
 * different origin than the app — so putting that string straight into an
 * `<img src>` resolves it against the front end and yields a 404, which the
 * browser renders as a broken image. `apiUrl()` resolves it against the
 * configured API base, exactly as `documentFileUrl` above already does.
 *
 * `version` is appended as a cache-buster. The path is identical for a given
 * user for all time, so without it a replaced photo keeps showing the old
 * bytes until the cache expires. Pass the profile's `photoUpdatedAt`.
 *
 * @param {string} userId
 * @param {?string} version
 */
export function profilePhotoUrl(userId, version) {
  return apiUrl(ENDPOINTS.profile.photoOf(userId), { v: version ? Date.parse(version) : null })
}

export default {
  deleteMyDocument,
  documentFileUrl,
  profilePhotoUrl,
  fetchMyDocuments,
  fetchMyPerformance,
  fetchMyProfile,
  removeMyPhoto,
  updateMyDocument,
  updateMyProfile,
  uploadMyDocument,
  uploadMyPhoto,
}
