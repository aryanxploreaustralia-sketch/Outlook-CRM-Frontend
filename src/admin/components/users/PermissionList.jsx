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

import { Check, Loader2, Lock, X } from 'lucide-react'

/**
 * @param {{
 *   groups: Array<{ key: string, label: string, permissions: string[] }>,
 *   catalogue: Record<string, string>,
 *   granted: Set<string> | string[],
 *   showMissing?: boolean,
 *   emptyMessage?: string,
 *   editable?: boolean,
 *   onToggle?: (permission: string, next: boolean) => void,
 *   onToggleGroup?: (permissions: string[], next: boolean) => void,
 *   pending?: Set<string>,
 *   locked?: Set<string>,
 * }} props
 */
export function PermissionList({
  groups,
  catalogue,
  granted,
  showMissing = false,
  emptyMessage = 'This account holds no permissions.',
  editable = false,
  onToggle,
  onToggleGroup,
  pending,
  locked,
}) {
  // Accepts either shape: the context holds a Set, an API response holds an array.
  const held = granted instanceof Set ? granted : new Set(granted ?? [])

  const busy = pending ?? new Set()
  const immovable = locked ?? new Set()

  // Editing needs the absences on screen — you cannot tick what is not rendered.
  const withMissing = showMissing || editable

  const visible = (groups ?? [])
    .map((group) => ({
      ...group,
      permissions: withMissing
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
      {visible.map((group) => {
        // "Select all" ignores permissions nobody may change, or the control
        // would promise something the server is going to refuse.
        const toggleable = group.permissions.filter((permission) => !immovable.has(permission))
        const allHeld = toggleable.length > 0 && toggleable.every((permission) => held.has(permission))

        return (
          <section key={group.key}>
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {group.label}
              </h4>

              {editable && onToggleGroup && toggleable.length > 0 && (
                <button
                  type="button"
                  onClick={() => onToggleGroup(toggleable, !allHeld)}
                  className="rounded px-1.5 py-0.5 text-[11px] font-medium text-brand-700 transition-colors hover:bg-brand-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
                >
                  {allHeld ? 'Deselect all' : 'Select all'}
                </button>
              )}
            </div>

            <ul className="mt-1.5 space-y-1">
              {group.permissions.map((permission) => {
                const isHeld = held.has(permission)
                const isSaving = busy.has(permission)
                const isLocked = immovable.has(permission)

                const label = (
                  <span className={`min-w-0 ${isHeld ? 'text-slate-700' : 'text-slate-400'}`}>
                    {catalogue?.[permission] ?? permission}
                    {/* The raw key alongside the label, because this view exists
                        partly for debugging: an operator comparing a 403's
                        `required` field against the interface needs the string,
                        not the sentence. */}
                    <code className="ml-1.5 text-[11px] text-slate-400">{permission}</code>
                    {isSaving && <span className="ml-1.5 text-[11px] text-slate-500">Saving…</span>}
                  </span>
                )

                if (!editable) {
                  return (
                    <li key={permission} className="flex items-start gap-2 text-sm">
                      {isHeld ? (
                        <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
                      ) : (
                        <X className="mt-0.5 size-3.5 shrink-0 text-slate-300" aria-hidden="true" />
                      )}
                      {label}
                    </li>
                  )
                }

                /*
                 * A real `<input type="checkbox">` inside a `<label>`.
                 *
                 * Not a styled `<div>` with a click handler: this is the control
                 * that decides who can do what, and it has to be operable by
                 * keyboard and announce its own checked state to a screen reader
                 * without anything being bolted on to make that true.
                 *
                 * Disabled while its own request is in flight, which is what
                 * stops a double-click sending two conflicting writes — and only
                 * this row, so the rest of the card stays usable.
                 */
                return (
                  <li key={permission}>
                    <label
                      className={`flex items-start gap-2 rounded px-1 py-0.5 text-sm ${
                        isLocked
                          ? 'cursor-not-allowed opacity-70'
                          : 'cursor-pointer hover:bg-slate-50'
                      }`}
                    >
                      {isSaving ? (
                        <Loader2
                          className="mt-0.5 size-3.5 shrink-0 animate-spin text-slate-400"
                          aria-hidden="true"
                        />
                      ) : isLocked ? (
                        <Lock className="mt-0.5 size-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                      ) : (
                        <input
                          type="checkbox"
                          checked={isHeld}
                          disabled={isSaving}
                          onChange={(event) => onToggle?.(permission, event.target.checked)}
                          className="mt-0.5 size-3.5 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-2 focus:ring-brand-500/40 disabled:cursor-not-allowed"
                        />
                      )}
                      {label}
                    </label>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

export default PermissionList
