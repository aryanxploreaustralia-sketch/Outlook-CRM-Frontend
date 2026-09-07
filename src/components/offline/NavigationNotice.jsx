/**
 * Renders the message a page handed over when it navigated here.
 *
 * ## Why this had to be added
 *
 * `LeadCreatePage` has always passed `state: { notice }` when an enquiry was
 * saved offline — the wording was written carefully, and it is the one place
 * the CRM told somebody their work had *not* reached the server. Nothing ever
 * read it. No page in the application consumes `location.state.notice`, so
 * every one of those messages has been discarded on arrival.
 *
 * That is a pre-existing defect rather than a Phase 8 one, and it is reported
 * as such. It is fixed here only because the offline create/edit/delete
 * feedback this phase was asked for is exactly what the channel carries: adding
 * more messages to a channel nobody reads would have delivered nothing.
 *
 * ## Mounted once, in the shell
 *
 * Every destination is inside `DashboardLayout`, so one mount serves all of
 * them and no page needs editing. A per-page consumer would be the same code
 * five times, with five chances to omit it.
 *
 * ## It clears itself
 *
 * History state survives a reload, so a message left in place would reappear
 * days later on a refresh, describing a save the reader has long forgotten.
 * After it has been shown once the entry is replaced with a clean one, which
 * rewrites history without navigating.
 */

import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { CloudOff, CheckCircle2, X } from 'lucide-react'

/**
 * @param {{ className?: string }} props
 */
export function NavigationNotice({ className = '' }) {
  const location = useLocation()
  const navigate = useNavigate()

  const incoming = location.state?.notice ?? null
  const [notice, setNotice] = useState(incoming)

  useEffect(() => {
    if (!incoming) return

    setNotice(incoming)

    /*
     * Take the message out of history immediately.
     *
     * `replace` with the same path and no state rewrites the current entry, so
     * the reader stays exactly where they are and a later refresh shows a clean
     * page. The message is already held in local state, so removing it from
     * history does not remove it from the screen.
     */
    navigate(location.pathname + location.search, { replace: true, state: null })
  }, [incoming, location.pathname, location.search, navigate])

  if (!notice) return null

  /*
   * Offline messages say so in their own words, and this looks for that rather
   * than requiring every caller to pass a tone it would be easy to get wrong.
   * A message about a local save is amber; anything else is a plain success.
   */
  const isOffline = /on this device|offline|queued|waiting to sync/i.test(notice)
  const Icon = isOffline ? CloudOff : CheckCircle2

  return (
    <div
      role="status"
      aria-live="polite"
      className={[
        'flex items-start gap-2.5 rounded-lg px-3 py-2.5 text-sm ring-1',
        isOffline
          ? 'bg-amber-50 text-amber-900 ring-amber-200'
          : 'bg-emerald-50 text-emerald-900 ring-emerald-200',
        className,
      ].filter(Boolean).join(' ')}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <p className="min-w-0 flex-1">{notice}</p>

      <button
        type="button"
        onClick={() => setNotice(null)}
        aria-label="Dismiss this message"
        className={[
          'shrink-0 rounded-md p-1 transition-colors',
          isOffline ? 'hover:bg-amber-100' : 'hover:bg-emerald-100',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-current',
        ].join(' ')}
      >
        <X className="size-3.5" aria-hidden="true" />
      </button>
    </div>
  )
}

export default NavigationNotice
