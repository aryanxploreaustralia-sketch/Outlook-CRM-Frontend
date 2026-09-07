/**
 * Says the CRM is offline, and that work can continue.
 *
 * ## It never blocks
 *
 * This is a strip above the page content, not an overlay and not a modal. The
 * offline-first layer exists precisely so a consultant can keep working without
 * a connection; a banner that covered the interface would take away the thing
 * the architecture was built to provide. It also does not disable a single
 * control — `navigator.onLine === false` is a fact about the network, not a
 * reason to stop somebody typing.
 *
 * ## Reconnect is a moment, not a state
 *
 * When the connection returns, the coordinator starts a sync on its own
 * `online` handler. The banner follows that: it turns into "Back online —
 * syncing…" while the run is in flight, then "All changes synced" briefly, then
 * removes itself. Nothing here triggers the sync — it only reports it — so
 * there is no second trigger and no request of its own.
 *
 * The success line is shown for a few seconds and then dismissed by a timer.
 * That timer is a UI dismissal, not polling: it fires once per reconnection and
 * makes no request.
 */

import { useEffect, useRef, useState } from 'react'
import { CloudOff, RefreshCw, CheckCircle2 } from 'lucide-react'

import { CONNECTION_UX } from '@/offline/ux/connectionState'

/** How long "All changes synced" stays before the banner removes itself. */
const CONFIRMATION_MS = 4000

/**
 * @param {object} props
 * @param {string} props.state    A `CONNECTION_UX` value.
 * @param {number} [props.pending]
 * @param {string} [props.className]
 */
export function OfflineBanner({ state, pending = 0, className = '' }) {
  /**
   * Whether this session has actually been offline.
   *
   * Without it, every cold start would flash "All changes synced" during the
   * first sync — announcing a recovery from a problem the user never had.
   */
  const wasOffline = useRef(false)
  const [showConfirmation, setShowConfirmation] = useState(false)

  useEffect(() => {
    if (state === CONNECTION_UX.OFFLINE) {
      wasOffline.current = true
      setShowConfirmation(false)
    }
  }, [state])

  useEffect(() => {
    // Back to a settled online state after having been offline: confirm once.
    if (state !== CONNECTION_UX.ONLINE || !wasOffline.current) return undefined

    wasOffline.current = false
    setShowConfirmation(true)

    const timer = setTimeout(() => setShowConfirmation(false), CONFIRMATION_MS)
    return () => clearTimeout(timer)
  }, [state])

  const isOffline = state === CONNECTION_UX.OFFLINE
  const isReconnecting = state === CONNECTION_UX.SYNCING && wasOffline.current

  // The ordinary case renders nothing at all.
  if (!isOffline && !isReconnecting && !showConfirmation) return null

  const { Icon, tone, message, spin } = isOffline
    ? {
        Icon: CloudOff,
        tone: 'bg-amber-50 text-amber-900 ring-amber-200',
        spin: false,
        message:
          pending > 0
            ? `You’re offline. You can keep working — ${pending} change${pending === 1 ? '' : 's'} will sync when you’re back online.`
            : 'You’re offline. You can keep working with the data already on this device, and changes will sync when you’re back online.',
      }
    : isReconnecting
      ? {
          Icon: RefreshCw,
          tone: 'bg-sky-50 text-sky-900 ring-sky-200',
          spin: true,
          message: 'Back online — syncing your changes…',
        }
      : {
          Icon: CheckCircle2,
          tone: 'bg-emerald-50 text-emerald-900 ring-emerald-200',
          spin: false,
          message: 'All changes synced.',
        }

  return (
    <div
      role="status"
      aria-live="polite"
      className={[
        'flex items-start gap-2.5 rounded-lg px-3 py-2.5 text-sm ring-1',
        tone,
        className,
      ].filter(Boolean).join(' ')}
    >
      <Icon
        className={`mt-0.5 size-4 shrink-0 ${spin ? 'animate-spin' : ''}`}
        aria-hidden="true"
      />
      <p className="min-w-0 flex-1">{message}</p>
    </div>
  )
}

export default OfflineBanner
