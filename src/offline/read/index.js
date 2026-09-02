/**
 * Phase 4 — the local read surface.
 *
 * Everything a hook needs to answer a read from IndexedDB, and nothing else.
 * Import from here rather than from the files beneath it, so the internal
 * arrangement stays free to change.
 *
 *   predicates.js        the server's filter/sort semantics, translated
 *   localReads.js        one page or one record, in the API's own shape
 *   source.js            where a read should come from, and why
 *   withLocalFallback.js the single implementation of that decision
 *   useReadSource.js     live source state for the UI
 */

export {
  CAMPAIGN_ELIGIBLE_STAGES,
  DEFAULT_SORT,
  SORTS,
  isVisible,
  matchesCompany,
  matchesContact,
  matchesLead,
  paginate,
  sortRecords,
} from '@/offline/read/predicates.js'

export {
  countVisible,
  hasLocalData,
  readList,
  readLocalCompanies,
  readLocalCompany,
  readLocalContact,
  readLocalContacts,
  readLocalLead,
  readLocalLeadFacets,
  readLocalLeads,
  readOne,
} from '@/offline/read/localReads.js'

export {
  READ_SOURCE,
  SERVED_BY,
  getPreferredSource,
  isDefinitelyOffline,
  isTransportFailure,
  onPreferenceChange,
  resolveSource,
  setPreferredSource,
} from '@/offline/read/source.js'

export { withLocalFallback } from '@/offline/read/withLocalFallback.js'
export { useReadSource } from '@/offline/read/useReadSource.js'
