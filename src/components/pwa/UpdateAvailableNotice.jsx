/**
 * Offers a new version. Never takes it.
 *
 * ## The refresh is the reader's decision, always
 *
 * There is no automatic reload on any path through this component, and that is
 * the whole point of it. A consultant part-way through composing an email, or
 * half-way down a lead they are editing, loses that work to a reload they did
 * not ask for — and the update is never urgent enough to be worth it. So the
 * new worker sits waiting (`sw.js` deliberately never calls `skipWaiting()`),
 * this says so once, and nothing happens until somebody clicks.
 *
 * The notice can also be dismissed. A reader who is busy should be able to make
 * it go away without either taking the update or being nagged; the new version
 * is still waiting and will be picked up on their next natural reload.
 *
 * ## It is not a modal
 *
 * A small strip in the normal content flow. An update is the least urgent thing
 * on the screen and should not cover anything.
 */

import { useEffect, useState } from 'react'
import { Sparkles, X } from 'lucide-react'

import { onUpdateAvailable } from '@/pwa/registerServiceWorker'

/**
 * @param {{ className?: string }} props
 */
export function UpdateAvailableNotice({ className = '' }) {
  const [isReady, setIsReady] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)

  /*
   * One subscription, no polling and no interval. The registration publishes
   * once when a newer worker reaches `installed`, and `onUpdateAvailable` also
   * fires immediately if that already happened before this mounted.
   */
  useEffect(() => onUpdateAvailable(() => setIsReady(true)), [])

  if (!isReady || isDismissed) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className={[
        'flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg px-3 py-2.5 text-sm',
        'bg-sky-50 text-sky-900 ring-1 ring-sky-200',
        className,
      ].filter(Boolean).join(' ')}
    >
      <Sparkles className="size-4 shrink-0" aria-hidden="true" />

      <p className="min-w-0 flex-1">
        A new version is available. Refresh when you’re ready — your unsaved work stays as it is
        until you do.
      </p>

      <button
        type="button"
        /*
         * A reload, but only ever from a click.
         *
         * With the waiting worker in place the browser activates it on this
         * navigation, so the reader gets the new version having chosen the
         * moment. Nothing calls this on their behalf.
         */
        onClick={() => globalThis.location?.reload()}
        className={[
          'inline-flex shrink-0 items-center rounded-md bg-sky-600 px-2.5 py-1 text-xs font-medium text-white',
          'transition-colors hover:bg-sky-700',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1',
        ].join(' ')}
      >
        Refresh now
      </button>

      <button
        type="button"
        onClick={() => setIsDismissed(true)}
        aria-label="Dismiss the update notice"
        className={[
          'inline-flex shrink-0 items-center rounded-md p-1 text-sky-800 transition-colors',
          'hover:bg-sky-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500',
        ].join(' ')}
      >
        <X className="size-3.5" aria-hidden="true" />
      </button>
    </div>
  )
}

export default UpdateAvailableNotice
