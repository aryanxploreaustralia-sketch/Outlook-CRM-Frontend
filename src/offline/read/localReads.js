/**
 * Reading the CRM out of IndexedDB.
 *
 * Every function here returns **exactly** the shape its online counterpart in
 * `@/api/services` returns — `{ items, pagination }` for a list, the record
 * itself for a detail read. That is the whole design: a page or hook that
 * switches source should not be able to tell, and so should need no branching
 * of its own beyond choosing which function to call.
 *
 * ## Why the whole store is read and then filtered
 *
 * IndexedDB indexes can serve one range each; the register filters on up to
 * nine fields at once, several of them case-insensitive substrings that no
 * index can answer. Reading the store and filtering in memory is what makes
 * the results *correct*, and correctness is the point — a cache that disagrees
 * with the server is worse than no cache.
 *
 * The cost is bounded and small: this runs against one user's own records
 * (3,630 leads in the largest workspace today), it is a linear pass over plain
 * objects, and it happens only when the CRM is offline or the local source was
 * deliberately chosen. `getAll()` on a store of that size is single-digit
 * milliseconds. If a workspace ever grows past the point where that holds, the
 * fix is a coarse index pre-filter feeding the same predicates — not a second
 * set of semantics.
 *
 * ## What this layer will not do
 *
 * It does not fetch, retry, decide when to be used, or write anything. Source
 * selection lives in `source.js`; writing belongs to a later phase. Reads never
 * mutate the cache, so a stale local answer can never become a stale server
 * record.
 */

import { companiesRepository } from '@/offline/repositories/companiesRepository.js'
import { contactsRepository } from '@/offline/repositories/contactsRepository.js'
import { leadsRepository } from '@/offline/repositories/leadsRepository.js'
import {
  isVisible,
  matchesCompany,
  matchesContact,
  matchesLead,
  paginate,
  sortRecords,
} from '@/offline/read/predicates.js'

/** The three entities the cache holds, and how to read each one. */
const ENTITIES = Object.freeze({
  leads: { repository: leadsRepository, matches: matchesLead },
  contacts: { repository: contactsRepository, matches: matchesContact },
  companies: { repository: companiesRepository, matches: matchesCompany },
})

/**
 * Strips the local metadata envelope before a record reaches the UI.
 *
 * The `_sync` key is this layer's bookkeeping. Handing it to a component would
 * leak an implementation detail into props, into any `Object.keys` walk, and —
 * worst — into a form that later PUTs the record back with an unknown field
 * attached. What comes out of here is the server's DTO and nothing else.
 */
function strip(record) {
  if (!record) return null
  const { _sync: _ignored, ...dto } = record
  return dto
}

/**
 * One page of an entity, filtered, sorted and paginated like the API.
 *
 * @param {string} entity  `leads` | `contacts` | `companies`
 * @param {object} [params] The same query parameters the online service takes.
 * @param {{ userId: string }} options
 * @returns {Promise<{ items: object[], pagination: object }>}
 */
export async function readList(entity, params = {}, { userId } = {}) {
  const config = ENTITIES[entity]
  if (!config) throw new Error(`Unknown entity: ${entity}`)
  if (!userId) throw new Error('A local read needs the signed-in user id.')

  const { page, limit, sort, ...criteria } = params

  const all = await config.repository.all({ userId })
  const matched = all.filter((record) => config.matches(record, criteria))
  const ordered = sortRecords(matched, entity, sort)
  const { items, pagination } = paginate(ordered, { page, limit })

  return { items: items.map(strip), pagination }
}

/**
 * One record by id, or `null`.
 *
 * Returns `null` for a record that is soft-deleted or locally tombstoned, so a
 * detail page offline behaves like the API — which 404s a deleted enquiry —
 * rather than rendering a record the server would refuse.
 */
export async function readOne(entity, id, { userId } = {}) {
  const config = ENTITIES[entity]
  if (!config) throw new Error(`Unknown entity: ${entity}`)
  if (!userId || !id) return null

  const record = await config.repository.get(String(id), { userId })
  if (!record || !isVisible(record)) return null

  return strip(record)
}

/** How many visible records the cache holds. Cheap enough to gate a fallback on. */
export async function countVisible(entity, { userId } = {}) {
  const config = ENTITIES[entity]
  if (!config || !userId) return 0

  const all = await config.repository.all({ userId })
  return all.filter(isVisible).length
}

/**
 * Whether the local cache can answer for this entity at all.
 *
 * A fallback that returns an empty register looks exactly like a workspace with
 * no enquiries, which is a worse failure than an honest error. Callers use this
 * to tell "nothing cached yet" from "genuinely no results".
 */
export async function hasLocalData(entity, { userId } = {}) {
  return (await countVisible(entity, { userId })) > 0
}

// ---------------------------------------------------------------------------
// Named readers, mirroring the online service functions one for one.
// ---------------------------------------------------------------------------

export const readLocalLeads = (params, options) => readList('leads', params, options)
export const readLocalLead = (id, options) => readOne('leads', id, options)

export const readLocalContacts = (params, options) => readList('contacts', params, options)
export const readLocalContact = (id, options) => readOne('contacts', id, options)

export const readLocalCompanies = (params, options) => readList('companies', params, options)
export const readLocalCompany = (id, options) => readOne('companies', id, options)

/**
 * The register's filter dropdowns, computed from what is cached.
 *
 * Mirrors `leadFacets` on the server, which also derives its options from the
 * leads that exist rather than from a fixed list — so the offline city filter
 * offers whatever the workbook actually says.
 */
export async function readLocalLeadFacets({ userId } = {}) {
  const all = (await leadsRepository.all({ userId })).filter(isVisible)

  const distinct = (field) => [...new Set(
    all.map((row) => row[field]).filter((value) => value !== null && value !== undefined && value !== ''),
  )]

  const months = new Map()
  for (const row of all) {
    if (!row.travelDate) continue
    const month = new Date(row.travelDate).toISOString().slice(0, 7)
    months.set(month, (months.get(month) ?? 0) + 1)
  }

  const companies = new Map()
  for (const row of all) {
    if (!row.company) continue
    const entry = companies.get(row.company) ?? { id: row.company, name: row.companyName, leadCount: 0 }
    entry.leadCount += 1
    companies.set(row.company, entry)
  }

  return {
    cities: distinct('city').sort((a, b) => a.localeCompare(b)),
    handledBy: distinct('handledBy').sort(),
    markets: distinct('market'),
    travelMonths: [...months.entries()]
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(0, 60),
    companies: [...companies.values()]
      .sort((a, b) => b.leadCount - a.leadCount)
      .slice(0, 200),
  }
}

export default {
  readList, readOne, countVisible, hasLocalData,
  readLocalLeads, readLocalLead,
  readLocalContacts, readLocalContact,
  readLocalCompanies, readLocalCompany,
  readLocalLeadFacets,
}
