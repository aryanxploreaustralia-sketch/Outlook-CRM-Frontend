/**
 * Contacts list state, with the actions the toolbar needs beside it.
 *
 * The fetch machinery lives in `useApiResource`; this hook declares what to
 * fetch and owns the mutations, so a page renders state and dispatches actions
 * without touching transport.
 */

import { useCallback, useMemo, useState } from 'react'

import {
  bulkAction,
  deleteContact,
  exportContacts,
  fetchContacts,
  syncContacts,
} from '@/api/services/contact.service'
import { useApiResource } from '@/hooks/useApiResource'

/**
 * @param {{ page?: number, limit?: number, sort?: string, search?: string,
 *           filter?: string, company?: string, country?: string, tags?: string[],
 *           group?: string, enabled?: boolean }} [options]
 */
export function useContacts({
  page = 1,
  limit = 50,
  sort = '-created',
  search = '',
  filter = '',
  company = '',
  country = '',
  tags = [],
  group = '',
  enabled = true,
} = {}) {
  const [action, setAction] = useState(null)
  const [actionError, setActionError] = useState(null)

  // Serialised so the memo key is stable — an array literal would be a new
  // reference every render and re-fetch endlessly.
  const tagKey = tags.join(',')

  const fetcher = useCallback(
    ({ signal }) =>
      fetchContacts(
        { page, limit, sort, search, filter, company, country, group, tags: tagKey },
        { signal },
      ),
    [page, limit, sort, search, filter, company, country, group, tagKey],
  )

  const resource = useApiResource(fetcher, { enabled })
  const { refresh } = resource

  /** Runs a mutation, then refreshes in the background so the page stays put. */
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

  const remove = useCallback(
    (id) => perform(`delete:${id}`, () => deleteContact(id)),
    [perform],
  )

  const runBulk = useCallback(
    (payload) => perform(`bulk:${payload.action}`, () => bulkAction(payload)),
    [perform],
  )

  const sync = useCallback(
    (mode = 'incremental') => perform('sync', () => syncContacts({ mode })),
    [perform],
  )

  // Export deliberately does not refresh — it downloads a file and changes
  // nothing, so re-fetching the list afterwards would be wasted work.
  const exportAll = useCallback(async (payload) => {
    setAction('export')
    setActionError(null)
    try {
      return await exportContacts(payload)
    } catch (error) {
      setActionError(error)
      return null
    } finally {
      setAction(null)
    }
  }, [])

  return {
    ...resource,
    items: resource.data?.items ?? [],
    facets: useMemo(
      () => resource.data?.facets ?? { companies: [], countries: [], tags: [] },
      [resource.data],
    ),
    pagination: resource.data?.meta ?? null,
    action,
    isBusy: action !== null,
    actionError,
    remove,
    runBulk,
    sync,
    exportAll,
  }
}

export default useContacts
