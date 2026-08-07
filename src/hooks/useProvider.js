/**
 * Provider status, with the connect / disconnect / sync actions beside it.
 *
 * The fetch machinery lives in `useApiResource`; this hook declares what to
 * fetch and owns the mutations, so a page renders state and dispatches actions
 * without touching transport.
 */

import { useCallback, useState } from 'react'

import {
  connectProvider,
  disconnectProvider,
  fetchProviderStatus,
  runSync,
} from '@/api/services/provider.service'
import { useApiResource } from '@/hooks/useApiResource'

/**
 * @param {{ enabled?: boolean, pollIntervalMs?: number, mailboxId?: ?string }} [options]
 *   `mailboxId` scopes every read and every action to one connected mailbox.
 *   Omitted, the server falls back to the workspace default, which is what the
 *   dashboard's status card wants and what every caller did before this phase.
 */
export function useProvider({ enabled = true, pollIntervalMs = 0, mailboxId = null } = {}) {
  const [action, setAction] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [lastRun, setLastRun] = useState(null)

  /**
   * Refetches when the selected mailbox changes.
   *
   * `mailboxId` is in the dependency list on purpose: `useApiResource` re-runs
   * the fetcher when its identity changes, so switching mailbox in the selector
   * loads that mailbox's state rather than leaving the previous one on screen.
   */
  const fetcher = useCallback(
    ({ signal }) => fetchProviderStatus({ mailboxId, signal }),
    [mailboxId],
  )
  const resource = useApiResource(fetcher, { enabled, pollIntervalMs })

  const { refresh } = resource

  /**
   * Runs a mutation, then refreshes status in the background.
   *
   * A background refresh keeps the page on screen instead of collapsing it to
   * skeletons after every button press.
   */
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

  const connect = useCallback(
    (provider) => perform('connect', () => connectProvider({ provider })),
    [perform],
  )

  /**
   * Disconnects the mailbox currently being viewed.
   *
   * Passing `mailboxId` is what stops this acting on the workspace default
   * while the operator is looking at a different mailbox.
   */
  const disconnect = useCallback(
    () => perform('disconnect', () => disconnectProvider({ mailboxId })),
    [perform, mailboxId],
  )

  const sync = useCallback(
    (folder = null, mode = 'incremental') =>
      perform(`sync:${folder ?? 'all'}`, async () => {
        const result = await runSync({ folder, mode, mailboxId })
        // Surfaced immediately so the page can show what the run did without
        // waiting for the status refresh to land.
        setLastRun(result?.run ?? null)
        return result
      }),
    [perform, mailboxId],
  )

  return {
    ...resource,
    status: resource.data,
    /** Every mailbox in the workspace, for the selector. */
    mailboxes: resource.data?.mailboxes ?? [],
    /** True when the server is serving simulated data. */
    isMockMode: resource.data?.mockMode ?? false,
    /** Name of the in-flight action, or null. */
    action,
    isBusy: action !== null,
    actionError,
    lastRun,
    connect,
    disconnect,
    sync,
  }
}

export default useProvider
