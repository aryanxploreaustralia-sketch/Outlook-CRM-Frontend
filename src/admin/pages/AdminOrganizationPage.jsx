/**
 * Organization.
 *
 * Backed by `GET /api/v1/admin/organization`.
 *
 * ## There is no `Organization` record yet, and this screen says so plainly
 *
 * The Phase 14.0 design specifies one; Phase 14.3 builds it alongside the
 * `Membership` model and the workspace resolver it exists to serve. Creating it
 * here would be a database migration in a phase whose brief forbids one.
 *
 * So the server answers `configured: false` and returns what the deployment
 * genuinely knows about itself — its name from validated config, its scheduling
 * timezone from the elected primary scheduler, when the first account was
 * created. Every value shown is real. Nothing is invented to fill a field,
 * because a placeholder that looks like a setting is a placeholder somebody will
 * try to change.
 *
 * ## No form
 *
 * Phase 14.1 rendered read-only inputs, which was right when the shape was the
 * deliverable. Now that the values are real but unsaveable, inputs would be
 * worse than a description list: an input invites editing and a Save button that
 * cannot exist. Definition lists state the same facts and promise nothing.
 */

import { useCallback } from 'react'
import { Building2, CalendarClock, Globe, Plug, RefreshCw, Users } from 'lucide-react'

import {
  AdminBadge,
  AdminCard,
  AdminErrorState,
  AdminListLoading,
  AdminPageContainer,
  AdminSection,
} from '@/admin/components'
import { useAdminBreadcrumbs, useAdminResource } from '@/admin/hooks'
import { fetchAdminOrganization } from '@/admin/services/admin.service'
import { EMPTY, formatCount, formatDate } from '@/admin/utils/format'
import { Button } from '@/components/ui/Button'

/** A labelled fact. Not an input — there is nowhere to save one to. */
function Fact({ label, value, hint }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-slate-100 py-2.5 last:border-b-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
      <dt className="shrink-0 text-xs font-medium text-slate-500">{label}</dt>
      <dd className="min-w-0 sm:text-right">
        <span className="text-sm text-slate-800">{value ?? EMPTY}</span>
        {hint && <span className="mt-0.5 block max-w-md text-xs text-slate-400">{hint}</span>}
      </dd>
    </div>
  )
}

export function AdminOrganizationPage() {
  const breadcrumb = useAdminBreadcrumbs()

  const loader = useCallback((options) => fetchAdminOrganization(options), [])
  const { data, error, isLoading, isRefreshing, refresh } = useAdminResource(loader)

  const actions = (
    <Button variant="secondary" size="sm" onClick={refresh} isLoading={isRefreshing}>
      <RefreshCw className="size-3.5" aria-hidden="true" />
      Refresh
    </Button>
  )

  if (error) {
    return (
      <AdminPageContainer
        title="Organization"
        subtitle="What this deployment knows about itself"
        breadcrumb={breadcrumb}
        actions={actions}
      >
        <AdminErrorState error={error} onRetry={refresh} />
      </AdminPageContainer>
    )
  }

  return (
    <AdminPageContainer
      title="Organization"
      subtitle="What this deployment knows about itself"
      breadcrumb={breadcrumb}
      notice={data?.message}
      isRefreshing={isRefreshing}
      actions={actions}
    >
      {isLoading ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <AdminCard key={index}>
              <AdminListLoading rows={4} />
            </AdminCard>
          ))}
        </div>
      ) : (
        <>
          {!data?.configured && (
            <div className="flex items-start gap-2.5 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-card">
              <Building2 className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden="true" />
              <div className="min-w-0 text-sm">
                <p className="font-medium text-slate-900">No organization record exists yet</p>
                <p className="mt-0.5 text-slate-600">
                  Everything below is derived from configuration and existing records, not stored as
                  organization settings. Editable identity, branding and regional settings arrive
                  with the workspace model in a later phase.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <AdminCard
              title={
                <span className="flex items-center gap-2">
                  <Building2 className="size-4 text-slate-400" aria-hidden="true" />
                  Identity
                </span>
              }
              description="From validated configuration"
            >
              <dl>
                <Fact label="Deployment name" value={data?.identity.name} />
                <Fact label="Version" value={data?.identity.version} />
                <Fact
                  label="Environment"
                  value={
                    data?.identity.environment ? (
                      <AdminBadge tone={data.identity.environment === 'production' ? 'success' : 'warning'}>
                        {data.identity.environment}
                      </AdminBadge>
                    ) : (
                      EMPTY
                    )
                  }
                />
                <Fact
                  label="Legal name"
                  value={data?.identity.legalName}
                  hint="Not recorded anywhere yet — this is one of the fields the organization record will hold."
                />
              </dl>
            </AdminCard>

            <AdminCard
              title={
                <span className="flex items-center gap-2">
                  <Globe className="size-4 text-slate-400" aria-hidden="true" />
                  Regional
                </span>
              }
              description="The timezone that actually governs automated sending"
            >
              <dl>
                <Fact
                  label="Scheduling timezone"
                  value={data?.regional.timezone}
                  hint={data?.regional.timezoneNote}
                />
                <Fact
                  label="Scheduled run time"
                  value={
                    data?.regional.scheduledRunTime ? (
                      <span className="inline-flex items-center gap-1.5 tabular-nums">
                        <CalendarClock className="size-3.5 text-slate-400" aria-hidden="true" />
                        {data.regional.scheduledRunTime}
                      </span>
                    ) : (
                      EMPTY
                    )
                  }
                />
                <Fact
                  label="Locale"
                  value={data?.regional.locale}
                  hint="Formatting currently follows the browser. A stored locale arrives with the organization record."
                />
                <Fact label="Currency" value={data?.regional.currency} />
              </dl>
            </AdminCard>

            <AdminCard
              title={
                <span className="flex items-center gap-2">
                  <Users className="size-4 text-slate-400" aria-hidden="true" />
                  Workspace
                </span>
              }
              description="Derived from the accounts that exist"
            >
              <dl>
                <Fact label="Users" value={formatCount(data?.workspace.userCount)} />
                <Fact label="Established" value={formatDate(data?.workspace.establishedAt)} />
                <Fact label="First account" value={data?.workspace.firstUser?.displayName} />
                <Fact label="First account email" value={data?.workspace.firstUser?.email} />
              </dl>
            </AdminCard>

            <AdminCard
              title={
                <span className="flex items-center gap-2">
                  <Plug className="size-4 text-slate-400" aria-hidden="true" />
                  Integrations
                </span>
              }
              description="Whether each provider is configured in this environment"
            >
              <dl>
                <Fact
                  label="Microsoft (mailboxes)"
                  value={
                    <AdminBadge tone={data?.integrations.microsoft.configured ? 'success' : 'danger'} dot>
                      {data?.integrations.microsoft.configured ? 'Configured' : 'Not configured'}
                    </AdminBadge>
                  }
                  hint="Authorises mailboxes for sending and reply sync. It is not an identity provider."
                />
                <Fact
                  label="Google (sign-in)"
                  value={
                    <AdminBadge tone={data?.integrations.google.configured ? 'success' : 'danger'} dot>
                      {data?.integrations.google.configured ? 'Configured' : 'Not configured'}
                    </AdminBadge>
                  }
                  hint="Establishes the CRM session. Without it nobody can sign in."
                />
              </dl>
            </AdminCard>
          </div>

          <AdminSection
            title="Coming with the organization record"
            description="Fields the Phase 14.0 design specifies, none of which are stored yet"
          >
            <AdminCard>
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  'Company and legal name',
                  'Logo and brand colours',
                  'Postal address and contact details',
                  'Business hours',
                  'Email footer and signature',
                  'Locale, currency and date format',
                ].map((item) => (
                  <li
                    key={item}
                    className="rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-3 py-2 text-xs text-slate-500"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </AdminCard>
          </AdminSection>
        </>
      )}
    </AdminPageContainer>
  )
}

export default AdminOrganizationPage
