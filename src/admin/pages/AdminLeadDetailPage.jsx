/**
 * One enquiry, opened from a user's register in the console.
 *
 * ## Why this exists rather than reusing the CRM's detail page
 *
 * `LeadDetailPage` loads through the CRM's own service, which is owner-scoped:
 * an administrator opening somebody else's enquiry got "Something went wrong on
 * our side" — a 500 that was really an authorization boundary doing its job.
 * That boundary is deliberate and untouched; this reads the admin endpoint
 * instead.
 *
 * Every field below comes from the same `toPublicJSON()` the CRM page renders,
 * so the two cannot disagree about a stage, a Query Date or a remark. Nothing
 * is invented, and nothing is editable — the console reads.
 */

import { useCallback } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

import { AdminCard, AdminErrorState, AdminPageContainer } from '@/admin/components'
import { useAdminBreadcrumbs, useAdminResource } from '@/admin/hooks'
import { fetchAdminLead } from '@/admin/services/admin.service'
import { EMPTY, formatDate } from '@/admin/utils/format'
import { LeadStageBadge } from '@/components/leads/LeadStageBadge'
import { LoadingScreen } from '@/components/common/LoadingScreen'
import { Button } from '@/components/ui/Button'

/** One labelled fact. Absent values read as an em dash, never as blank. */
function Fact({ label, value }) {
  return (
    <div className="border-b border-slate-100 py-2.5 last:border-b-0">
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-900">{value ?? EMPTY}</dd>
    </div>
  )
}

export function AdminLeadDetailPage() {
  const { id } = useParams()
  const breadcrumb = useAdminBreadcrumbs()

  const loader = useCallback((options) => fetchAdminLead(id, options), [id])
  const { data, error, isLoading, refresh } = useAdminResource(loader, { deps: [id] })

  if (isLoading) return <LoadingScreen fullScreen message="Loading the enquiry" />

  if (error) {
    return (
      <AdminPageContainer title="Enquiry" breadcrumb={breadcrumb}>
        {/* The shared error state already distinguishes 404 from 403 from a
            server fault, so a missing enquiry reads as missing rather than
            broken. */}
        <AdminErrorState error={error} onRetry={refresh} />
      </AdminPageContainer>
    )
  }

  const lead = data?.lead
  if (!lead) return null

  return (
    <AdminPageContainer
      title={lead.reference ?? 'Enquiry'}
      subtitle={`Owned by ${data.owner?.name ?? 'an unknown user'}`}
      breadcrumb={breadcrumb}
      actions={
        <Button as={Link} to={-1} size="sm" variant="secondary" onClick={(e) => { e.preventDefault(); globalThis.history.back() }}>
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          Back
        </Button>
      }
    >
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <AdminCard title="Enquiry">
          <dl>
            <Fact label="Reference" value={lead.reference} />
            <Fact label="Stage" value={<LeadStageBadge stage={lead.stage} />} />
            <Fact label="Query Date" value={formatDate(lead.quoteDate)} />
            <Fact
              label="Travel Date"
              value={lead.travelDate ? formatDate(lead.travelDate) : lead.travelDateText}
            />
            <Fact label="Pax" value={lead.paxText} />
            <Fact label="City" value={lead.city} />
            <Fact label="Market" value={lead.market} />
            <Fact label="Handled by" value={lead.handledBy} />
          </dl>
        </AdminCard>

        <AdminCard title="Contact">
          <dl>
            <Fact label="Contact person" value={lead.contactPerson} />
            <Fact label="Company" value={lead.companyName} />
            <Fact label="Email" value={lead.email} />
            <Fact
              label="Phone"
              value={(lead.phones ?? []).join(', ') || null}
            />
            <Fact label="Owner" value={data.owner?.name} />
            <Fact label="Created" value={formatDate(lead.createdAt)} />
            <Fact label="Updated" value={formatDate(lead.updatedAt)} />
          </dl>
        </AdminCard>

        <AdminCard title="Remarks" className="xl:col-span-2">
          {/* `whitespace-pre-wrap` so multi-line remarks survive on screen the
              way the importer preserved them. */}
          <p className="whitespace-pre-wrap text-sm text-slate-700">
            {lead.internalNotes || 'No remarks recorded.'}
          </p>
        </AdminCard>
      </div>
    </AdminPageContainer>
  )
}

export default AdminLeadDetailPage
