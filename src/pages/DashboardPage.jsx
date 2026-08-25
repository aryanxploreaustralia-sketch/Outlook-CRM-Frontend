/**
 * Dashboard — the CRM's home, and where `/` now lands a signed-in user.
 *
 * Reads top to bottom in the order the work happens: the register first
 * (enquiry counts, the stage split, the newest arrivals), then the actions that
 * start a task, then the Microsoft connection and platform health that the
 * sending side depends on.
 *
 * Composes cards from shared components and deliberately contains no API calls:
 * `useDashboard` and `useAccountStatus` own data, so this file is layout and
 * formatting only.
 *
 * Every figure shown is one the server returned. Where a block of the payload
 * is `null` — which is how the server reports a widget whose aggregation failed
 * — the card for it says so rather than rendering a zero, because "none" and
 * "could not count" look identical to a reader and mean opposite things.
 *
 * Loading strategy is progressive rather than all-or-nothing. `/dashboard` paints
 * the cards immediately, then `/account/status` fills in the live Microsoft Graph
 * result a moment later. Blocking the whole page on a third-party round trip
 * would make a healthy app feel slow.
 */

import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IdCard, KeyRound, Mail } from 'lucide-react'

import { ConnectionBadge } from '@/components/common/ConnectionBadge'
import { ErrorScreen } from '@/components/common/ErrorScreen'
import { ContactsCard } from '@/components/dashboard/ContactsCard'
import { CrmOverviewCard } from '@/components/dashboard/CrmOverviewCard'
import { QuickActionsCard } from '@/components/dashboard/QuickActionsCard'
import { RecentLeadsCard } from '@/components/dashboard/RecentLeadsCard'
import { MailStatsCard } from '@/components/dashboard/MailStatsCard'
import { RecentEmailsCard } from '@/components/dashboard/RecentEmailsCard'
import { SkeletonCard, SkeletonProfile } from '@/components/ui/Skeleton'
import { useAuth } from '@/hooks/useAuth'
import { useDashboard } from '@/hooks/useDashboard'
import { useRecentLeads } from '@/hooks/useRecentLeads'
import { ROUTE_PATHS } from '@/routes/paths'
import { resolveErrorVariant } from '@/utils/apiError'


export function DashboardPage() {
  const auth = useAuth()
  const navigate = useNavigate()
  const [isSigningOut, setIsSigningOut] = useState(false)

  const { dashboard, isInitialLoading, isError, error, refresh } = useDashboard()

  // Deferred until the dashboard payload lands, so the two requests do not
  // compete for the connection on first paint.

  /**
   * The six newest enquiries, fetched separately and deliberately.
   *
   * `GET /v1/dashboard` returns statistics, not records — it carries no lead
   * list at all. Deferred like the status call so the first paint is not three
   * requests wide.
   */
  const recent = useRecentLeads({ enabled: Boolean(dashboard) })

  const handleSignOut = useCallback(async () => {
    setIsSigningOut(true)
    try {
      await auth.signOut()
      navigate(ROUTE_PATHS.LOGIN, { replace: true })
    } finally {
      setIsSigningOut(false)
    }
  }, [auth, navigate])

  // --- Failure --------------------------------------------------------------
  if (isError && !dashboard) {
    return (
      <ErrorScreen
        variant={resolveErrorVariant(error)}
        message={error?.message}
        onRetry={refresh}
      />
    )
  }

  // --- First load: skeletons matching the final layout ---------------------
  if (isInitialLoading) {
    return (
      <div className="space-y-6" aria-busy="true">
        <div className="space-y-2">
          <div className="h-6 w-56 animate-pulse rounded-md bg-slate-200/80" />
          <div className="h-4 w-80 animate-pulse rounded-md bg-slate-200/60" />
        </div>
        {/* Mirrors the final layout: register first, then the connection
            cards, so the page does not reflow once the payload lands. */}
        <div className="grid gap-5 lg:grid-cols-2">
          <SkeletonCard rows={6} />
          <SkeletonCard rows={6} />
        </div>
        <SkeletonCard rows={2} />
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <SkeletonProfile />
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:col-span-2">
            <SkeletonCard rows={2} />
            <SkeletonCard rows={3} />
            <SkeletonCard rows={4} />
            <SkeletonCard rows={3} />
          </div>
        </div>
        <p className="text-center text-sm text-slate-500">Loading your dashboard…</p>
      </div>
    )
  }

  const user = dashboard?.user

  /*
   * Kept when the account and platform cards moved to Account and Provider.
   *
   * A one-line badge is not the "Connected Outlook account" panel that went
   * with them — it is the single operational fact this page cannot omit: a
   * disconnected mailbox means nothing sends, and somebody who never opens the
   * Provider page would otherwise have no way of learning that from their home
   * screen. The detail lives on Provider; the warning stays here.
   */
  const connection = dashboard?.connection

  return (
    <div className="space-y-6">
      {/* --- Page heading -------------------------------------------------- */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
            Welcome back{user?.displayName ? `, ${user.displayName.split(' ')[0]}` : ''}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Your enquiries and today's work, at a glance.
          </p>
        </div>
        <ConnectionBadge connection={connection} />
      </div>

      {/* --- The register --------------------------------------------------
          The whole page now: the enquiries, the work queued against them and
          the mail that serves them. Account detail moved to Account and
          platform health to Provider, which is where each is asked about.

          `sales` is null when the server's aggregation failed — each card
          renders its own unavailable state rather than fabricating zeroes. */}
      <div className="grid gap-5 lg:grid-cols-2">
        <CrmOverviewCard sales={dashboard?.sales} />
        {/*
          The list comes from `GET /v1/leads`, not from the dashboard payload —
          `sales.recentLeads` is a count, and rendering it as a list is the
          defect this replaced. The two requests fail independently, so an
          unavailable register costs this card and nothing else.
        */}
        <RecentLeadsCard
          leads={recent.leads}
          isLoading={recent.isPending}
          isError={recent.isError}
          onRetry={recent.refresh}
        />
      </div>

      <QuickActionsCard />

      {/* --- Email engine ---------------------------------------------------
          A full-width row below the status grid: these two cards are the
          operational view, and pairing them keeps the counters next to the
          messages they describe. */}
      <div className="grid gap-5 lg:grid-cols-2">
        <MailStatsCard mail={dashboard?.mail} />
        <RecentEmailsCard items={dashboard?.mail?.recent ?? []} />
      </div>


      {/* --- Address book ---------------------------------------------------
          Loads its own statistics, so a large address book cannot delay the
          cards above it. */}
      <ContactsCard />
    </div>
  )
}

export default DashboardPage
