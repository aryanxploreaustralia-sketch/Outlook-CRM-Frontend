/**
 * Lead register state.
 *
 * The fetch machinery lives in `useApiResource`; these hooks declare what to
 * fetch and own the mutations, so a page renders state and dispatches actions
 * without touching transport.
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
} from '@/api/services/lead.service'
import { useApiResource } from '@/hooks/useApiResource'

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
  enabled = true,
} = {}) {
  const [action, setAction] = useState(null)
  const [actionError, setActionError] = useState(null)

  const fetcher = useCallback(
    ({ signal }) =>
      fetchLeads(
        { page, limit, sort, stage, city, company, handledBy, market, travelMonth, campaignEligible, search },
        { signal },
      ),
    [page, limit, sort, stage, city, company, handledBy, market, travelMonth, campaignEligible, search],
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

  const fetcher = useCallback(({ signal }) => fetchLead(id, { signal }), [id])
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

  return {
    lead: resource.data?.lead ?? null,
    company: resource.data?.company ?? null,
    contact: resource.data?.contact ?? null,
    isInitialLoading: resource.isInitialLoading,
    isError: resource.isError,
    error: resource.error,
    refresh,
    action,
    isBusy: action !== null,
    actionError,
    save,
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
  const fetcher = useCallback(({ signal }) => fetchLeadFacets({ signal }), [])
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
  const fetcher = useCallback(
    ({ signal }) => fetchCompanies({ page, limit, sort, search }, { signal }),
    [page, limit, sort, search],
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
  const fetcher = useCallback(({ signal }) => fetchCompany(id, { signal }), [id])
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
