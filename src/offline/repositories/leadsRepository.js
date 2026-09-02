/**
 * Cached enquiries.
 *
 * The shared record behaviour plus the two lookups the Leads page will need
 * first: by stage, and by a travel-date window. Both go through an index, so
 * neither loads the whole store to answer.
 */

import { STORE } from '@/offline/db/schema.js'
import { createRecordRepository } from '@/offline/repositories/recordRepository.js'

const base = createRecordRepository(STORE.LEADS)

export const leadsRepository = {
  ...base,

  /** Enquiries at one stage. */
  byStage(stage, options = {}) {
    return base.byIndex('stage', stage, options)
  },

  /** Enquiries in one destination market. */
  byMarket(market, options = {}) {
    return base.byIndex('market', market, options)
  },

  /**
   * Enquiries whose travel date falls in a window.
   *
   * Bounds are the `YYYY-MM-DD` strings the existing filters already emit, and
   * they compare correctly as strings against the ISO dates the API returns —
   * which is what lets this run on the index rather than over every record.
   *
   * An enquiry whose travel date is prose ("August") has no `travelDate` and is
   * therefore absent from this index. That matches the server, where a null
   * date never satisfies a range either.
   */
  byTravelDateRange(from, to, options = {}) {
    return base.byRange('travelDate', boundsToRange(from, to), options)
  },

  /** The same, for the quote date. */
  byQuoteDateRange(from, to, options = {}) {
    return base.byRange('quoteDate', boundsToRange(from, to), options)
  },
}

/** `IDBKeyRange` from an optional pair of bounds. Null means "no restriction". */
function boundsToRange(from, to) {
  if (from && to) return IDBKeyRange.bound(from, `${to}￿`)
  if (from) return IDBKeyRange.lowerBound(from)
  if (to) return IDBKeyRange.upperBound(`${to}￿`)
  return null
}

export default leadsRepository
