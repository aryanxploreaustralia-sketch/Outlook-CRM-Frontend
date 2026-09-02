/**
 * Lead register state.
 *
 * The fetch machinery lives in `useApiResource`; these hooks declare what to
 * fetch and own the mutations, so a page renders state and dispatches actions
 * without touching transport.
 *
 * ## Reading offline (Phase 4)
 *
 * Each read below is wrapped in `withLocalFallback`, which calls the same API
 * service it always did and reaches for the IndexedDB cache only when the
 * server could not be reached at all — or when somebody pinned the source to
 * `local`. On a working network the request, the response and the returned
 * shape are identical to before; the wrapper adds one `source` field naming who
 * answered, which nothing is obliged to read.
 *
 * The wrapping is skipped entirely until `useAuth` reports a user, because the
 * cache is keyed per user and there is nothing to read from without one. That
 * is also what keeps a signed-out render on exactly its old path.
 */

import { useCallback, useState } from 'react'

import {
  bulkStage,
  fetchCompanies,
  fetchCompany,
  fetchLead,
  fetchLeadFacets,
  fetchLeadStatistics,
  fetchLeads,
  fetchPipeline,
  updateLead,
  updateLeadFull,
} from '@/api/services/lead.service'
import { useApiResource } from '@/hooks/useApiResource'
import { useAuth } from '@/hooks/useAuth'
import {
  hasLocalData,
  readLocalCompanies,
  readLocalCompany,
  readLocalLead,
  readLocalLeadFacets,
  readLocalLeads,
  withLocalFallback,
} from '@/offline/read'

/**
 * @param {{ page?, limit?, sort?, stage?, city?, company?, handledBy?, market?,
 *           travelMonth?, campaignEligible?, search?, enabled? }} [options]
 */
export function useLeadList({
  page = 1,
  limit = 50,
  sort = '-quote',
  stage = '',
  city = '',
  company = '',
  handledBy = '',
  market = '',
  travelMonth = '',
  campaignEligible = '',
  search = '',
  /*
   * The two date windows, forwarded verbatim.
   *
   * All four are undefined unless a window is chosen, and `fetchLeads` drops
   * undefined keys — so a register with no date filter sends exactly the
   * request it sent before these existed.
   */
  travelFrom,
  travelTo,
  quoteFrom,
  quoteTo,
  enabled = true,
} = {}) {
  const [action, setAction] = useState(null)
  const [actionError, setActionError] = useState(null)

  const userId = useAuth().user?.id ?? null

  const fetcher = useCallback(
    ({ signal }) => {
      const params = { page, limit, sort, stage, city, company, handledBy, market, travelMonth, campaignEligible, travelFrom, travelTo, quoteFrom, quoteTo, search }
      if (!userId) return fetchLeads(params, { signal })

      return withLocalFallback({
        online: (options) => fetchLeads(params, options),
        local: () => readLocalLeads(params, { userId }),
        hasLocal: () => hasLocalData('leads', { userId }),
        signal,
      })
    },
    [page, limit, sort, stage, city, company, handledBy, market, travelMonth, campaignEligible, travelFrom, travelTo, quoteFrom, quoteTo, search, userId],
  )

  const resource = useApiResource(fetcher, { enabled })
  const { refresh } = resource

  const perform = useCallback(
    async (name, operation) => {
      setAction(name)
      setActionError(null)
      try {
        const result = await operation()
        await refresh({ isBackground: true })
        return result
      } catch (error) {
        setActionError(error)
        return null
      } finally {
        setAction(null)
      }
    },
    [refresh],
  )

  const moveStage = useCallback(
    (ids, stageValue, reason) => perform('bulk-stage', () => bulkStage({ ids, stage: stageValue, reason })),
    [perform],
  )

  return {
    items: resource.data?.items ?? [],
    pagination: resource.data?.pagination ?? null,
    isInitialLoading: resource.isInitialLoading,
    isLoading: resource.isLoading,
    isError: resource.isError,
    error: resource.error,
    refresh,
    action,
    isBusy: action !== null,
    actionError,
    moveStage,
  }
}

/** One lead with its company and contact. */
export function useLead(id, { enabled = true } = {}) {
  const [action, setAction] = useState(null)
  const [actionError, setActionError] = useState(null)

  const userId = useAuth().user?.id ?? null

  const fetcher = useCallback(
    ({ signal }) => {
      if (!userId) return fetchLead(id, { signal })

      return withLocalFallback({
        online: (options) => fetchLead(id, options),
        /*
         * The cache holds the *summary* DTO, which is a subset of the detail
         * one. Offline that is what there is, and it carries every field the
         * header and the table render; the sections that need the detail-only
         * fields simply have nothing to show until the network returns.
         */
        local: () => readLocalLead(id, { userId }),
        hasLocal: async () => Boolean(await readLocalLead(id, { userId })),
        signal,
      })
    },
    [id, userId],
  )
  const resource = useApiResource(fetcher, { enabled: enabled && Boolean(id) })
  const { refresh } = resource

  const save = useCallback(
    async (payload) => {
      setAction('save')
      setActionError(null)
      try {
        const result = await updateLead(id, payload)
        await refresh({ isBackground: true })
        return result
      } catch (error) {
        setActionError(error)
        return null
      } finally {
        setAction(null)
      }
    },
    [id, refresh],
  )

  /**
   * The composite save: enquiry, contact and company together.
   *
   * Shares `save`'s busy and error state so a caller has one place to look, and
   * refreshes the same way — the detail page shows the saved values without
   * anybody reloading the browser.
   */
  const saveFull = useCallback(
    async (payload) => {
      setAction('save')
      setActionError(null)
      try {
        const result = await updateLeadFull(id, payload)
        await refresh({ isBackground: true })
        return result
      } catch (error) {
        setActionError(error)
        return null
      } finally {
        setAction(null)
      }
    },
    [id, refresh],
  )

  return {
    lead: resource.data?.lead ?? null,
    company: resource.data?.company ?? null,
    contact: resource.data?.contact ?? null,
    /*
     * The server's answer to "may this caller edit this enquiry?".
     *
     * Read from the response rather than compared client-side, so the Edit
     * control is driven by the same rule `PUT /leads/:id` enforces. Defaults to
     * false: a payload from an older API should hide the control, not offer one
     * the server will refuse.
     */
    canEdit: resource.data?.canEdit === true,
    /** Who holds the enquiry, named by the server. `{ id, name }` or null. */
    holder: resource.data?.owner ?? null,
    isInitialLoading: resource.isInitialLoading,
    isError: resource.isError,
    error: resource.error,
    refresh,
    action,
    isBusy: action !== null,
    actionError,
    save,
    saveFull,
  }
}

/** The pipeline board. */
export function usePipeline({ perStage = 10, enabled = true } = {}) {
  const fetcher = useCallback(({ signal }) => fetchPipeline({ perStage, signal }), [perStage])
  const resource = useApiResource(fetcher, { enabled })

  return {
    columns: resource.data?.columns ?? [],
    total: resource.data?.total ?? 0,
    isInitialLoading: resource.isInitialLoading,
    isError: resource.isError,
    error: resource.error,
    refresh: resource.refresh,
  }
}

/** Filter dropdown options, fetched once per page. */
export function useLeadFacets({ enabled = true } = {}) {
  const userId = useAuth().user?.id ?? null

  const fetcher = useCallback(
    ({ signal }) => {
      if (!userId) return fetchLeadFacets({ signal })

      return withLocalFallback({
        online: (options) => fetchLeadFacets(options),
        local: () => readLocalLeadFacets({ userId }),
        hasLocal: () => hasLocalData('leads', { userId }),
        signal,
      })
    },
    [userId],
  )
  const resource = useApiResource(fetcher, { enabled })

  return {
    facets: resource.data ?? { cities: [], handledBy: [], markets: [], travelMonths: [], companies: [], stages: [] },
    isLoading: resource.isLoading,
    /**
     * Facets are derived from the rows, so anything that changes the register
     * wholesale — an import, a purge — leaves the dropdowns offering values
     * that now match nothing.
     */
    refresh: resource.refresh,
  }
}

export function useLeadStatistics({ enabled = true } = {}) {
  const fetcher = useCallback(({ signal }) => fetchLeadStatistics({ signal }), [])
  const resource = useApiResource(fetcher, { enabled })

  return {
    stats: resource.data,
    isInitialLoading: resource.isInitialLoading,
    isError: resource.isError,
    error: resource.error,
    refresh: resource.refresh,
  }
}

export function useCompanyList({ page = 1, limit = 50, sort = '-leads', search = '', enabled = true } = {}) {
  const userId = useAuth().user?.id ?? null

  const fetcher = useCallback(
    ({ signal }) => {
      const params = { page, limit, sort, search }
      if (!userId) return fetchCompanies(params, { signal })

      return withLocalFallback({
        online: (options) => fetchCompanies(params, options),
        local: () => readLocalCompanies(params, { userId }),
        hasLocal: () => hasLocalData('companies', { userId }),
        signal,
      })
    },
    [page, limit, sort, search, userId],
  )
  const resource = useApiResource(fetcher, { enabled })

  return {
    items: resource.data?.items ?? [],
    pagination: resource.data?.pagination ?? null,
    isInitialLoading: resource.isInitialLoading,
    isLoading: resource.isLoading,
    isError: resource.isError,
    error: resource.error,
    refresh: resource.refresh,
  }
}

/** One company with its people and its enquiries. */
export function useCompany(id, { enabled = true } = {}) {
  const userId = useAuth().user?.id ?? null

  const fetcher = useCallback(
    ({ signal }) => {
      if (!userId) return fetchCompany(id, { signal })

      return withLocalFallback({
        online: (options) => fetchCompany(id, options),
        local: () => readLocalCompany(id, { userId }),
        hasLocal: async () => Boolean(await readLocalCompany(id, { userId })),
        signal,
      })
    },
    [id, userId],
  )
  const resource = useApiResource(fetcher, { enabled: enabled && Boolean(id) })

  return {
    company: resource.data?.company ?? null,
    contacts: resource.data?.contacts ?? [],
    leads: resource.data?.leads ?? [],
    byStage: resource.data?.byStage ?? {},
    isInitialLoading: resource.isInitialLoading,
    isError: resource.isError,
    error: resource.error,
    refresh: resource.refresh,
  }
}

export default useLeadList
