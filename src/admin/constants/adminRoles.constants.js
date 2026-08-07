/**
 * The role hierarchy, as designed in the Phase 14.0 architecture freeze.
 *
 * This is a **presentational** copy: it describes the intended model to a human
 * before any of it is enforced. It is not read by a guard, it does not gate a
 * route, and nothing in the CRM imports it.
 *
 * The backend's live enum is still the three values in
 * `backend/src/constants/roles.js` (`owner`, `admin`, `member`), checked on
 * fifteen destructive routes. Extending that enum and seeding `RoleDefinition`
 * documents belongs to the phase that introduces enforcement; at that point
 * this file is replaced by a fetch and deleted.
 *
 * ## What is deliberately *not* in here
 *
 * How many people hold each role. Phase 14.1 carried a fabricated `userCount`;
 * 14.2 removed it, because the real number is available from
 * `GET /admin/users` and a hard-coded one sitting beside real data is the worst
 * of both. The Roles screen counts the directory it fetches.
 */

/** `rank` is ordinal: a lower number is more privileged. */
export const ADMIN_ROLES = Object.freeze([
  {
    key: 'owner',
    label: 'Owner',
    rank: 0,
    tagline: 'The account holder',
    description:
      'Full control of the workspace, including ownership transfer and deletion. Exactly one Owner exists and the role cannot be removed.',
    summary: ['Everything an Administrator can do', 'Transfer ownership', 'Delete the organization', 'Override any permission'],
    restricted: ['Cannot delete audit entries — nobody can'],
    isSystem: true,
  },
  {
    key: 'admin',
    label: 'Administrator',
    rank: 1,
    tagline: 'Full operational control',
    description:
      'Runs the platform day to day: invites people, assigns roles, connects mailboxes and configures the scheduler.',
    summary: ['Invite, suspend and grade users', 'Connect and assign mailboxes', 'Configure the scheduler', 'Read audit logs', 'Activate email templates'],
    restricted: ['Cannot transfer ownership', 'Cannot delete the organization', 'Cannot grant Owner or Administrator'],
    isSystem: true,
  },
  {
    key: 'manager',
    label: 'Manager',
    rank: 2,
    tagline: "Owns a team's output",
    description:
      'Full reach across CRM data and campaigns, plus read access to analytics and monitoring. No access to user, role or organization administration.',
    summary: ['All lead, company and contact operations', 'Launch and control campaigns', 'Reassign work', 'Read analytics and monitoring'],
    restricted: ['No user management', 'No role management', 'No mailbox administration', 'Cannot activate templates'],
    isSystem: true,
  },
  {
    key: 'sales',
    label: 'Sales',
    rank: 3,
    tagline: 'Day-to-day operator',
    description:
      'Creates and works enquiries, sends mail and builds campaigns. Cannot delete data or export it.',
    summary: ['Create and update leads', 'Create and update contacts', 'Send mail', 'Build campaigns', 'Reply to conversations'],
    restricted: ['No deletes', 'No exports', 'Cannot launch campaigns', 'No mailbox administration'],
    isSystem: true,
  },
  {
    key: 'support',
    label: 'Support',
    rank: 4,
    tagline: 'The reply desk',
    description:
      'Lives in Conversations. Reads the sales register for context, answers customers, and assigns threads — but changes no sales data.',
    summary: ['Read and reply to conversations', 'Assign threads', 'Trigger a reply sync', 'Read leads, companies and contacts'],
    restricted: ['No lead or contact mutation', 'Cannot send campaigns', 'No exports', 'No administration'],
    isSystem: true,
  },
  {
    key: 'viewer',
    label: 'Viewer',
    rank: 5,
    tagline: 'Read-only',
    description:
      'Sees the CRM and its analytics and changes nothing. Intended for stakeholders who need visibility without operational access.',
    summary: ['Read every CRM module', 'Read analytics'],
    restricted: ['Every mutation is refused', 'No exports', 'No administration', 'Cannot send mail'],
    isSystem: true,
  },
])

/** Badge treatment per role. Colour is never the only signal — the label carries the meaning. */
export const ADMIN_ROLE_BADGE = Object.freeze({
  owner: 'bg-violet-50 text-violet-700 ring-violet-600/20',
  admin: 'bg-brand-50 text-brand-700 ring-brand-600/20',
  manager: 'bg-cyan-50 text-cyan-700 ring-cyan-600/20',
  sales: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  support: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  viewer: 'bg-slate-100 text-slate-600 ring-slate-500/20',
})

/** Lookup used by tables that hold only a role key. */
export const ADMIN_ROLE_LABELS = Object.freeze(
  Object.fromEntries(ADMIN_ROLES.map((role) => [role.key, role.label])),
)

export default ADMIN_ROLES
