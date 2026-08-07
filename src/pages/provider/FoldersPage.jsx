/**
 * Mailbox folders and their canonical mapping.
 *
 * The mapping is the point of this page. Showing "Deleted Items → trash" beside
 * each other is what makes the abstraction inspectable: when a folder maps to
 * `custom` unexpectedly, this is where that becomes visible instead of being
 * discovered as missing messages later.
 */

import { useCallback, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, FolderTree, Inbox, RefreshCw } from 'lucide-react'

import { fetchFolders } from '@/api/services/provider.service'
import { ErrorScreen } from '@/components/common/ErrorScreen'
import { MockModeBanner } from '@/components/provider/MockModeBanner'
import { Button } from '@/components/ui/Button'
import { FOLDER_ORDER, formatRelative } from '@/constants/provider.constants'
import { useApiResource } from '@/hooks/useApiResource'
import { useProvider } from '@/hooks/useProvider'
import { ROUTE_PATHS } from '@/routes/paths'
import { resolveErrorVariant } from '@/utils/apiError'

/** Colour per canonical folder, so the mapping column is scannable. */
const CANONICAL_TONE = {
  inbox: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  sent: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  drafts: 'bg-slate-100 text-slate-600 ring-slate-500/20',
  trash: 'bg-red-50 text-red-700 ring-red-600/20',
  archive: 'bg-violet-50 text-violet-700 ring-violet-600/20',
  spam: 'bg-orange-50 text-orange-700 ring-orange-600/20',
  outbox: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  custom: 'bg-slate-100 text-slate-500 ring-slate-400/20',
}

export function FoldersPage() {
  /**
   * The mailbox whose folders these are, carried from the Provider page.
   *
   * Folders are stored per mailbox — `MailboxFolder` is unique on
   * `(mailbox, providerFolderId)` — so without this the page would show the
   * workspace default's folders under whichever mailbox the operator had
   * selected. Same URL parameter the Provider page uses, so Back returns them
   * to the same mailbox.
   */
  const [searchParams] = useSearchParams()
  const mailboxId = searchParams.get('mailbox')

  const [isRefreshing, setIsRefreshing] = useState(false)

  const { isMockMode, status } = useProvider()

  const fetcher = useCallback(
    ({ signal }) => fetchFolders({ mailboxId, signal }),
    [mailboxId],
  )
  const { data, isInitialLoading, isError, error, refresh } = useApiResource(fetcher)

  /** Re-reads folders from the provider rather than serving the stored list. */
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      await fetchFolders({ mailboxId, refresh: true })
      await refresh({ isBackground: true })
    } finally {
      setIsRefreshing(false)
    }
    // `mailboxId` is a real dependency: a stale closure would re-read the
    // previous mailbox's folders after the operator switched.
  }, [refresh, mailboxId])

  if (isError && !data) {
    return (
      <ErrorScreen variant={resolveErrorVariant(error)} message={error?.message} onRetry={refresh} />
    )
  }

  const folders = data?.items ?? []

  // Sorted into the order a mail client shows them, with custom folders last.
  const sorted = [...folders].sort((a, b) => {
    const left = FOLDER_ORDER.indexOf(a.canonical)
    const right = FOLDER_ORDER.indexOf(b.canonical)
    if (left !== right) return left - right
    return a.displayName.localeCompare(b.displayName)
  })

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <Link
            to={ROUTE_PATHS.PROVIDER}
            className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-slate-500 transition-colors hover:text-brand-600"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            Provider
          </Link>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
            Mailbox folders
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            How this mailbox&apos;s folders map onto the CRM&apos;s provider-independent names.
          </p>
        </div>

        <Button variant="secondary" onClick={handleRefresh} isLoading={isRefreshing}>
          <RefreshCw className="size-4" aria-hidden="true" />
          Refresh from provider
        </Button>
      </div>

      {isMockMode && <MockModeBanner reason={status?.fallbackReason} />}

      {isInitialLoading ? (
        <div className="space-y-2" aria-busy="true">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-14 animate-pulse rounded-lg bg-slate-200/70" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white py-12 text-center">
          <Inbox className="mx-auto size-8 text-slate-300" aria-hidden="true" />
          <p className="mt-3 text-sm font-medium text-slate-700">No folders yet</p>
          <p className="mt-1 text-sm text-slate-500">
            Connect a mailbox and run a sync to populate this list.
          </p>
          <Button as={Link} to={ROUTE_PATHS.PROVIDER} className="mt-4">
            Go to provider settings
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
          {/* Header hidden on mobile, where each row stacks instead. */}
          <div className="hidden border-b border-slate-100 bg-slate-50/60 px-5 py-2.5 text-xs font-medium text-slate-600 sm:grid sm:grid-cols-[1fr_auto_auto_auto] sm:gap-4">
            <span>Provider folder</span>
            <span className="w-24">Maps to</span>
            <span className="w-20 text-right">Items</span>
            <span className="w-16 text-right">Synced</span>
          </div>

          <ul className="divide-y divide-slate-100">
            {sorted.map((folder) => (
              <li
                key={folder.id}
                className="grid gap-2 px-5 py-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center sm:gap-4"
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-2 truncate text-sm font-medium text-slate-900">
                    <FolderTree className="size-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                    {folder.displayName}
                    {folder.isDeleted && (
                      <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                        removed at provider
                      </span>
                    )}
                  </p>
                  {/* The provider's own id, shown because it is what appears in
                      logs and API calls when something needs investigating. */}
                  <p className="mt-0.5 truncate font-mono text-[11px] text-slate-400">
                    {folder.wellKnownName ?? folder.providerFolderId}
                  </p>
                </div>

                <span
                  className={`inline-flex w-fit shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset sm:w-24 ${
                    CANONICAL_TONE[folder.canonical] ?? CANONICAL_TONE.custom
                  }`}
                >
                  {folder.canonical}
                </span>

                <span className="text-xs text-slate-500 sm:w-20 sm:text-right">
                  {folder.totalItemCount}
                  {folder.unreadItemCount > 0 && (
                    <span className="ml-1 font-medium text-blue-600">
                      ({folder.unreadItemCount} unread)
                    </span>
                  )}
                </span>

                <span className="text-xs sm:w-16 sm:text-right">
                  {folder.isSyncEnabled ? (
                    <span className="text-emerald-600" title={formatRelative(folder.lastSyncedAt)}>
                      on
                    </span>
                  ) : (
                    <span className="text-slate-400">off</span>
                  )}
                </span>
              </li>
            ))}
          </ul>

          <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-2.5 text-xs text-slate-500">
            {sorted.length} folders · {sorted.filter((f) => f.isSyncEnabled).length} synchronised.
            Custom folders are not synced by default.
          </div>
        </div>
      )}
    </div>
  )
}

export default FoldersPage
