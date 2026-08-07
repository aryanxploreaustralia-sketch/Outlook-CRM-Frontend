/**
 * Email template state.
 *
 * The fetch machinery lives in `useApiResource`; these hooks declare what to
 * fetch and own the mutations, so a page renders state and dispatches actions
 * without touching transport.
 */

import { useCallback, useState } from 'react'

import {
  activateTemplate,
  archiveTemplate,
  deactivateTemplate,
  deleteTemplate,
  duplicateTemplate,
  fetchActiveTemplate,
  fetchTemplateVariables,
  fetchTemplates,
  restoreTemplate,
} from '@/api/services/template.service'
import { useApiResource } from '@/hooks/useApiResource'

/**
 * The library, with its lifecycle actions.
 *
 * @param {{ status?: string, category?: string, search?: string, includeArchived?: boolean }} [filters]
 */
export function useTemplateList({ status = '', category = '', search = '', includeArchived = false } = {}) {
  const [action, setAction] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [notice, setNotice] = useState(null)

  const fetcher = useCallback(
    ({ signal }) => fetchTemplates({ status, category, search, includeArchived }, { signal }),
    [status, category, search, includeArchived],
  )

  const resource = useApiResource(fetcher)
  const { refresh } = resource

  /**
   * Runs one lifecycle action and refreshes.
   *
   * The server's own message is surfaced rather than a generic one, because it
   * says the thing that matters — which template was deactivated to make room,
   * or that no template is active any more and automatic sending has stopped.
   */
  const perform = useCallback(
    async (name, operation) => {
      setAction(name)
      setActionError(null)
      setNotice(null)

      try {
        const result = await operation()
        await refresh({ isBackground: true })
        if (result?.message) setNotice(result.message)
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

  return {
    items: resource.data?.items ?? [],
    activeTemplate: resource.data?.activeTemplate ?? null,
    isInitialLoading: resource.isInitialLoading,
    isLoading: resource.isLoading,
    isError: resource.isError,
    error: resource.error,
    refresh,

    action,
    isBusy: action !== null,
    actionError,
    notice,
    dismissNotice: () => setNotice(null),

    activate: (id) => perform(`activate:${id}`, () => activateTemplate(id)),
    deactivate: (id) => perform(`deactivate:${id}`, () => deactivateTemplate(id)),
    archive: (id) => perform(`archive:${id}`, () => archiveTemplate(id)),
    restore: (id) => perform(`restore:${id}`, () => restoreTemplate(id)),
    duplicate: (id) => perform(`duplicate:${id}`, () => duplicateTemplate(id)),
    remove: (id) => perform(`delete:${id}`, async () => ({ message: await deleteTemplate(id) })),
  }
}

/**
 * The variable catalogue.
 *
 * Fetched rather than hard-coded so the picker can never offer a variable the
 * server cannot fill.
 */
export function useTemplateVariables() {
  const fetcher = useCallback(({ signal }) => fetchTemplateVariables({ signal }), [])
  const resource = useApiResource(fetcher)

  return { variables: resource.data ?? [], isLoading: resource.isLoading }
}

/**
 * What the morning run would send.
 *
 * Used by the dashboard and the import screen to warn *before* an upload that
 * nothing would be emailed — which is far more useful than the same message
 * after the operator has waited for a 1,700-row import.
 */
export function useActiveTemplate({ enabled = true } = {}) {
  const fetcher = useCallback(({ signal }) => fetchActiveTemplate({ signal }), [])
  const resource = useApiResource(fetcher, { enabled })

  return {
    hasActiveTemplate: resource.data?.hasActiveTemplate ?? null,
    template: resource.data?.template ?? null,
    isLoading: resource.isLoading,
    refresh: resource.refresh,
  }
}

export default useTemplateList
