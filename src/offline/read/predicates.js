/**
 * The server's list semantics, expressed over cached records.
 *
 * ## Why this file is written the way it is
 *
 * An offline register that quietly disagrees with the online one is worse than
 * no offline register: the numbers look authoritative and are wrong. So every
 * predicate here is a deliberate translation of a specific Mongo clause in
 * `lead.service.js#buildLeadFilter` and `contact.repository.js#buildFilter`,
 * and each carries the clause it mirrors. When the server changes, the comment
 * says what to change here.
 *
 * The three rules that produce most of the disagreements, made explicit:
 *
 *  1. **Exact-match filters are case-insensitive.** The server builds
 *     `new RegExp('^' + escaped + '$', 'i')` for `city`, `handledBy`, contact
 *     `company` and `country`. A `===` here would drop "mumbai" when the filter
 *     says "Mumbai".
 *  2. **Search is a case-insensitive substring**, not a token match, over a
 *     fixed field list. The server moved off `$text` precisely so that `XAMP`
 *     and `1687` both find `XAMP1687`; `includes` is the faithful translation.
 *  3. **Date windows are UTC and inclusive at both ends.** Every `travelDate`
 *     and `quoteDate` is a calendar date stored at 00:00:00Z, so a bound built
 *     from local midnight would shift the window by the reader's offset.
 *
 * Nothing here touches IndexedDB. It is pure, which is what lets the
 * verification suite compare it against the real MongoDB result set.
 */

import { CAMPAIGN_ELIGIBLE_STAGES } from '@/constants/lead.constants'
import { metaOf } from '@/offline/repositories/recordRepository.js'

/*
 * Eligibility comes from the CRM's own constants, not from a list written out
 * here. That file already derives it from `LEAD_STAGES[].eligible`, and it is
 * the same vocabulary the register's filters and the campaign builder use — so
 * a stage becoming eligible changes one place and this follows.
 */
export { CAMPAIGN_ELIGIBLE_STAGES }

/** How many days "recently added" and "recently contacted" look back. */
const RECENT_WINDOW_DAYS = 30

/** A value the server would treat as absent. */
const blank = (value) => value === null || value === undefined || value === ''

/** Case-insensitive equality — the server's `^…$` anchored `i` regex. */
const sameText = (left, right) =>
  String(left ?? '').trim().toLowerCase() === String(right ?? '').trim().toLowerCase()

/** Case-insensitive substring — the server's unanchored `i` regex. */
const contains = (haystack, needle) =>
  String(haystack ?? '').toLowerCase().includes(String(needle ?? '').toLowerCase())

/**
 * Any of `fields` containing `term`, flattening arrays.
 *
 * `phones`, `tags` and `matchPhones` are arrays, and a Mongo regex against an
 * array field matches when **any** element matches. Flattening reproduces that
 * rather than stringifying the array, which would match across element
 * boundaries.
 */
const anyContains = (record, fields, term) =>
  fields.some((field) => {
    const value = record?.[field]
    if (Array.isArray(value)) return value.some((entry) => contains(entry, term))
    return contains(value, term)
  })

/** A date-ish value as milliseconds, or null when it cannot be one. */
export function toTime(value) {
  if (blank(value)) return null
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime()
  return Number.isNaN(time) ? null : time
}

/** `YYYY-MM-DD` → the first millisecond of that UTC day. */
const startOfDayUtc = (value) => new Date(`${value}T00:00:00.000Z`).getTime()

/** `YYYY-MM-DD` → the last millisecond of that UTC day. Inclusive, deliberately. */
const endOfDayUtc = (value) => new Date(`${value}T23:59:59.999Z`).getTime()

/**
 * A closed date window over one field.
 *
 * Returns `true` when no bound was requested, so an unfiltered register is
 * unaffected. A record whose date is absent or unparseable fails a bounded
 * window — matching Mongo, which brackets by type and so never returns a null
 * date from a `$gte` against a Date.
 */
function withinWindow(value, from, to) {
  if (blank(from) && blank(to)) return true

  const time = toTime(value)
  if (time === null) return false

  if (!blank(from) && time < startOfDayUtc(from)) return false
  if (!blank(to) && time > endOfDayUtc(to)) return false
  return true
}

/** `YYYY-MM` → `[inclusive start, exclusive end)` in UTC. Mirrors the server. */
function monthWindow(travelMonth) {
  const [year, month] = travelMonth.split('-').map(Number)
  return [
    Date.UTC(year, month - 1, 1),
    Date.UTC(month === 12 ? year + 1 : year, month === 12 ? 0 : month, 1),
  ]
}

/**
 * Whether a cached record is visible to a list read at all.
 *
 * Two independent ways a record can be gone, and both must be honoured:
 *
 *  - `isDeleted` — the server's soft delete, stamped onto the feed payload by
 *    `sync.service.js`. Every online list endpoint applies `isDeleted: false`.
 *  - `_sync.deletedLocally` — a tombstone the hydration layer wrote because the
 *    server reported the record hard-deleted. Phase 3 keeps the row rather than
 *    destroying it, so the row is still here and must be filtered out.
 *
 * Getting this wrong is the difference between an offline register that agrees
 * with the online one and one that shows deleted enquiries.
 */
export function isVisible(record) {
  if (record?.isDeleted === true) return false
  if (metaOf(record).deletedLocally === true) return false
  return true
}

// ---------------------------------------------------------------------------
// Leads — mirrors `buildLeadFilter`
// ---------------------------------------------------------------------------

/**
 * @param {object} record  A cached lead (the `toSummaryJSON` shape).
 * @param {object} criteria
 * @returns {boolean}
 */
export function matchesLead(record, criteria = {}) {
  const {
    stage, stages, city, company, contact, handledBy, market, travelMonth,
    campaignEligible, doNotContact, quoteFrom, quoteTo, travelFrom, travelTo, search,
  } = criteria

  if (!isVisible(record)) return false

  // `if (stage) filter.stage = stage`
  if (!blank(stage) && record.stage !== stage) return false

  if (Array.isArray(stages) && stages.length > 0 && !stages.includes(record.stage)) return false

  if (!blank(city) && !sameText(record.city, city)) return false
  if (!blank(market) && record.market !== market) return false
  if (!blank(handledBy) && !sameText(record.handledBy, handledBy)) return false

  // `company` and `contact` are ObjectId equality on the server; the DTO
  // carries them as strings already.
  if (!blank(company) && String(record.company ?? '') !== String(company)) return false
  if (!blank(contact) && String(record.contact ?? '') !== String(contact)) return false

  if (doNotContact !== null && doNotContact !== undefined
      && Boolean(record.doNotContact) !== Boolean(doNotContact)) return false

  if (!withinWindow(record.travelDate, travelFrom, travelTo)) return false
  if (!withinWindow(record.quoteDate, quoteFrom, quoteTo)) return false

  if (!blank(travelMonth) && /^\d{4}-\d{2}$/.test(travelMonth)) {
    const time = toTime(record.travelDate)
    if (time === null) return false
    const [from, to] = monthWindow(travelMonth)
    if (time < from || time >= to) return false
  }

  /*
   * Eligibility INTERSECTS the requested stages rather than replacing them.
   *
   * Replacing them was a real server-side bug: asking for a `booked` audience
   * returned the whole open pipeline. The intersection is reproduced here so
   * an offline audience count cannot contradict the online one.
   */
  if (campaignEligible === true) {
    const requested = !blank(stage)
      ? [stage]
      : (Array.isArray(stages) && stages.length > 0 ? stages : null)

    const allowed = requested
      ? requested.filter((value) => CAMPAIGN_ELIGIBLE_STAGES.includes(value))
      : CAMPAIGN_ELIGIBLE_STAGES

    if (!allowed.includes(record.stage)) return false
    if (record.doNotContact === true) return false
    if (blank(record.email)) return false
  }

  // The five fields the search box advertises.
  if (!blank(search)
      && !anyContains(record, ['reference', 'contactPerson', 'companyName', 'email', 'city'], search)) {
    return false
  }

  return true
}

// ---------------------------------------------------------------------------
// Contacts — mirrors `contact.repository.js#buildFilter`
// ---------------------------------------------------------------------------

const daysAgo = (days) => Date.now() - days * 24 * 60 * 60 * 1000

export function matchesContact(record, criteria = {}) {
  const { search, filter, company, country, tags, category, source } = criteria

  if (!isVisible(record)) return false

  if (!blank(company) && !sameText(record.company, company)) return false
  if (!blank(country) && !sameText(record.country, country)) return false
  if (!blank(category) && record.category !== category) return false
  if (!blank(source) && record.source !== source) return false

  // `$all` — every requested tag must be present.
  if (Array.isArray(tags) && tags.length > 0) {
    const held = (record.tags ?? []).map((tag) => String(tag).toLowerCase())
    if (!tags.every((tag) => held.includes(String(tag).toLowerCase()))) return false
  }

  switch (filter) {
    case 'favorites':
      if (record.favorite !== true) return false
      break
    case 'recentlyAdded': {
      const time = toTime(record.createdAt)
      if (time === null || time < daysAgo(RECENT_WINDOW_DAYS)) return false
      break
    }
    case 'recentlyContacted': {
      const time = toTime(record.lastInteraction)
      if (time === null || time < daysAgo(RECENT_WINDOW_DAYS)) return false
      break
    }
    case 'crmOnly':
      if (!['crm', 'import', 'api'].includes(record.source)) return false
      break
    case 'outlookOnly':
      if (record.source !== 'outlook') return false
      break
    case 'hasConflict':
      if (record.syncStatus !== 'conflict') return false
      break
    default:
      break
  }

  if (!blank(search) && !anyContains(record, [
    'displayName', 'firstName', 'lastName', 'company',
    'primaryEmail', 'secondaryEmail', 'matchPhones', 'tags', 'notes',
  ], search)) {
    return false
  }

  return true
}

// ---------------------------------------------------------------------------
// Companies
// ---------------------------------------------------------------------------

export function matchesCompany(record, criteria = {}) {
  const { search, country, state, status } = criteria

  if (!isVisible(record)) return false

  if (!blank(country) && !sameText(record.country, country)) return false
  if (!blank(state) && !sameText(record.state, state)) return false
  if (!blank(status) && record.status !== status) return false

  if (!blank(search)
      && !anyContains(record, ['companyName', 'companyCode', 'emailDomain', 'city', 'email'], search)) {
    return false
  }

  return true
}

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

/**
 * Sort specifications, mirroring the server's `SORT_OPTIONS` maps exactly.
 *
 * Each entry is a list of `[field, direction]` pairs, so a compound sort such
 * as the contacts' `company` (company then displayName) is expressible.
 */
export const SORTS = Object.freeze({
  leads: Object.freeze({
    '-created': [['createdAt', -1]],
    created: [['createdAt', 1]],
    '-quote': [['quoteDate', -1]],
    quote: [['quoteDate', 1]],
    '-travel': [['travelDate', -1]],
    travel: [['travelDate', 1]],
    reference: [['reference', 1]],
    '-reference': [['reference', -1]],
    person: [['contactPerson', 1]],
    company: [['companyName', 1]],
  }),
  contacts: Object.freeze({
    name: [['displayName', 1]],
    '-name': [['displayName', -1]],
    created: [['createdAt', 1]],
    '-created': [['createdAt', -1]],
    updated: [['updatedAt', 1]],
    '-updated': [['updatedAt', -1]],
    company: [['company', 1], ['displayName', 1]],
    interaction: [['lastInteraction', -1]],
  }),
  companies: Object.freeze({
    name: [['companyName', 1]],
    '-name': [['companyName', -1]],
    leads: [['leadCount', -1]],
    '-leads': [['leadCount', -1]],
    created: [['createdAt', 1]],
    '-created': [['createdAt', -1]],
  }),
})

/** The sort each entity falls back to, matching the server's default. */
export const DEFAULT_SORT = Object.freeze({
  leads: '-quote',
  contacts: '-created',
  companies: 'name',
})

/** Fields compared as dates rather than as text. */
const DATE_FIELDS = new Set([
  'createdAt', 'updatedAt', 'quoteDate', 'travelDate', 'lastInteraction', 'lastLeadAt',
])

/**
 * Compares two values the way MongoDB orders them for a single key.
 *
 * The detail that matters: **a missing value sorts before every present one**,
 * ascending. MongoDB treats `null`/absent as lower than any date or string, so
 * a descending `-quote` puts undated enquiries last — which is what the
 * register shows online. Sorting them as `0` or as the empty string would
 * scatter them through the middle instead.
 */
function compareField(left, right, field) {
  const isDate = DATE_FIELDS.has(field)
  const a = isDate ? toTime(left) : (blank(left) ? null : left)
  const b = isDate ? toTime(right) : (blank(right) ? null : right)

  if (a === null && b === null) return 0
  if (a === null) return -1
  if (b === null) return 1

  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })
}

/**
 * Sorts a copy, never the input.
 *
 * `id` is appended as a final tiebreak so a page boundary cannot shuffle
 * between two reads of the same data — the same reason the sync cursor carries
 * `_id`.
 */
export function sortRecords(records, entity, sort) {
  const table = SORTS[entity] ?? {}
  const spec = table[sort] ?? table[DEFAULT_SORT[entity]] ?? []

  return [...records].sort((left, right) => {
    for (const [field, direction] of spec) {
      const result = compareField(left[field], right[field], field)
      if (result !== 0) return result * direction
    }
    return String(left.id ?? '').localeCompare(String(right.id ?? ''))
  })
}

/**
 * Slices a page and builds the pagination envelope the API returns.
 *
 * The shape is copied from `listLeads` so a consumer cannot tell the two apart:
 * same keys, same derivations, same `Math.max(1, …)` on `totalPages` so an
 * empty register still reports one page rather than zero.
 */
export function paginate(records, { page = 1, limit = 50 } = {}) {
  const total = records.length
  const safeLimit = Math.max(1, Number(limit) || 50)
  const safePage = Math.max(1, Number(page) || 1)
  const skip = (safePage - 1) * safeLimit
  const items = records.slice(skip, skip + safeLimit)

  return {
    items,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.max(1, Math.ceil(total / safeLimit)),
      hasNext: skip + items.length < total,
      hasPrevious: safePage > 1,
    },
  }
}

export default {
  matchesLead, matchesContact, matchesCompany,
  sortRecords, paginate, isVisible, toTime,
  SORTS, DEFAULT_SORT, CAMPAIGN_ELIGIBLE_STAGES,
}
