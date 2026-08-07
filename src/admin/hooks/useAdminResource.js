/**
 * The data hook every admin page uses.
 *
 * Shaped like `@/hooks/useApiResource` — `{ data, error, isLoading, refresh }` —
 * so an admin page reads the same way a CRM page does.
 *
 * ## What Phase 14.2 changed
 *
 * The `previewState` override is gone. It existed so a phase with no backend
 * could still demonstrate its loading and empty states; there is a backend now,
 * and a switch that fakes a loading state would only hide a real one.
 *
 * Requests are now cancellable and the error is now a real error.
 *
 * ## Cancellation, and why it is not optional
 *
 * React runs an effect, its cleanup, then the effect again on mount in
 * development. Without an `AbortSignal` the first request is left in flight, and
 * a filter changed twice quickly can have its *first* response arrive last and
 * overwrite the second. The abort is paired with a request-id guard because they
 * defend different things: the signal stops the request, the id stops a response
 * that was already in flight from being applied.
 *
 * An aborted request is normal control flow and must never surface as an error —
 * `isCancelledError` exists because `httpClient` rejects with a plain object
 * that has no `name`, so the obvious guard silently fails.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

import { isCancelledError } from '@/utils/apiError'

/**
 * @param {(options: { signal: AbortSignal }) => Promise<any>} loader
 * @param {{ deps?: unknown[], enabled?: boolean }} [options]
 * @returns {{
 *   data: any,
 *   error: ?object,
 *   isLoading: boolean,
 *   isRefreshing: boolean,
 *   hasLoaded: boolean,
 *   refresh: () => void,
 * }}
 */
export function useAdminResource(loader, options = {}) {
  const { deps = [], enabled = true } = options

  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [isLoading, setIsLoading] = useState(enabled)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [nonce, setNonce] = useState(0)

  /** Guards against a superseded response overwriting a newer one. */
  const requestRef = useRef(0)

  const loaderRef = useRef(loader)
  loaderRef.current = loader

  /**
   * `deps` collapsed to one stable string.
   *
   * Spreading a caller-supplied array into a dependency list gives it a length
   * the linter cannot check and React only tolerates while that length never
   * changes. Serialising compares by value instead, so a page passing a fresh
   * object each render does not refetch on every keystroke.
   */
  const depsKey = JSON.stringify(deps)

  useEffect(() => {
    if (!enabled) return undefined

    const requestId = requestRef.current + 1
    requestRef.current = requestId

    const controller = new AbortController()

    setIsLoading(true)

    loaderRef
      .current({ signal: controller.signal })
      .then((result) => {
        if (requestRef.current !== requestId) return
        setData(result)
        setError(null)
        setHasLoaded(true)
      })
      .catch((caught) => {
        // An abort is expected: a superseding request or an unmount, not a fault.
        if (isCancelledError(caught) || requestRef.current !== requestId) return
        setError(caught)
      })
      .finally(() => {
        if (requestRef.current !== requestId) return
        setIsLoading(false)
      })

    return () => controller.abort()
    // `loader` is read through a ref, so an inline arrow at the call site cannot
    // cause a refetch loop. Pages control refetching through `deps`, which is
    // the explicit and readable channel.
  }, [enabled, nonce, depsKey])

  const refresh = useCallback(() => setNonce((previous) => previous + 1), [])

  /**
   * The two loading states are derived rather than tracked separately.
   *
   * A first load has nothing to show and wants a skeleton. A refetch already has
   * a rendered table, and replacing it with a skeleton on every filter keystroke
   * is a layout jump — so a page dims the current render instead. Deriving both
   * from one flag means they can never disagree.
   */
  return {
    data,
    error,
    isLoading: isLoading && !hasLoaded,
    isRefreshing: isLoading && hasLoaded,
    hasLoaded,
    refresh,
  }
}

export default useAdminResource
