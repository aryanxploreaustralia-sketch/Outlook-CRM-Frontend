/**
 * Says, honestly, that a change is saved on this device and not yet in the CRM.
 *
 * ## Why the wording is what it is
 *
 * "Saved" on its own is the dangerous word. A consultant who reads "Saved" and
 * closes the laptop believes the enquiry is in the CRM, where a colleague can
 * see it — and if the device never reconnects, it is not, and nobody finds out
 * until the customer calls. So this never says saved without saying *where*.
 *
 * The record is genuinely safe: it is in IndexedDB and its mutation is queued,
 * both of which survive a restart. What has not happened is the server write,
 * and that is exactly what the text describes.
 *
 * ## Deliberately not a dashboard
 *
 * One line, one optional count, no controls beyond an optional retry. A sync
 * management screen is a later phase's job; this is the minimum that keeps the
 * interface truthful.
 */

import { CloudOff, RefreshCw, TriangleAlert } from 'lucide-react'

/**
 * @param {object}   props
 * @param {number}   [props.pending]  Mutations waiting to reach the server.
 * @param {number}   [props.failed]   Mutations the server rejected.
 * @param {number}   [props.conflict] Mutations held back by a conflict.
 * @param {boolean}  [props.isSyncing]
 * @param {?Function} [props.onRetry] Omit to render no control.
 * @param {string}   [props.className]
 */
export function PendingSyncNotice({
  pending = 0,
  failed = 0,
  conflict = 0,
  isSyncing = false,
  onRetry = null,
  className = '',
}) {
  const held = failed + conflict

  // Nothing queued and nothing wrong: render nothing rather than a reassuring
  // banner nobody needs.
  if (pending === 0 && held === 0) return null

  const needsAttention = held > 0

  const label = needsAttention
    ? `${held} change${held === 1 ? '' : 's'} could not be saved to the CRM and ${held === 1 ? 'needs' : 'need'} attention.`
    : isSyncing
      ? `Saving ${pending} change${pending === 1 ? '' : 's'} to the CRM…`
      : `${pending} change${pending === 1 ? '' : 's'} saved on this device — waiting to sync.`

  const Icon = needsAttention ? TriangleAlert : CloudOff

  return (
    <div
      role="status"
      className={[
        'flex items-center gap-2 rounded-md px-3 py-2 text-sm ring-1',
        needsAttention
          ? 'bg-amber-50 text-amber-800 ring-amber-200'
          : 'bg-slate-50 text-slate-600 ring-slate-200',
        className,
      ].filter(Boolean).join(' ')}
    >
      <Icon className={`size-4 shrink-0 ${isSyncing ? 'animate-pulse' : ''}`} aria-hidden="true" />
      <span className="min-w-0 flex-1">{label}</span>

      {onRetry && !needsAttention && (
        <button
          type="button"
          onClick={onRetry}
          disabled={isSyncing}
          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-300 hover:bg-white disabled:opacity-50"
        >
          <RefreshCw className={`size-3 ${isSyncing ? 'animate-spin' : ''}`} aria-hidden="true" />
          Try now
        </button>
      )}
    </div>
  )
}

export default PendingSyncNotice
