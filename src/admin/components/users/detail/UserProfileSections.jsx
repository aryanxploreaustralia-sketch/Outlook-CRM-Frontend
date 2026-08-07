/**
 * Overview and Performance — who this person is, and what they have produced.
 *
 * Both read from the profile endpoint the drawer already used, plus the
 * per-owner row from `/admin/analytics`. Nothing new is fetched that the
 * previous screen did not, other than analytics — which is deferred until the
 * section is scrolled to.
 */

import {
  Building2,
  Inbox,
  Mail,
  Megaphone,
  MessageSquare,
  Percent,
  Target,
  Users,
} from 'lucide-react'

import { AdminCard } from '@/admin/components/AdminCard'
import { AdminStatCard } from '@/admin/components/AdminStatCard'
import { AdminStatsLoading } from '@/admin/components/AdminLoadingState'
import { Fact, NotTracked, UserSection } from '@/admin/components/users/detail/UserDetailPrimitives'
import { ADMIN_TONE } from '@/admin/constants/admin.constants'
import { EMPTY, formatCount, formatDateTime, formatPercent, formatRelative } from '@/admin/utils/format'

/**
 * Section 1 — the facts of the account.
 *
 * Two cards rather than one long list: identity is what an administrator checks
 * to confirm they have the right person, and access is what they check to
 * explain a support ticket. Splitting them means neither has to be scanned to
 * find the other.
 */
export function UserOverviewSection({ user, registerRef }) {
  return (
    <UserSection
      id="overview"
      ref={registerRef('overview')}
      title="Overview"
      description="Identity, status and how this account came to exist."
    >
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <AdminCard title="Identity">
          <dl>
            <Fact label="Full name" value={user.displayName ?? 'Not signed in yet'} />
            <Fact label="Email" value={user.email} />
            <Fact label="Sign-in name" value={user.userPrincipalName} />

            {/*
              Phase 14.8B: both providers, reported separately.
              One account can be reached through either; the CRM never holds two
              records for one person, so this is a property of a single account
              rather than a list of accounts.
            */}
            <Fact
              label="Authentication"
              value={
                user.identities?.linked
                  ? 'Google and Microsoft (linked)'
                  : user.identities?.google?.linked
                    ? 'Google'
                    : user.identities?.microsoft?.linked
                      ? 'Microsoft'
                      : EMPTY
              }
              hint={
                user.identities?.linked
                  ? 'One account, reachable through either provider.'
                  : user.displayName
                    ? undefined
                    : 'The identity is linked on their first sign-in.'
              }
            />
            <Fact
              label="Last Google sign-in"
              value={
                user.identities?.google?.lastLoginAt
                  ? formatDateTime(user.identities.google.lastLoginAt)
                  : user.identities?.google?.linked
                    ? // Linked but never timestamped: the account signed in
                      // before per-provider timestamps existed. Saying "never"
                      // would be false; this is the honest answer.
                      <NotTracked>Not recorded before this release</NotTracked>
                    : EMPTY
              }
            />
            <Fact
              label="Last Microsoft sign-in"
              value={
                user.identities?.microsoft?.lastLoginAt
                  ? formatDateTime(user.identities.microsoft.lastLoginAt)
                  : user.identities?.microsoft?.linked
                    ? <NotTracked>Not recorded before this release</NotTracked>
                    : EMPTY
              }
            />
            <Fact label="Department" value={<NotTracked>Not recorded</NotTracked>} />
          </dl>
        </AdminCard>

        <AdminCard title="Access">
          <dl>
            <Fact label="Role" value={user.roleLabel ?? user.role} />
            <Fact
              label="Status"
              value={user.statusLabel}
              hint={
                user.lastStatusChange?.at
                  ? `Changed ${formatRelative(user.lastStatusChange.at)}${
                      user.lastStatusChange.by
                        ? ` by ${user.lastStatusChange.by.displayName ?? user.lastStatusChange.by.email}`
                        : ''
                    }`
                  : undefined
              }
            />
            <Fact label="Created" value={formatDateTime(user.createdAt)} />
            <Fact
              label="Invited by"
              value={
                user.invitation?.invitedBy?.displayName ??
                user.invitation?.invitedBy?.email ??
                'Signed in directly'
              }
              hint={
                user.invitation?.invitedAt
                  ? `Invited ${formatRelative(user.invitation.invitedAt)}`
                  : undefined
              }
            />
            <Fact
              label="Last sign-in"
              value={user.lastLoginAt ? formatDateTime(user.lastLoginAt) : 'Never signed in'}
              hint={user.lastLoginAt ? formatRelative(user.lastLoginAt) : undefined}
            />
            <Fact
              label="Last activity"
              value={
                user.activity?.lastActivityAt
                  ? formatRelative(user.activity.lastActivityAt)
                  : 'No live session'
              }
              hint="Derived from active sessions, so it clears when they expire."
            />
            <Fact
              label="Microsoft mailboxes"
              value={`${user.mailboxes?.connected ?? 0} connected of ${user.mailboxes?.total ?? 0}`}
            />
          </dl>
        </AdminCard>
      </div>

      {user.invitation?.notes && (
        <AdminCard className="mt-6" title="Invitation notes">
          <p className="whitespace-pre-line text-sm text-slate-600">{user.invitation.notes}</p>
        </AdminCard>
      )}
    </UserSection>
  )
}

/**
 * Section 2 — what this account has produced.
 *
 * ## Every figure says where it came from
 *
 * The counts differ in kind and it matters. `leads`, `campaigns` and
 * `conversations` are ownership totals from the profile — everything this
 * account owns, ever. `emailed` is from the analytics aggregation and counts
 * introductions the workbook run actually sent as this person.
 *
 * Two of the eight the brief asks for are not measured anywhere: companies and
 * contacts carry an `owner`, but no endpoint aggregates them per person, and
 * open rate is not tracked at all — the CRM records no opens. Both say so
 * rather than rendering a zero somebody would act on.
 */
export function UserPerformanceSection({ user, performance, isLoading, registerRef }) {
  const emailed = performance?.emailed ?? null
  const replies = user.activity?.conversations ?? 0

  /**
   * Replies per introduction sent.
   *
   * Only computed when there is a denominator. A rate over zero sends is
   * arithmetically undefined, and rendering it as 0% states something false
   * about a person who has not sent anything yet.
   */
  const responseRate =
    emailed && emailed > 0 ? Number(((replies / emailed) * 100).toFixed(1)) : null

  return (
    <UserSection
      id="performance"
      ref={registerRef('performance')}
      title="Performance"
      description="What this account owns and has sent. Figures are lifetime totals, not a period."
    >
      {isLoading ? (
        <AdminStatsLoading count={8} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <AdminStatCard
            label="Introductions sent"
            value={emailed === null ? EMPTY : formatCount(emailed)}
            icon={Mail}
            tone={ADMIN_TONE.SUCCESS}
            hint="Automatic first emails, from the workbook run"
          />
          <AdminStatCard
            label="Reply threads"
            value={formatCount(replies)}
            icon={MessageSquare}
            tone={ADMIN_TONE.NEUTRAL}
            hint="Conversations this account owns"
          />
          <AdminStatCard
            label="Campaigns"
            value={formatCount(user.activity?.campaigns)}
            icon={Megaphone}
            tone={ADMIN_TONE.WARNING}
          />
          <AdminStatCard
            label="Leads"
            value={formatCount(user.activity?.leads)}
            icon={Target}
            tone={ADMIN_TONE.BRAND}
            hint={
              performance
                ? `${formatCount(performance.won)} won · ${formatCount(performance.lost)} lost`
                : undefined
            }
          />
          {/* Lifetime per-person directory totals are still not aggregated —
              but the figures for a chosen window now are, one section below,
              so the hint points there rather than implying the number does not
              exist anywhere. */}
          <AdminStatCard
            label="Companies"
            value={EMPTY}
            icon={Building2}
            hint="See Activity over time for a period figure"
          />
          <AdminStatCard
            label="Contacts"
            value={EMPTY}
            icon={Users}
            hint="See Activity over time for a period figure"
          />
          <AdminStatCard
            label="Response rate"
            value={responseRate === null ? EMPTY : formatPercent(responseRate)}
            icon={Percent}
            tone={ADMIN_TONE.NEUTRAL}
            hint={
              responseRate === null
                ? 'Needs at least one introduction sent'
                : 'Reply threads per introduction'
            }
          />
          <AdminStatCard
            label="Open rate"
            value={EMPTY}
            icon={Inbox}
            hint="Opens are not tracked by this CRM"
          />
        </div>
      )}
    </UserSection>
  )
}

export default UserOverviewSection
