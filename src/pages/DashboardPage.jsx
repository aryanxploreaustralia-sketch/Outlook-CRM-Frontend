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
import { MicrosoftIcon } from '@/components/common/MicrosoftIcon'
import { StatusBadge } from '@/components/common/StatusBadge'
import { ContactsCard } from '@/components/dashboard/ContactsCard'
import { CrmOverviewCard } from '@/components/dashboard/CrmOverviewCard'
import { QuickActionsCard } from '@/components/dashboard/QuickActionsCard'
import { RecentLeadsCard } from '@/components/dashboard/RecentLeadsCard'
import { MailStatsCard } from '@/components/dashboard/MailStatsCard'
import { ProfileCard } from '@/components/dashboard/ProfileCard'
import { ProviderStatusCard } from '@/components/dashboard/ProviderStatusCard'
import { RecentEmailsCard } from '@/components/dashboard/RecentEmailsCard'
import { SchedulerCard } from '@/components/dashboard/SchedulerCard'
import { StatusCard, CardRow } from '@/components/dashboard/StatusCard'
import { SystemStatusCard } from '@/components/dashboard/SystemStatusCard'
import { SkeletonCard, SkeletonProfile } from '@/components/ui/Skeleton'
import { useAccountStatus } from '@/hooks/useAccountStatus'
import { useAuth } from '@/hooks/useAuth'
import { useDashboard } from '@/hooks/useDashboard'
import { useRecentLeads } from '@/hooks/useRecentLeads'
import { ROUTE_PATHS } from '@/routes/paths'
import { resolveErrorVariant } from '@/utils/apiError'

/** Formats an ISO timestamp, tolerating null and invalid input. */
function formatDateTime(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toLocaleString()
}

/**
 * Describes a token expiry in human terms.
 *
 * Absolute timestamps alone ("14:32:07") make the reader do arithmetic to answer
 * the only question they have — is it about to expire? — so the remaining time is
 * shown alongside it.
 */
function formatTokenExpiry(tokenExpiry) {
  if (!tokenExpiry?.expiresAt) return null

  const absolute = formatDateTime(tokenExpiry.expiresAt)
  if (tokenExpiry.isExpired) return `${absolute} · expired, renewing`

  const seconds = tokenExpiry.expiresInSeconds
  if (typeof seconds !== 'number') return absolute

  const minutes = Math.floor(seconds / 60)
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60)
    return `${absolute} · in ${hours}h ${minutes % 60}m`
  }

  return `${absolute} · in ${minutes}m`
}

export function DashboardPage() {
  const auth = useAuth()
  const navigate = useNavigate()
  const [isSigningOut, setIsSigningOut] = useState(false)

  const { dashboard, isInitialLoading, isError, error, refresh } = useDashboard()

  // Deferred until the dashboard payload lands, so the two requests do not
  // compete for the connection on first paint.
  const accountStatus = useAccountStatus({ enabled: Boolean(dashboard) })

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
  const connection = dashboard?.connection
  const outlook = dashboard?.outlookAccount
  const authentication = dashboard?.authentication

  // Prefer the live status payload; fall back to what /dashboard already knew so
  // the card is never empty.
  const systemStatus = accountStatus.status ?? {
    backend: dashboard?.server?.backend,
    database: dashboard?.server?.database,
    graph: dashboard?.server?.graph,
    timestamp: dashboard?.meta?.generatedAt,
  }

  const tokenExpiry = accountStatus.status?.tokenExpiry ?? connection?.tokenExpiry

  return (
    <div className="space-y-6">
      {/* --- Page heading -------------------------------------------------- */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
            Welcome back{user?.displayName ? `, ${user.displayName.split(' ')[0]}` : ''}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Your enquiries, your mailbox and the platform, at a glance.
          </p>
        </div>
        <ConnectionBadge connection={connection} />
      </div>

      {/* --- The register --------------------------------------------------
          Placed first because it is why the CRM exists; the Microsoft
          connection and platform health follow below. Both read from the one
          `/dashboard` payload already fetched, so this costs no extra request.

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

      {/* --- Content grid --------------------------------------------------
          One column on mobile, two on small screens, three on large — with the
          profile occupying its own column so the cards keep a readable width. */}
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <ProfileCard
            user={user}
            connection={connection}
            onSignOut={handleSignOut}
            isSigningOut={isSigningOut}
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:col-span-2">
          {/* Card 1 — Connected Outlook Account */}
          <StatusCard
            title="Connected Outlook account"
            description="Mailbox this CRM can access"
            icon={Mail}
            iconTone="bg-blue-50 text-blue-600 ring-blue-600/10"
            badge={<ConnectionBadge connection={connection} size="sm" />}
            footer={
              <span className="flex items-center gap-2">
                <MicrosoftIcon className="size-3.5" />
                Secured by Microsoft identity platform
              </span>
            }
          >
            <CardRow label="Email" value={outlook?.email ?? connection?.email} />
            <CardRow
              label="Status"
              value={<ConnectionBadge connection={connection} size="sm" />}
            />
            <CardRow label="Connected" value={formatDateTime(outlook?.connectedAt)} />
          </StatusCard>

          {/* Card 2 — Authentication */}
          <StatusCard
            title="Authentication"
            description="Session and token lifecycle"
            icon={KeyRound}
            iconTone="bg-teal-50 text-teal-600 ring-teal-600/10"
            badge={<StatusBadge state={authentication?.status ?? 'unknown'} size="sm" />}
          >
            <CardRow label="Last login" value={formatDateTime(user?.lastLoginAt)} />
            <CardRow
              label="Last authentication"
              value={formatDateTime(authentication?.lastAuthenticatedAt)}
            />
            <CardRow label="Token expiry" value={formatTokenExpiry(tokenExpiry)} />
            <CardRow
              label="Session expires"
              value={formatDateTime(authentication?.sessionExpiresAt)}
            />
          </StatusCard>

          {/* Card 3 — Account Information */}
          <StatusCard
            title="Account information"
            description="Identity details from Microsoft"
            icon={IdCard}
            iconTone="bg-violet-50 text-violet-600 ring-violet-600/10"
          >
            <CardRow label="Name" value={user?.displayName} />
            <CardRow label="Email" value={user?.email} />
            <CardRow label="Account type" value={user?.accountTypeLabel} />
            <CardRow label="Provider" value={user?.providerLabel} />
            <CardRow label="Role" value={user?.roleLabel} />
          </StatusCard>

          {/* Card 4 — System Status */}
          <SystemStatusCard
            status={systemStatus}
            isRefreshing={accountStatus.isLoading}
            onRefresh={accountStatus.refresh}
          />
        </div>
      </div>

      {/* --- The morning run -------------------------------------------------
          Placed above the mail counters because it is what produces them: the
          scheduler queues the workbook, the workbook creates the leads, and the
          leads are what get emailed. Reads the dashboard payload rather than
          fetching, so it paints with the cards above it. Renders nothing when
          the workspace has no scheduler settings yet. */}
      <SchedulerCard scheduler={dashboard?.scheduler} />

      {/* --- Email engine ---------------------------------------------------
          A full-width row below the status grid: these two cards are the
          operational view, and pairing them keeps the counters next to the
          messages they describe. */}
      <div className="grid gap-5 lg:grid-cols-2">
        <MailStatsCard mail={dashboard?.mail} />
        <RecentEmailsCard items={dashboard?.mail?.recent ?? []} />
      </div>

      {/* --- Provider integration -------------------------------------------
          Loads its own data rather than reading the dashboard payload, so a
          slow provider cannot delay the cards above. */}
      <ProviderStatusCard />

      {/* --- Address book ---------------------------------------------------
          Loads its own statistics, so a large address book cannot delay the
          cards above it. */}
      <ContactsCard />
    </div>
  )
}

export default DashboardPage
