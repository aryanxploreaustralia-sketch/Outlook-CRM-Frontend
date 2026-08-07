/**
 * Polls a background workbook run.
 *
 * Deliberately not built on `useApiResource`: that hook fetches once per
 * dependency change, and this needs to fetch repeatedly until a condition is
 * met and then stop. Bending it into a poller would make it worse at the job it
 * already does well.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

import { cancelWorkbookJob, fetchWorkbookJob } from '@/api/services/workbook.service'
import { isCancelledError } from '@/utils/apiError'

/** Statuses that mean the run is still going. */
const IN_FLIGHT = new Set(['queued', 'running'])

/**
 * How often to ask.
 *
 * Two seconds matches the worker's own poll interval, so the UI never waits
 * long for a state it could already have seen. The request reads one document.
 */
const POLL_MS = 2000

/**
 * @param {?string} jobId  Null when nothing is running.
 * @returns {{ job: ?object, isPolling: boolean, isFinished: boolean, error: ?Error, cancel: () => Promise<void>, isCancelling: boolean }}
 */
export function useWorkbookJob(jobId) {
  const [job, setJob] = useState(null)
  const [error, setError] = useState(null)
  const [isCancelling, setIsCancelling] = useState(false)

  // Held in a ref so the interval callback always sees the current value
  // without being torn down and recreated on every tick.
  const finishedRef = useRef(false)

  useEffect(() => {
    if (!jobId) {
      setJob(null)
      setError(null)
      finishedRef.current = false
      return undefined
    }

    finishedRef.current = false
    const controller = new AbortController()
    let timer = null

    const poll = async () => {
      try {
        const next = await fetchWorkbookJob(jobId, { signal: controller.signal })
        if (!next) return

        setJob(next)
        setError(null)

        if (!IN_FLIGHT.has(next.status)) {
          finishedRef.current = true
          if (timer) clearInterval(timer)
        }
      } catch (pollError) {
        // The normalised rejection has no `name`, so the old check never
        // matched and a poll aborted by unmount surfaced as a run failure.
        if (isCancelledError(pollError) || controller.signal.aborted) return

        /**
         * A failed poll does not stop the polling.
         *
         * The run is still going on the server; a dropped request or a brief
         * network problem should not leave the page claiming the import died.
         * The error is surfaced and the next tick tries again.
         */
        setError(pollError)
      }
    }

    void poll()
    timer = setInterval(() => void poll(), POLL_MS)

    return () => {
      controller.abort()
      if (timer) clearInterval(timer)
    }
  }, [jobId])

  const cancel = useCallback(async () => {
    if (!jobId) return

    setIsCancelling(true)
    try {
      const { job: updated } = await cancelWorkbookJob(jobId)
      if (updated) setJob(updated)
    } catch (cancelError) {
      setError(cancelError)
    } finally {
      setIsCancelling(false)
    }
  }, [jobId])

  return {
    job,
    isPolling: Boolean(jobId) && job !== null && IN_FLIGHT.has(job.status),
    isFinished: job !== null && !IN_FLIGHT.has(job.status),
    error,
    cancel,
    isCancelling,
  }
}

export default useWorkbookJob
