/**
 * Generic data-fetching hook.
 *
 * `useDashboard` and `useAccountStatus` would otherwise be near-identical copies
 * of the same loading/error/refresh/abort machinery. This is the one place that
 * logic lives, so a fix to request cancellation or stale-response handling
 * benefits every consumer.
 *
 * Three correctness details it handles that hand-rolled effects usually miss:
 *
 *  1. **Abort on unmount** — an in-flight request is cancelled, so no state is
 *     set on an unmounted component.
 *  2. **Stale responses** — each request carries a sequence number and a slower
 *     earlier response can never overwrite a newer one.
 *  3. **Cancellation is not an error** — an aborted request must not flash an
 *     error state on the way out.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

import { REQUEST_STATUS } from '@/constants/app.constants'
import { isCancelledError } from '@/utils/apiError'

/**
 * @template T
 * @param {(options: { signal: AbortSignal }) => Promise<T>} fetcher
 *   Must be stable — wrap it in `useCallback` at the call site, or the effect
 *   will re-run on every render.
 * @param {{ enabled?: boolean, pollIntervalMs?: number }} [options]
 */
export function useApiResource(fetcher, { enabled = true, pollIntervalMs = 0 } = {}) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [status, setStatus] = useState(REQUEST_STATUS.IDLE)

  const controllerRef = useRef(null)
  const requestIdRef = useRef(0)
  const isMountedRef = useRef(true)

  const load = useCallback(
    async ({ isBackground = false } = {}) => {
      if (!enabled) return null

      // Supersede any request still in flight.
      controllerRef.current?.abort()
      const controller = new AbortController()
      controllerRef.current = controller

      const requestId = requestIdRef.current + 1
      requestIdRef.current = requestId

      // A background refresh keeps the previous data on screen instead of
      // collapsing the page back to skeletons on every poll.
      if (!isBackground) setStatus(REQUEST_STATUS.LOADING)

      try {
        const result = await fetcher({ signal: controller.signal })

        if (!isMountedRef.current || requestId !== requestIdRef.current) return null

        setData(result)
        setError(null)
        setStatus(REQUEST_STATUS.SUCCESS)
        return result
      } catch (caught) {
        // Error-shape detection is shared with every other call site, so the
        // four hand-rolled variants that used to exist cannot drift apart
        // again. The signal check stays local — only this scope holds it.
        const wasAborted = isCancelledError(caught) || controller.signal.aborted

        if (wasAborted || !isMountedRef.current || requestId !== requestIdRef.current) return null

        setError(caught)
        setStatus(REQUEST_STATUS.ERROR)
        return null
      }
    },
    [fetcher, enabled],
  )

  useEffect(() => {
    isMountedRef.current = true

    if (!enabled) {
      setStatus(REQUEST_STATUS.IDLE)
      return undefined
    }

    load()

    let timerId
    if (pollIntervalMs > 0) {
      timerId = setInterval(() => load({ isBackground: true }), pollIntervalMs)
    }

    return () => {
      isMountedRef.current = false
      controllerRef.current?.abort()
      if (timerId) clearInterval(timerId)
    }
  }, [load, enabled, pollIntervalMs])

  const refresh = useCallback(
    (options = {}) => load({ isBackground: false, ...options }),
    [load],
  )

  return {
    data,
    error,
    status,
    isIdle: status === REQUEST_STATUS.IDLE,
    isLoading: status === REQUEST_STATUS.LOADING,
    isError: status === REQUEST_STATUS.ERROR,
    isSuccess: status === REQUEST_STATUS.SUCCESS,
    /** True only for the first load, when there is nothing to show yet. */
    isInitialLoading: status === REQUEST_STATUS.LOADING && data === null,
    refresh,
  }
}

export default useApiResource
