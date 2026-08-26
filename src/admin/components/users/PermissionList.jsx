/**
 * A set of permissions, grouped and labelled.
 *
 * Used in three places that want the same thing shown differently:
 *
 *  - the profile drawer's **My permissions** section, where `granted` is the
 *    viewed account's set and the point is "what can this person do?";
 *  - the Roles screen's matrix, where the point is "what does this role include,
 *    and what does it leave out?" — so `showMissing` renders the whole catalogue
 *    with the absences struck through;
 *  - the Roles screen's **Your permissions** panel, which is the same data at a
 *    length nobody reads top to bottom, so `variant="grouped"` folds it into
 *    categories laid out over two columns.
 *
 * All three read the same `groups`/`catalogue`/`granted`. A variant changes how
 * the set is laid out and nothing about what is in it.
 *
 * ## Grouping comes from the server
 *
 * `PERMISSION_GROUPS` and the labels arrive with `/admin/me/permissions`. The
 * client does not decide that `users.invite` belongs under "Users & access" or
 * what to call it, because a permission added later would then need a second
 * edit here to appear anywhere — and would silently render as a bare dotted
 * string until somebody noticed.
 */

import { useState } from 'react'
import { Check, ChevronDown, Loader2, Lock, X } from 'lucide-react'

/**
 * One permission: name, then key.
 *
 * Inline rather than stacked. The two-line form doubled the height of a set of
 * thirty-eight, and the key is reference material — an operator reaches for it
 * when they are holding a 403's `required` field against the screen, not while
 * reading down the list. Inline it stays findable and costs nothing.
 */
function PermissionRow({
  permission,
  label,
  isHeld,
  editable,
  isSaving,
  isLocked,
  lockedReason,
  onToggle,
}) {
  const text = (
    <span className="min-w-0">
      <span className={`text-sm leading-snug ${isHeld ? 'text-slate-700' : 'text-slate-400'}`}>
        {label}
      </span>{' '}
      <code className="text-[11px] text-slate-400">{permission}</code>
      {isSaving && <span className="ml-1 text-[11px] text-slate-500">Saving…</span>}
    </span>
  )

  if (!editable) {
    return (
      <li className="flex min-w-0 items-start gap-1.5">
        {isHeld ? (
          <Check className="mt-1 size-3 shrink-0 text-emerald-600" aria-hidden="true" />
        ) : (
          <X className="mt-1 size-3 shrink-0 text-slate-300" aria-hidden="true" />
        )}
        {text}
      </li>
    )
  }

  /*
   * A real `<input type="checkbox">` inside a `<label>`.
   *
   * Not a styled `<div>` with a click handler: this is the control that decides
   * who can do what, and it has to be keyboard-operable and announce its own
   * checked state without anything bolted on to make that true.
   *
   * Disabled while its own request is in flight — which is what stops a
   * double-click sending two conflicting writes — and only this row, so the
   * rest of the panel stays usable.
   */
  return (
    <li className="min-w-0">
      <label
        // A padlocked row says why on hover. Without it the reader sees a
        // control that is simply missing and assumes a bug.
        title={isLocked ? lockedReason : undefined}
        className={`flex min-w-0 items-start gap-1.5 rounded px-1 py-0.5 ${
          isLocked ? 'cursor-not-allowed opacity-70' : 'cursor-pointer hover:bg-slate-50'
        }`}
      >
        {isSaving ? (
          <Loader2 className="mt-1 size-3 shrink-0 animate-spin text-slate-400" aria-hidden="true" />
        ) : isLocked ? (
          <Lock className="mt-1 size-3 shrink-0 text-slate-400" aria-hidden="true" />
        ) : (
          <input
            type="checkbox"
            checked={isHeld}
            disabled={isSaving}
            onChange={(event) => onToggle?.(permission, event.target.checked)}
            className="mt-0.5 size-3.5 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-2 focus:ring-brand-500/40 disabled:cursor-not-allowed"
          />
        )}
        {text}
      </label>
    </li>
  )
}

/**
 * The same set, folded into collapsible categories over up to three columns.
 *
 * ## Why this is not the default
 *
 * The profile drawer shows a short held-only set in a narrow column, where a
 * fold and a grid would both be overhead. This variant is for a full-width
 * panel holding the whole catalogue, which is the shape that was costing the
 * Roles screen most of its height.
 */
function GroupedPermissions({
  visible,
  catalogue,
  held,
  showMissing,
  editable,
  onToggle,
  onToggleGroup,
  busy,
  immovable,
  lockedReason,
}) {
  /*
   * `null` means "nobody has touched this yet", which is not the same as "every
   * category is shut". The groups arrive from the server a moment after first
   * paint, so a Set built eagerly here would be built from an empty list and
   * would leave every category open once the real data landed.
   */
  const [expanded, setExpanded] = useState(null)

  // First open, the rest folded: the shape of the whole set is visible at a
  // glance, and the category anybody actually wants is one click away.
  const defaults = () => new Set(visible.length > 0 ? [visible[0].key] : [])
  const open = expanded ?? defaults()

  const toggle = (key) =>
    setExpanded((current) => {
      const next = new Set(current ?? defaults())
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  return (
    <div className="divide-y divide-slate-100">
      {visible.map((group) => {
        const isOpen = open.has(group.key)

        // "Select all" ignores permissions nobody may change, or the control
        // would promise something the server is going to refuse.
        const toggleable = group.permissions.filter((permission) => !immovable.has(permission))
        const allHeld =
          toggleable.length > 0 && toggleable.every((permission) => held.has(permission))

        const inGroup = group.permissions.filter((permission) => held.has(permission)).length

        return (
          <section key={group.key}>
            {/*
              Two sibling buttons, not one inside the other: a `<button>` cannot
              legally contain another, and "Select all" must stay operable
              without also folding the category away under the reader.
            */}
            <div className="flex items-center gap-2 px-4 py-2">
              <button
                type="button"
                onClick={() => toggle(group.key)}
                aria-expanded={isOpen}
                className="flex min-w-0 flex-1 items-center gap-1.5 text-left transition-colors hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
              >
                <ChevronDown
                  className={`size-3 shrink-0 text-slate-400 transition-transform duration-(--duration-fast) ${isOpen ? '' : '-rotate-90'}`}
                  aria-hidden="true"
                />
                <h4 className="truncate text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">
                  {group.label}
                </h4>
              </button>

              {editable && onToggleGroup && toggleable.length > 0 && (
                <button
                  type="button"
                  onClick={() => onToggleGroup(toggleable, !allHeld)}
                  className="shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium text-brand-700 transition-colors hover:bg-brand-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
                >
                  {allHeld ? 'Deselect all' : 'Select all'}
                </button>
              )}

              <span className="shrink-0 text-[11px] tabular-nums text-slate-400">
                {showMissing ? `${inGroup}/${group.permissions.length}` : group.permissions.length}
              </span>
            </div>

            {/* Unmounted, not hidden — the rule the filter rail follows, so a
                folded category leaves the reading order rather than lurking in
                it. The count in the header says what is inside either way. */}
            {isOpen && (
              <ul className="grid grid-cols-1 gap-x-4 gap-y-1 px-4 pb-2.5 md:grid-cols-2 xl:grid-cols-3">
                {group.permissions.map((permission) => (
                  <PermissionRow
                    key={permission}
                    permission={permission}
                    label={catalogue?.[permission] ?? permission}
                    isHeld={held.has(permission)}
                    editable={editable}
                    isSaving={busy.has(permission)}
                    isLocked={immovable.has(permission)}
                    lockedReason={lockedReason}
                    onToggle={onToggle}
                  />
                ))}
              </ul>
            )}
          </section>
        )
      })}
    </div>
  )
}

/**
 * @param {{
 *   groups: Array<{ key: string, label: string, permissions: string[] }>,
 *   catalogue: Record<string, string>,
 *   granted: Set<string> | string[],
 *   variant?: 'list' | 'grouped',
 *   showMissing?: boolean,
 *   emptyMessage?: string,
 *   editable?: boolean,
 *   onToggle?: (permission: string, next: boolean) => void,
 *   onToggleGroup?: (permissions: string[], next: boolean) => void,
 *   pending?: Set<string>,
 *   locked?: Set<string>,
 *   lockedReason?: string,
 * }} props
 */
export function PermissionList({
  groups,
  catalogue,
  granted,
  variant = 'list',
  showMissing = false,
  emptyMessage = 'This account holds no permissions.',
  editable = false,
  onToggle,
  onToggleGroup,
  pending,
  locked,
  lockedReason = 'This permission cannot be changed here.',
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
    return <p className="p-4 text-sm text-slate-500">{emptyMessage}</p>
  }

  if (variant === 'grouped') {
    return (
      <GroupedPermissions
        visible={visible}
        catalogue={catalogue}
        held={held}
        showMissing={withMissing}
        editable={editable}
        onToggle={onToggle}
        onToggleGroup={onToggleGroup}
        busy={busy}
        immovable={immovable}
        lockedReason={lockedReason}
      />
    )
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
                      // A padlocked row says why on hover. Without it the reader
                      // sees a control that is simply missing and assumes a bug —
                      // which is exactly what happened with `users.invite`.
                      title={isLocked ? lockedReason : undefined}
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
                        <Lock
                          className="mt-0.5 size-3.5 shrink-0 text-slate-400"
                          aria-hidden="true"
                        />
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
