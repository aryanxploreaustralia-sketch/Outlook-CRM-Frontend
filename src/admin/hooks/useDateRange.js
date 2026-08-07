/**
 * The global reporting period, held in the URL.
 *
 * ## Why the URL and not component state
 *
 * The period is the single most important thing about a figure on an analytics
 * screen. Holding it in `useState` means a link to "the dashboard" is a link to
 * *a* dashboard whose period depends on whoever opens it, Back silently changes
 * what the numbers mean without changing the address, and a reader cannot send a
 * colleague the thing they are looking at.
 *
 * In the query string, all three work: `?preset=thisMonth` is the report.
 *
 * ## Why the preset name travels, not the dates
 *
 * The hook sends `preset=last7` and lets the server resolve it. Two reasons.
 * Every widget on the page then agrees on the boundary — none of them computed
 * it separately. And the boundary is the server's day, not the browser's, so a
 * reader in Sydney and one in London looking at the same link see the same rows.
 *
 * A custom range is the exception: explicit `from`/`to` are sent as given,
 * because there is nothing to resolve.
 */

import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'

/** Matches the server's default, so an unparameterised URL is not a special case. */
export const DEFAULT_PRESET = 'last30'

/**
 * Reads and writes the shared period.
 *
 * @returns {{
 *   range: { preset: string, from: string, to: string },
 *   query: { preset?: string, from?: string, to?: string },
 *   setRange: (next: { preset?: string, from?: string, to?: string }) => void,
 *   params: URLSearchParams,
 *   setParams: (next: URLSearchParams, options?: object) => void,
 * }}
 */
export function useDateRange() {
  const [params, setParams] = useSearchParams()

  const preset = params.get('preset') ?? DEFAULT_PRESET
  const from = params.get('from') ?? ''
  const to = params.get('to') ?? ''

  const range = useMemo(() => ({ preset, from, to }), [preset, from, to])

  /**
   * What actually goes on the wire.
   *
   * An explicit pair wins and the preset name is dropped, matching the server's
   * own precedence — sending both would let a stale `preset=today` sit beside a
   * custom range and leave which one applied to the reader's imagination.
   */
  const query = useMemo(() => {
    if (from || to) return { from, to }
    return { preset }
  }, [preset, from, to])

  const setRange = useCallback(
    (next) => {
      const updated = new URLSearchParams(params)

      for (const key of ['preset', 'from', 'to']) {
        const value = next[key]
        if (!value || (key === 'preset' && value === DEFAULT_PRESET)) updated.delete(key)
        else updated.set(key, value)
      }

      // Changing the period changes which rows exist, so page 4 of the old
      // period is very likely empty in the new one — and an empty table reads as
      // "no activity", which would be a lie about the data rather than the page.
      updated.delete('page')

      // `replace`: adjusting the period is refining one view, not navigating.
      // Back should leave the report, not step through every preset tried.
      setParams(updated, { replace: true })
    },
    [params, setParams],
  )

  return { params, query, range, setParams, setRange }
}

export default useDateRange
