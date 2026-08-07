/**
 * Campaign list and detail state.
 *
 * The fetch machinery lives in `useApiResource`; these hooks declare what to
 * fetch and own the mutations, so a page renders state and dispatches actions
 * without touching transport.
 */

import { useCallback, useMemo, useState } from 'react'

import {
  cloneCampaign,
  controlCampaign,
  fetchCampaign,
  fetchCampaignAnalytics,
  fetchCampaigns,
  fetchEvents,
  fetchOverallAnalytics,
  fetchRecipients,
  launchCampaign,
  rebuildAudience,
  sendCampaign,
} from '@/api/services/campaign.service'
import { useApiResource } from '@/hooks/useApiResource'

/**
 * How often a live campaign's numbers are re-read.
 *
 * Three seconds is a compromise: the send loop moves in batches of 25, so
 * anything faster mostly re-renders identical numbers, and anything slower
 * makes the progress bar look stuck while a batch is in flight.
 */
export const LIVE_POLL_MS = 3000

/** Statuses whose numbers can change without the user doing anything. */
const LIVE_STATUSES = new Set(['running', 'scheduled'])

/**
 * @param {{ page?: number, limit?: number, status?: string, search?: string,
 *           sort?: string, enabled?: boolean }} [options]
 */
export function useCampaignList({
  page = 1,
  limit = 25,
  status = '',
  search = '',
  sort = '-created',
  enabled = true,
} = {}) {
  const [action, setAction] = useState(null)
  const [actionError, setActionError] = useState(null)

  const fetcher = useCallback(
    ({ signal }) => fetchCampaigns({ page, limit, status, search, sort }, { signal }),
    [page, limit, status, search, sort],
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

  const control = useCallback(
    (id, verb) => perform(`control:${id}`, () => controlCampaign(id, verb)),
    [perform],
  )

  const clone = useCallback((id) => perform(`clone:${id}`, () => cloneCampaign(id)), [perform])

  const items = resource.data?.items ?? []

  return {
    items,
    pagination: resource.data?.meta?.pagination ?? null,
    isInitialLoading: resource.isInitialLoading,
    isLoading: resource.isLoading,
    isError: resource.isError,
    error: resource.error,
    refresh,
    action,
    isBusy: action !== null,
    actionError,
    control,
    clone,
  }
}

/**
 * One campaign, its recipients and its live counters.
 *
 * Polls only while the campaign can actually change. A completed campaign whose
 * page is left open overnight would otherwise generate 28,000 pointless
 * requests before morning.
 */
export function useCampaign(id, { enabled = true } = {}) {
  const [action, setAction] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [lastSend, setLastSend] = useState(null)

  const fetcher = useCallback(({ signal }) => fetchCampaign(id, { signal }), [id])
  const resource = useApiResource(fetcher, { enabled: enabled && Boolean(id) })

  const campaign = resource.data
  const isLive = campaign ? LIVE_STATUSES.has(campaign.status) : false

  const recipientFetcher = useCallback(
    ({ signal }) => fetchRecipients(id, { limit: 50 }, { signal }),
    [id],
  )

  const recipients = useApiResource(recipientFetcher, {
    enabled: enabled && Boolean(id),
    pollIntervalMs: isLive ? LIVE_POLL_MS : 0,
  })

  const eventFetcher = useCallback(({ signal }) => fetchEvents(id, { limit: 30 }, { signal }), [id])
  const events = useApiResource(eventFetcher, { enabled: enabled && Boolean(id) })

  const { refresh } = resource
  const refreshRecipients = recipients.refresh
  const refreshEvents = events.refresh

  const perform = useCallback(
    async (name, operation) => {
      setAction(name)
      setActionError(null)
      try {
        const result = await operation()
        // All three views describe the same campaign; refreshing one and not the
        // others produces a page that contradicts itself mid-send.
        await Promise.all([
          refresh({ isBackground: true }),
          refreshRecipients({ isBackground: true }),
          refreshEvents({ isBackground: true }),
        ])
        return result
      } catch (error) {
        setActionError(error)
        return null
      } finally {
        setAction(null)
      }
    },
    [refresh, refreshRecipients, refreshEvents],
  )

  const control = useCallback((verb) => perform(`control:${verb}`, () => controlCampaign(id, verb)), [id, perform])

  const launch = useCallback(
    (scheduledFor = null) => perform('launch', () => launchCampaign(id, { scheduledFor })),
    [id, perform],
  )

  const send = useCallback(
    async (maxBatches = 1) => {
      const result = await perform('send', () => sendCampaign(id, { maxBatches }))
      // Held so the page can explain a batch that sent nothing — throttled and
      // finished are indistinguishable from the counters alone.
      if (result) setLastSend(result)
      return result
    },
    [id, perform],
  )

  const rebuild = useCallback(() => perform('audience', () => rebuildAudience(id)), [id, perform])

  const clone = useCallback(() => perform('clone', () => cloneCampaign(id)), [id, perform])

  return {
    campaign,
    recipients: recipients.data?.items ?? [],
    events: events.data?.items ?? [],
    isLive,
    isInitialLoading: resource.isInitialLoading,
    isError: resource.isError,
    error: resource.error,
    refresh,
    action,
    isBusy: action !== null,
    actionError,
    lastSend,
    control,
    launch,
    send,
    rebuild,
    clone,
  }
}

/** Per-campaign analytics, for the report tab. */
export function useCampaignAnalytics(id, { enabled = true } = {}) {
  const fetcher = useCallback(({ signal }) => fetchCampaignAnalytics(id, { signal }), [id])
  const resource = useApiResource(fetcher, { enabled: enabled && Boolean(id) })

  return {
    report: resource.data,
    isInitialLoading: resource.isInitialLoading,
    isError: resource.isError,
    error: resource.error,
    refresh: resource.refresh,
  }
}

/** Cross-campaign totals. */
export function useOverallAnalytics({ enabled = true } = {}) {
  const fetcher = useCallback(({ signal }) => fetchOverallAnalytics({ signal }), [])
  const resource = useApiResource(fetcher, { enabled })

  const report = resource.data

  /** Status counts as an ordered array, so the page does not sort inline. */
  const byStatus = useMemo(() => {
    const counts = report?.byStatus ?? {}
    return Object.entries(counts).sort(([, a], [, b]) => b - a)
  }, [report])

  return {
    report,
    byStatus,
    isInitialLoading: resource.isInitialLoading,
    isError: resource.isError,
    error: resource.error,
    refresh: resource.refresh,
  }
}

export default useCampaignList
