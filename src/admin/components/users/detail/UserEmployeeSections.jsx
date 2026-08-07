/**
 * Employee profile and documents, inside User 360 (Phase 17.2).
 *
 * ## Read-only, deliberately
 *
 * An administrator can see everything and can rule on documents. They cannot
 * edit somebody else's personal details — there is no admin write endpoint,
 * because a person's own address and next of kin are theirs to state. That
 * matches the brief, which gives admins "view" and "verify".
 *
 * ## The same two components the employee sees
 *
 * `ProfileOverviewCard`, `ProfileDetailCards` and `DocumentCenter` are reused
 * with `canEdit={false}` and `mode="admin"`. Two implementations of a profile
 * card would drift, and the reviewer would end up looking at a different
 * rendering of the data from the person who entered it.
 */

import { useCallback } from 'react'

import { AdminCard } from '@/admin/components/AdminCard'
import { AdminErrorState } from '@/admin/components/AdminErrorState'
import { UserSection } from '@/admin/components/users/detail/UserDetailPrimitives'
import { PERMISSIONS } from '@/admin/constants/permissions'
import { useAdminResource } from '@/admin/hooks/useAdminResource'
import { usePermission } from '@/admin/hooks/usePermissions'
import {
  adminDocumentFileUrl,
  decideAdminUserDocument,
  fetchAdminUserDocuments,
  fetchAdminUserProfile,
} from '@/admin/services/admin.service'
import { DocumentCenter } from '@/components/profile/DocumentCenter'
import { ProfileCompletion } from '@/components/profile/ProfileCompletion'
import {
  ProfileDetailCards,
  ProfileOverviewCard,
} from '@/components/profile/EmployeeProfileSections'

/** The employee's own details, as an administrator sees them. */
export function UserEmployeeProfileSection({ user, registerRef, enabled = true }) {
  const loader = useCallback((options) => fetchAdminUserProfile(user.id, options), [user.id])

  const { data, error, isLoading, refresh } = useAdminResource(loader, {
    deps: [user.id],
    enabled,
  })

  return (
    <UserSection
      id="employee-profile"
      ref={registerRef('employee-profile')}
      title="Employee profile"
      description="Personal and professional details this person has provided."
    >
      {error ? (
        <AdminErrorState error={error} onRetry={refresh} compact />
      ) : isLoading || !data ? (
        <div className="space-y-4">
          <div className="skeleton h-36" />
          <div className="skeleton h-24" />
        </div>
      ) : (
        <div className="space-y-4">
          <ProfileOverviewCard profile={data} />

          <AdminCard title="Profile completion">
            <ProfileCompletion completion={data.completion} />
          </AdminCard>

          {/* `canEdit` omitted — an administrator reads, the employee writes. */}
          <ProfileDetailCards profile={data} draft={{}} setDraft={() => {}} onSave={() => {}} />
        </div>
      )}
    </UserSection>
  )
}

/** Their documents, with verify and reject. */
export function UserDocumentsSection({ user, registerRef, enabled = true }) {
  const canDecide = usePermission(PERMISSIONS.USERS_DELETE)

  const loader = useCallback((options) => fetchAdminUserDocuments(user.id, options), [user.id])

  const { data, error, isLoading, refresh } = useAdminResource(loader, {
    deps: [user.id],
    enabled,
  })

  const fileUrl = useCallback(
    (documentId, options) => adminDocumentFileUrl(user.id, documentId, options),
    [user.id],
  )

  return (
    <UserSection
      id="documents"
      ref={registerRef('documents')}
      title="Documents"
      description="Identity documents and résumé. Verifying one prevents the employee changing it."
    >
      {error ? (
        <AdminErrorState error={error} onRetry={refresh} compact />
      ) : (
        <AdminCard>
          <DocumentCenter
            data={data}
            isLoading={isLoading}
            // Without the permission this renders as preview and download
            // only. Not security — the server refuses the decision regardless
            // of what is drawn; this only avoids offering a control that would
            // answer 403.
            mode={canDecide ? 'admin' : 'readonly'}
            fileUrl={fileUrl}
            onDecide={async (documentId, status, remarks) => {
              await decideAdminUserDocument(user.id, documentId, status, remarks)
              await refresh()
            }}
          />
        </AdminCard>
      )}
    </UserSection>
  )
}

export default UserEmployeeProfileSection
