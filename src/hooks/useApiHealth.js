/**
 * Polls the backend health endpoint.
 *
 * Used by the foundation status page to prove the full request path works:
 * React → Axios → Vite proxy → Express → MongoDB.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

import { fetchHealth } from '@/api/services/health.service'
import { REQUEST_STATUS } from '@/constants/app.constants'

/**
 * @param {{ pollIntervalMs?: number }} [options]
 *   `pollIntervalMs` of 0 disables polling and fetches once.
 */
export function useApiHealth({ pollIntervalMs = 0 } = {}) {
  const [status, setStatus] = useState(REQUEST_STATUS.IDLE)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  // Guards against setting state after unmount, and against a slow in-flight
  // response overwriting a newer one.
  const isMountedRef = useRef(true)

  const refresh = useCallback(async () => {
    setStatus(REQUEST_STATUS.LOADING)
    try {
      const payload = await fetchHealth()
      if (!isMountedRef.current) return
      setData(payload)
      setError(null)
      setStatus(REQUEST_STATUS.SUCCESS)
    } catch (err) {
      if (!isMountedRef.current) return
      setData(null)
      setError(err)
      setStatus(REQUEST_STATUS.ERROR)
    }
  }, [])

  useEffect(() => {
    isMountedRef.current = true
    refresh()

    let timerId
    if (pollIntervalMs > 0) {
      timerId = setInterval(refresh, pollIntervalMs)
    }

    return () => {
      isMountedRef.current = false
      if (timerId) clearInterval(timerId)
    }
  }, [refresh, pollIntervalMs])

  return {
    data,
    error,
    status,
    isLoading: status === REQUEST_STATUS.LOADING,
    isError: status === REQUEST_STATUS.ERROR,
    isSuccess: status === REQUEST_STATUS.SUCCESS,
    refresh,
  }
}

export default useApiHealth
