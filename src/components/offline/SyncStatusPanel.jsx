/**
 * When the CRM last reached the server, and a way to ask it to try now.
 *
 * ## Why "Sync now" exists even with an empty queue
 *
 * `PendingSyncNotice` already offers "Try now", but only when something is
 * waiting — which is the wrong half of the problem. A consultant with nothing
 * queued still has a reason to sync: pulling what colleagues changed. Without
 * this the only way to refresh was to reload the page, which is a worse version
 * of the same request.
 *
 * ## It is the existing coordinator, not a second one
 *
 * `onSync` is `useSyncCoordinator`'s own `sync`, which is
 * `runSync({ reason: 'manual', force: true })`. Forcing is the documented
 * Phase 7 behaviour for a deliberate user action: somebody watching a button
 * should not be silently refused because a backoff window has not elapsed. The
 * queue order, conflict handling, cursor logic and drain-then-pull sequence are
 * all the coordinator's and are untouched.
 *
 * ## Double-click safety, twice over
 *
 * The button disables itself while a run is in flight, and `runSync` refuses a
 * concurrent call regardless. The UI guard is for the user; the coordinator
 * guard is the one that actually holds.
 */

import { RefreshCw, TriangleAlert } from 'lucide-react'

import { describeLastSync } from '@/offline/ux/connectionState'

/**
 * @param {object}    props
 * @param {?string}   props.lastSuccessAt  ISO `lastSuccessfulSyncAt`, or null.
 * @param {boolean}   props.isSyncing
 * @param {boolean}   [props.isOffline]
 * @param {number}    [props.failed]
 * @param {number}    [props.conflict]
 * @param {?string}   [props.lastError]
 * @param {Function}  props.onSync
 * @param {string}    [props.className]
 */
export function SyncStatusPanel({
  lastSuccessAt,
  isSyncing,
  isOffline = false,
  failed = 0,
  conflict = 0,
  lastError = null,
  onSync,
  className = '',
}) {
  const relative = describeLastSync(lastSuccessAt)
  const held = failed + conflict

  return (
    <div
      className={[
        'flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg px-3 py-2',
        'bg-slate-50 text-xs text-slate-600 ring-1 ring-inset ring-slate-200',
        className,
      ].filter(Boolean).join(' ')}
    >
      {/*
        Never a fabricated timestamp. `describeLastSync` returns null when no
        sync has ever succeeded, and this says exactly that instead of showing
        a time that would be a guess.
      */}
      <span className="min-w-0">
        {relative ? (
          <>
            Last synced: <span className="font-medium text-slate-800">{relative}</span>
          </>
        ) : (
          <span className="font-medium text-slate-800">Not synced yet</span>
        )}
      </span>

      {held > 0 && (
        <span className="inline-flex items-center gap-1 text-amber-800">
          <TriangleAlert className="size-3.5 shrink-0" aria-hidden="true" />
          {held} change{held === 1 ? '' : 's'} need{held === 1 ? 's' : ''} attention
        </span>
      )}

      {/*
        The failure reason, when the coordinator recorded one and there is no
        more specific attention state to show. Never a stack trace and never a
        credential — `lastSyncError` stores a message only.
      */}
      {held === 0 && lastError && !isSyncing && (
        <span className="min-w-0 truncate text-amber-800" title={lastError}>
          Last attempt failed: {lastError}
        </span>
      )}

      <button
        type="button"
        onClick={onSync}
        // Offline is included because a manual sync would be refused anyway;
        // disabling says so before the click rather than after it.
        disabled={isSyncing || isOffline || typeof onSync !== 'function'}
        aria-label={isSyncing ? 'Syncing, please wait' : 'Sync now'}
        className={[
          'ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1',
          'font-medium text-slate-700 ring-1 ring-slate-300 transition-colors',
          'hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
          'disabled:cursor-not-allowed disabled:opacity-50',
        ].join(' ')}
      >
        <RefreshCw
          className={`size-3.5 ${isSyncing ? 'animate-spin' : ''}`}
          aria-hidden="true"
        />
        {isSyncing ? 'Syncing…' : 'Sync now'}
      </button>
    </div>
  )
}

export default SyncStatusPanel
