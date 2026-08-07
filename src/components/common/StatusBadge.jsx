/**
 * Status pill.
 *
 * One badge component covers every status the product reports, so a colour never
 * means two different things in two places.
 *
 * Two accessibility rules are enforced here rather than left to call sites:
 *  - colour is never the only signal — every badge carries a text label, so the
 *    meaning survives for colour-blind users and in greyscale print;
 *  - the dot is `aria-hidden`, because it is decoration duplicating the label.
 *
 * Phase 1 values (`up`, `down`, `unknown`) remain supported: `SystemPage` and
 * `AccountPage` were written against them and must keep working.
 */

import {
  AUTH_STATUS,
  CONNECTION_STATUS,
  LEGACY_STATUS,
  PROCESS_STATUS,
  SERVICE_STATUS,
} from '@/constants/status.constants'

/**
 * Every status maps to a distinct colour family, as required: no two states in
 * the same visual bucket. `dot` carries an animation only where the state is
 * genuinely transient.
 */
const VARIANTS = {
  // --- Connection ---------------------------------------------------------
  [CONNECTION_STATUS.CONNECTED]: {
    label: 'Connected',
    className: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
    dot: 'bg-emerald-500',
  },
  [CONNECTION_STATUS.DISCONNECTED]: {
    label: 'Disconnected',
    className: 'bg-slate-100 text-slate-600 ring-slate-500/20',
    dot: 'bg-slate-400',
  },
  [CONNECTION_STATUS.EXPIRED]: {
    label: 'Expired',
    className: 'bg-orange-50 text-orange-700 ring-orange-600/20',
    dot: 'bg-orange-500',
  },
  [CONNECTION_STATUS.REFRESHING]: {
    label: 'Refreshing',
    className: 'bg-amber-50 text-amber-700 ring-amber-600/20',
    dot: 'bg-amber-500 animate-pulse',
  },
  [CONNECTION_STATUS.NOT_CONNECTED]: {
    label: 'Not connected',
    className: 'bg-slate-100 text-slate-500 ring-slate-400/20',
    dot: 'bg-slate-300',
  },

  // --- Process ------------------------------------------------------------
  [PROCESS_STATUS.ONLINE]: {
    label: 'Online',
    className: 'bg-cyan-50 text-cyan-700 ring-cyan-600/20',
    dot: 'bg-cyan-500',
  },
  [PROCESS_STATUS.OFFLINE]: {
    label: 'Offline',
    className: 'bg-zinc-200 text-zinc-700 ring-zinc-600/20',
    dot: 'bg-zinc-500',
  },

  // --- Service health -----------------------------------------------------
  [SERVICE_STATUS.HEALTHY]: {
    label: 'Healthy',
    className: 'bg-green-50 text-green-700 ring-green-600/20',
    dot: 'bg-green-500',
  },
  [SERVICE_STATUS.DEGRADED]: {
    label: 'Degraded',
    className: 'bg-yellow-50 text-yellow-800 ring-yellow-600/20',
    dot: 'bg-yellow-500',
  },
  [SERVICE_STATUS.ERROR]: {
    label: 'Error',
    className: 'bg-red-50 text-red-700 ring-red-600/20',
    dot: 'bg-red-500',
  },
  [SERVICE_STATUS.NOT_CONFIGURED]: {
    label: 'Not configured',
    className: 'bg-violet-50 text-violet-700 ring-violet-600/20',
    dot: 'bg-violet-400',
  },

  // --- Authentication -----------------------------------------------------
  [AUTH_STATUS.ACTIVE]: {
    label: 'Active',
    className: 'bg-teal-50 text-teal-700 ring-teal-600/20',
    dot: 'bg-teal-500',
  },
  [AUTH_STATUS.ANONYMOUS]: {
    label: 'Signed out',
    className: 'bg-slate-100 text-slate-500 ring-slate-400/20',
    dot: 'bg-slate-300',
  },

  // --- Phase 1 aliases, retained for backwards compatibility -------------
  [LEGACY_STATUS.UP]: {
    label: 'Operational',
    className: 'bg-green-50 text-green-700 ring-green-600/20',
    dot: 'bg-green-500',
  },
  [LEGACY_STATUS.DOWN]: {
    label: 'Unavailable',
    className: 'bg-red-50 text-red-700 ring-red-600/20',
    dot: 'bg-red-500',
  },
  [LEGACY_STATUS.UNKNOWN]: {
    label: 'Checking',
    className: 'bg-slate-100 text-slate-600 ring-slate-500/20',
    dot: 'bg-slate-400 animate-pulse',
  },
}

const SIZES = {
  sm: 'px-2 py-0.5 text-[11px] gap-1',
  md: 'px-2.5 py-1 text-xs gap-1.5',
}

/**
 * @param {{
 *   state?: string,
 *   label?: string,
 *   size?: keyof typeof SIZES,
 *   className?: string,
 * }} props
 *   `state` accepts any value from the status constants. An unrecognised value
 *   falls back to the neutral "unknown" badge rather than rendering nothing,
 *   so a new server-side status can never blank out the UI.
 */
export function StatusBadge({ state = LEGACY_STATUS.UNKNOWN, label, size = 'md', className = '' }) {
  const variant = VARIANTS[state] ?? VARIANTS[LEGACY_STATUS.UNKNOWN]
  const text = label ?? variant.label

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full font-medium ring-1 ring-inset ${
        SIZES[size] ?? SIZES.md
      } ${variant.className} ${className}`}
    >
      <span className={`size-1.5 shrink-0 rounded-full ${variant.dot}`} aria-hidden="true" />
      {text}
    </span>
  )
}

export default StatusBadge
