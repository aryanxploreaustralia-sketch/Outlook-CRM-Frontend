/**
 * The identities that can reach one account.
 *
 * ## Why this screen exists
 *
 * Until Phase 14.8C the CRM decided that two provider identities belonged to
 * the same person by comparing their email addresses. That works only when both
 * providers happen to use the same spelling, and in this deployment they never
 * do: employees are `@gmail.com` through Google, the organization is
 * `@xploreaustralia.com` through Microsoft.
 *
 * An email address is one provider's *name* for somebody, not their identity. A
 * directory records that two names refer to one person because an administrator
 * said so. This is where they say so.
 *
 * ## Linking grants a way in, so it is guarded like one
 *
 * Attaching a Microsoft address to an owner hands whoever controls that address
 * the highest privilege in the deployment. The server requires `roles.manage`
 * *and* refuses anybody who could not have granted this person's role — so an
 * admin cannot link onto an owner. What is rendered here follows the same rule,
 * but the server is what enforces it.
 *
 * ## Unlinking really revokes
 *
 * It clears the verified `microsoftId` as well as the address. An unlink that
 * left the id behind would report success while the person kept signing in,
 * which is worse than no unlink at all. The server refuses when Microsoft is
 * the only route into an account — there is no password to fall back on.
 */

import { useState } from 'react'
import { Link2, Link2Off, ShieldCheck } from 'lucide-react'

import { AdminBadge } from '@/admin/components/AdminBadge'
import { AdminCard } from '@/admin/components/AdminCard'
import { AdminModal } from '@/admin/components/AdminModal'
import { AdminTextField } from '@/admin/components/AdminField'
import { UserSection } from '@/admin/components/users/detail/UserDetailPrimitives'
import { PERMISSIONS } from '@/admin/constants/permissions'
import { usePermission } from '@/admin/hooks/usePermissions'
import { linkMicrosoftIdentity, unlinkMicrosoftIdentity } from '@/admin/services/admin.service'
import { EMPTY, formatDateTime } from '@/admin/utils/format'
import { GoogleIcon } from '@/components/common/GoogleIcon'
import { MicrosoftIcon } from '@/components/common/MicrosoftIcon'
import { Button } from '@/components/ui/Button'

/** One provider row. */
function IdentityRow({ icon: Icon, name, audience, identity, children }) {
  return (
    <div className="flex flex-wrap items-start gap-3 border-b border-slate-100 py-3 last:border-0">
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-slate-900">{name}</p>
          {identity?.linked ? (
            <AdminBadge tone={identity.verified ? 'success' : 'warning'} dot>
              {/* "Linked" and "verified" are different facts: an owner can link
                  an address before its holder has ever signed in with it. */}
              {identity.verified ? 'Verified' : 'Linked, not yet used'}
            </AdminBadge>
          ) : (
            <AdminBadge tone="neutral">Not linked</AdminBadge>
          )}
        </div>

        <p className="mt-0.5 text-sm text-slate-600">{identity?.email ?? EMPTY}</p>
        <p className="mt-0.5 text-xs text-slate-400">
          {audience}
          {identity?.lastLoginAt ? ` · last used ${formatDateTime(identity.lastLoginAt)}` : ''}
        </p>
      </div>

      {children && <div className="shrink-0">{children}</div>}
    </div>
  )
}

export function UserIdentitySection({ user, registerRef, onChanged }) {
  const canManage = usePermission(PERMISSIONS.ROLES_MANAGE)

  const [isLinking, setIsLinking] = useState(false)
  const [isUnlinking, setIsUnlinking] = useState(false)
  const [address, setAddress] = useState('')
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)

  const identities = user.identities ?? {}
  const microsoft = identities.microsoft ?? {}
  const google = identities.google ?? {}

  const run = async (action, successMessage) => {
    setIsBusy(true)
    setError(null)

    try {
      await action()
      setIsLinking(false)
      setIsUnlinking(false)
      setAddress('')
      setNotice(successMessage)
      onChanged?.()
      setTimeout(() => setNotice(null), 6000)
    } catch (caught) {
      setError(caught?.message ?? 'That could not be completed.')
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <UserSection
      id="identity"
      ref={registerRef('identity')}
      title="Sign-in identities"
      description="One account, reachable through either provider. The two addresses need not match."
    >
      {notice && (
        <p
          role="status"
          className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800"
        >
          {notice}
        </p>
      )}

      <AdminCard>
        <IdentityRow
          icon={GoogleIcon}
          name="Google"
          audience="Employee portal — the CRM"
          identity={{ ...google, email: google.linked ? user.email : null, verified: google.linked }}
        />

        <IdentityRow
          icon={MicrosoftIcon}
          name="Microsoft"
          audience="Organization portal — the admin console"
          identity={microsoft}
        >
          {canManage && (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setError(null)
                  setAddress(microsoft.email ?? '')
                  setIsLinking(true)
                }}
              >
                <Link2 className="size-3.5" aria-hidden="true" />
                {microsoft.linked ? 'Change' : 'Link'}
              </Button>

              {microsoft.linked && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={() => {
                    setError(null)
                    setIsUnlinking(true)
                  }}
                >
                  <Link2Off className="size-3.5" aria-hidden="true" />
                  Unlink
                </Button>
              )}
            </div>
          )}
        </IdentityRow>

        {!canManage && (
          <p className="pt-3 text-xs text-slate-500">
            Linking a Microsoft identity requires the &ldquo;Change role definitions&rdquo;
            permission.
          </p>
        )}
      </AdminCard>

      {/* --- Link --------------------------------------------------------- */}
      <AdminModal
        isOpen={isLinking}
        onClose={() => setIsLinking(false)}
        title="Link a Microsoft identity"
        busy={isBusy}
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsLinking(false)} disabled={isBusy}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                run(
                  () => linkMicrosoftIdentity(user.id, address.trim().toLowerCase()),
                  `${address.trim().toLowerCase()} can now sign in as ${user.email}.`,
                )
              }
              isLoading={isBusy}
              disabled={!address.trim()}
            >
              Link identity
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-700">
            Whoever controls this Microsoft address will be able to sign in as{' '}
            <span className="font-medium">{user.email}</span>, with that account&rsquo;s role
            &mdash; currently <span className="font-medium">{user.roleLabel ?? user.role}</span>.
          </p>

          <AdminTextField
            label="Microsoft address"
            type="email"
            value={address}
            onChange={setAddress}
            placeholder="name@yourcompany.com"
            hint="A work or school account. It does not need to match the CRM address above."
          />

          {user.role === 'owner' && (
            <p className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              This is an Organization Owner. Linking grants full administrative control of the
              deployment.
            </p>
          )}

          {error && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          )}
        </div>
      </AdminModal>

      {/* --- Unlink ------------------------------------------------------- */}
      <AdminModal
        isOpen={isUnlinking}
        onClose={() => setIsUnlinking(false)}
        title="Remove this Microsoft identity?"
        busy={isBusy}
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsUnlinking(false)} disabled={isBusy}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                run(() => unlinkMicrosoftIdentity(user.id), 'Microsoft identity removed.')
              }
              isLoading={isBusy}
            >
              Unlink
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-700">
            <span className="font-medium">{microsoft.email}</span> will no longer be able to sign in
            as {user.email}.
          </p>
          <p className="text-sm text-slate-600">
            Their Google sign-in is unaffected. If Microsoft is the only way into this account, the
            server will refuse — an account nobody can sign in to cannot be recovered.
          </p>

          {error && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          )}
        </div>
      </AdminModal>
    </UserSection>
  )
}

export default UserIdentitySection
