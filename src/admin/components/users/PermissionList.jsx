/**
 * A set of permissions, grouped and labelled.
 *
 * Used in two places that want the same thing shown differently:
 *
 *  - the profile drawer's **My permissions** section, where `granted` is the
 *    viewed account's set and the point is "what can this person do?";
 *  - the Roles screen, where the point is "what does this role include, and what
 *    does it leave out?" — so `showMissing` renders the whole catalogue with the
 *    absences struck through.
 *
 * ## Grouping comes from the server
 *
 * `PERMISSION_GROUPS` and the labels arrive with `/admin/me/permissions`. The
 * client does not decide that `users.invite` belongs under "Users & access" or
 * what to call it, because a permission added later would then need a second
 * edit here to appear anywhere — and would silently render as a bare dotted
 * string until somebody noticed.
 */

import { Check, X } from 'lucide-react'

/**
 * @param {{
 *   groups: Array<{ key: string, label: string, permissions: string[] }>,
 *   catalogue: Record<string, string>,
 *   granted: Set<string> | string[],
 *   showMissing?: boolean,
 *   emptyMessage?: string,
 * }} props
 */
export function PermissionList({
  groups,
  catalogue,
  granted,
  showMissing = false,
  emptyMessage = 'This account holds no permissions.',
}) {
  // Accepts either shape: the context holds a Set, an API response holds an array.
  const held = granted instanceof Set ? granted : new Set(granted ?? [])

  const visible = (groups ?? [])
    .map((group) => ({
      ...group,
      permissions: showMissing
        ? group.permissions
        : group.permissions.filter((permission) => held.has(permission)),
    }))
    // A heading above nothing is noise — the same rule the navigation applies.
    .filter((group) => group.permissions.length > 0)

  if (visible.length === 0) {
    return <p className="text-sm text-slate-500">{emptyMessage}</p>
  }

  return (
    <div className="space-y-4">
      {visible.map((group) => (
        <section key={group.key}>
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {group.label}
          </h4>

          <ul className="mt-1.5 space-y-1">
            {group.permissions.map((permission) => {
              const isHeld = held.has(permission)

              return (
                <li key={permission} className="flex items-start gap-2 text-sm">
                  {isHeld ? (
                    <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
                  ) : (
                    <X className="mt-0.5 size-3.5 shrink-0 text-slate-300" aria-hidden="true" />
                  )}

                  <span className={`min-w-0 ${isHeld ? 'text-slate-700' : 'text-slate-400'}`}>
                    {catalogue?.[permission] ?? permission}
                    {/* The raw key alongside the label, because this view exists
                        partly for debugging: an operator comparing a 403's
                        `required` field against the interface needs the string,
                        not the sentence. */}
                    <code className="ml-1.5 text-[11px] text-slate-400">{permission}</code>
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}

export default PermissionList
