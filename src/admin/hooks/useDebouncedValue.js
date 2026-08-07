/**
 * Delays a value until it stops changing.
 *
 * Needed the moment a filter drives a network request rather than a local
 * `filter()`. Typing "priya" into a server-backed search box is five requests
 * without this, four of which are obsolete before they land — and the one that
 * matters can arrive first, leaving the table showing results for "pri".
 *
 * `useAdminResource` also guards against out-of-order responses, and both are
 * wanted: this one stops the requests being made, that one stops a stale
 * response being applied if one is made anyway.
 *
 * The immediate value stays the input's, so typing never feels laggy — only the
 * request waits.
 */

import { useEffect, useState } from 'react'

/**
 * @template T
 * @param {T} value
 * @param {number} [delayMs] 300ms: long enough to skip intermediate keystrokes,
 *   short enough that the pause is not read as the page having stopped.
 * @returns {T}
 */
export function useDebouncedValue(value, delayMs = 300) {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}

export default useDebouncedValue
