/**
 * The notification bell.
 *
 * Replaces the disabled placeholder that has sat in the top bar since Phase 1.
 *
 * Since Phase 15.1 this shows every kind of CRM event, not only replies:
 * role changes, mailbox connections, campaign outcomes, imports. Categories are
 * filtered server-side and each row links to the screen it concerns.
 *
 * ## Why it polls
 *
 * The replies it announces arrive on a five-minute background sync, so the
 * freshest possible bell is still five minutes behind the customer. A sixty-
 * second poll of one indexed query is comfortably inside that, and it costs a
 * fraction of what a WebSocket would cost to introduce, secure and keep alive
 * through a proxy for information that is by nature minutes old.
 *
 * ## Clicking is what marks it read
 *
 * Not opening the panel. Opening it is how you *find* the reply you care about;
 * marking everything read on open would clear the four you have not looked at
 * yet along with the one you have.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Check, Inbox, MailQuestion, X } from 'lucide-react'

import {
  dismissNotification,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/api/services/notification.service'
import { useApiResource } from '@/hooks/useApiResource'
import { ROUTE_PATHS } from '@/routes/paths'

/**
 * How often the badge refreshes.
 *
 * 30 seconds since Phase 15.1, matching the interval the server declares in
 * `meta.pollIntervalMs`. The server is the authority on how stale this may be —
 * when a WebSocket transport arrives it reports itself there and this falls back
 * to a slow safety poll without the client needing to know how it is fed.
 */
const POLL_INTERVAL_MS = 30 * 1000

/**
 * Category → dot colour.
 *
 * Colour is the *secondary* signal: every row also carries its type label as
 * text, so a reader who cannot distinguish the dots loses nothing. A colour-only
 * severity is unreadable to about one man in twelve.
 */
const CATEGORY_DOT = {
  information: 'bg-slate-400',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  error: 'bg-red-500',
  security: 'bg-brand-500',
}

const CATEGORY_LABEL = {
  all: 'All',
  information: 'Info',
  success: 'Success',
  warning: 'Warning',
  error: 'Error',
  security: 'Security',
}

/** Compact relative time — "4m", "2h", "3d". */
function timeAgo(value) {
  if (!value) return ''

  const then = new Date(value).getTime()
  if (Number.isNaN(then)) return ''

  const seconds = Math.max(0, Math.round((Date.now() - then) / 1000))
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86_400)}d ago`
}

export function NotificationBell() {
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef(null)

  /** Which category the dropdown is filtered to. `all` sends no filter. */
  const [category, setCategory] = useState('all')

  const fetcher = useCallback(
    ({ signal }) =>
      fetchNotifications({
        limit: 15,
        // Server-side. Filtering the fetched page in the browser would filter
        // only the fifteen rows it happens to hold, not the whole set.
        ...(category === 'all' ? {} : { category }),
        signal,
      }),
    [category],
  )

  /**
   * No `deps` option is needed, and there isn't one.
   *
   * `useApiResource` re-runs whenever the fetcher's identity changes, and the
   * fetcher above is memoised on `[category]` — so changing the filter refetches
   * by construction. Passing a `deps` array would have been an option the hook
   * silently ignores.
   */
  const { data, refresh } = useApiResource(fetcher, { pollIntervalMs: POLL_INTERVAL_MS })

  const items = data?.items ?? []

  /**
   * The badge counts everything unread, not the filtered page.
   *
   * The server sends it alongside, so picking "errors" never changes the badge
   * — which would otherwise look like notifications had disappeared.
   */
  const unreadCount = data?.unreadCount ?? 0
  const categories = data?.categories ?? []

  // Click-outside and Escape both dismiss. A panel that can only be closed by
  // the button that opened it is a panel people leave open by accident.
  useEffect(() => {
    if (!isOpen) return undefined

    const onPointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) setIsOpen(false)
    }
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setIsOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [isOpen])

  /**
   * Opening the enquiry is the point of the notification.
   *
   * The read-marking is fired but not awaited: navigation should feel instant,
   * and a failed mark is a badge that stays lit for sixty seconds, which is a
   * far better failure than a click that appears to do nothing.
   */
  const handleOpen = async (notification) => {
    setIsOpen(false)

    if (!notification.isRead) {
      markNotificationRead(notification.id)
        .then(() => refresh({ isBackground: true }))
        .catch(() => {})
    }

    /**
     * Where it goes.
     *
     * `link` is decided by the server, which knows which screen each type
     * belongs to. The lead fallback is for the reply notifications that predate
     * Phase 15.1 and carry no link.
     */
    if (notification.link) {
      navigate(notification.link)
    } else if (notification.lead) {
      navigate(ROUTE_PATHS.LEAD_DETAIL.replace(':id', notification.lead))
    }
  }

  /** Dismisses one. Soft on the server, so the next poll cannot bring it back. */
  const handleDismiss = async (event, notification) => {
    // The row is a button; without this the dismiss would also open it.
    event.stopPropagation()

    try {
      await dismissNotification(notification.id)
      await refresh({ isBackground: true })
    } catch {
      // It stays until the next poll, which is a better failure than a row
      // that vanishes locally and returns thirty seconds later.
    }
  }

  const handleMarkAll = async () => {
    try {
      await markAllNotificationsRead()
      await refresh({ isBackground: true })
    } catch {
      // The badge simply stays as it was until the next poll.
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label={
          unreadCount > 0 ? `Notifications — ${unreadCount} unread` : 'Notifications'
        }
        className="relative inline-flex items-center rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
      >
        <Bell className="size-5" aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid min-w-[18px] place-items-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-[18px] text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 z-30 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg sm:w-96"
        >
          <header className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5">
            <h2 className="text-sm font-semibold text-slate-900">Notifications</h2>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAll}
                className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline"
              >
                <Check className="size-3.5" aria-hidden="true" />
                Mark all read
              </button>
            )}
          </header>

          {/* --- Category filter ------------------------------------------
              Server-side: filtering the fetched page here would filter only the
              fifteen rows it holds. Counts come from the whole visible set. */}
          <div className="flex gap-1 overflow-x-auto border-b border-slate-100 px-3 py-2">
            {['all', ...categories.map((entry) => entry.value)].map((value) => {
              const entry = categories.find((c) => c.value === value)
              const isActive = category === value

              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setCategory(value)}
                  aria-pressed={isActive}
                  className={`shrink-0 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-brand-600 text-white'
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                  }`}
                >
                  {CATEGORY_LABEL[value] ?? value}
                  {entry?.total > 0 && (
                    <span className={isActive ? 'ml-1 opacity-80' : 'ml-1 text-slate-400'}>
                      {entry.total}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {items.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-slate-500">
              {category === 'all'
                ? 'No notifications yet. Activity across the CRM appears here automatically.'
                : `Nothing in ${(CATEGORY_LABEL[category] ?? category).toLowerCase()}.`}
            </p>
          ) : (
            <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
              {items.map((entry) => {
                const unmatched = entry.type === 'reply_unmatched'
                const Icon = unmatched ? MailQuestion : Inbox

                /**
                 * Openable when the server gave it a link, or when it is a
                 * legacy reply notification carrying a lead. Anything else is
                 * rendered as text rather than a dead button.
                 */
                const canOpen = Boolean(entry.link || entry.lead)

                return (
                  <li key={entry.id} className="group relative">
                    <button
                      type="button"
                      onClick={() => handleOpen(entry)}
                      disabled={!canOpen}
                      className={`flex w-full items-start gap-2.5 py-3 pl-4 pr-10 text-left transition-colors ${
                        canOpen ? 'hover:bg-slate-50' : 'cursor-default'
                      } ${entry.isRead ? '' : 'bg-brand-50/40'}`}
                    >
                      <span
                        className={`relative mt-0.5 grid size-7 shrink-0 place-items-center rounded-md ${
                          unmatched ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
                        }`}
                      >
                        <Icon className="size-4" aria-hidden="true" />
                        {/* The category, as a dot on the icon. Secondary to the
                            type label in the text — colour alone is unreadable
                            to about one man in twelve. */}
                        <span
                          className={`absolute -right-0.5 -top-0.5 size-2 rounded-full ring-2 ring-white ${
                            CATEGORY_DOT[entry.category] ?? CATEGORY_DOT.information
                          }`}
                          aria-hidden="true"
                        />
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-sm font-medium text-slate-900">
                            {entry.title}
                          </span>
                          <span className="shrink-0 text-[11px] text-slate-400">
                            {timeAgo(entry.occurredAt)}
                          </span>
                        </span>

                        {entry.body && (
                          <span className="mt-0.5 block truncate text-xs text-slate-500">
                            {entry.body}
                          </span>
                        )}

                        {(entry.companyName || entry.contactName) && (
                          <span className="mt-0.5 block truncate text-[11px] text-slate-400">
                            {[entry.contactName, entry.companyName].filter(Boolean).join(' · ')}
                          </span>
                        )}

                        {unmatched && (
                          <span className="mt-0.5 block text-[11px] text-amber-700">
                            Could not be matched to an enquiry — review in Outlook.
                          </span>
                        )}

                        {/* The type in words. This is what makes the category
                            dot legible without relying on colour. */}
                        {entry.typeLabel && !unmatched && (
                          <span className="mt-0.5 block text-[11px] text-slate-400">
                            {entry.typeLabel}
                          </span>
                        )}
                      </span>

                      {!entry.isRead && (
                        <span
                          className="mt-2 size-2 shrink-0 rounded-full bg-brand-500"
                          aria-label="Unread"
                        />
                      )}
                    </button>

                    {/* Outside the row button, not nested inside it: a button
                        within a button is invalid and the inner one does not
                        receive clicks reliably. The row reserves `pr-10` for
                        this. */}
                    <button
                      type="button"
                      onClick={(event) => handleDismiss(event, entry)}
                      aria-label="Dismiss this notification"
                      className="absolute right-2 top-3 rounded p-1 text-slate-300 opacity-0 transition-opacity hover:bg-slate-100 hover:text-slate-600 focus:opacity-100 group-hover:opacity-100"
                    >
                      <X className="size-3.5" aria-hidden="true" />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

export default NotificationBell
