/**
 * The one-word answer to "am I connected?", in the top bar.
 *
 * ## Not a `ConnectionBadge`
 *
 * Two components already carry that name and both mean *Microsoft mailbox*.
 * This is the browser's network, which is a different question with a different
 * answer — a consultant can be perfectly online with no mailbox connected, and
 * offline with a healthy one. The names are kept apart deliberately so nobody
 * reads one and acts on the other.
 *
 * ## Quiet by default
 *
 * Online is the ordinary case and gets the least ink: a small dot and a word,
 * in the muted palette the rest of the chrome uses. Offline and attention
 * states earn colour. A status line that shouts when nothing is wrong trains
 * people to stop reading it.
 *
 * On narrow widths the word is dropped and the dot remains, with the label kept
 * for screen readers — the top bar is already dense on mobile and this is the
 * least important thing in it.
 *
 * ## Colour is never the only signal
 *
 * Each state has a distinct icon as well as a distinct colour, and the
 * accessible name carries the full sentence. A red dot alone would be invisible
 * to a colourblind reader and silent to a screen reader.
 */

import { Cloud, CloudOff, RefreshCw, Loader2 } from 'lucide-react'

import { CONNECTION_UX } from '@/offline/ux/connectionState'

/** Icon, tone and whether the icon spins. One row per state, no branching. */
const PRESENTATION = {
  [CONNECTION_UX.ONLINE]: {
    Icon: Cloud,
    tone: 'text-slate-500',
    dot: 'bg-emerald-500',
    spin: false,
  },
  [CONNECTION_UX.OFFLINE]: {
    Icon: CloudOff,
    tone: 'text-amber-700',
    dot: 'bg-amber-500',
    spin: false,
  },
  [CONNECTION_UX.CHECKING]: {
    Icon: RefreshCw,
    tone: 'text-slate-500',
    dot: 'bg-slate-400',
    spin: false,
  },
  [CONNECTION_UX.SYNCING]: {
    Icon: Loader2,
    tone: 'text-slate-600',
    dot: 'bg-sky-500',
    spin: true,
  },
}

/**
 * @param {object}  props
 * @param {string}  props.state   A `CONNECTION_UX` value.
 * @param {string}  props.label   The short word.
 * @param {string}  props.detail  The full sentence, for assistive technology.
 * @param {string}  [props.className]
 */
export function ConnectionStatusIndicator({ state, label, detail, className = '' }) {
  const presentation = PRESENTATION[state] ?? PRESENTATION[CONNECTION_UX.CHECKING]
  const { Icon, tone, dot, spin } = presentation

  return (
    <div
      // `status` rather than `alert`: connectivity changing is worth announcing
      // but must never interrupt what the reader is doing.
      role="status"
      aria-live="polite"
      className={[
        'inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium',
        'ring-1 ring-inset ring-slate-200 bg-white/60',
        tone,
        className,
      ].filter(Boolean).join(' ')}
      title={detail}
    >
      {/* The dot reads at a glance; the icon distinguishes the states for
          anybody who cannot separate the colours. */}
      <span className={`size-1.5 shrink-0 rounded-full ${dot}`} aria-hidden="true" />
      <Icon className={`size-3.5 shrink-0 ${spin ? 'animate-spin' : ''}`} aria-hidden="true" />

      {/* Hidden below `sm`, where the dot and icon carry it. */}
      <span className="hidden sm:inline">{label}</span>

      {/* The full sentence, always available to assistive technology. */}
      <span className="sr-only">{detail}</span>
    </div>
  )
}

export default ConnectionStatusIndicator
