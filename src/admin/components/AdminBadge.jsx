/**
 * Inline pill.
 *
 * A supporting primitive, not one of the fifteen named in the brief — but the
 * users, mailboxes, campaigns, leads and audit tables all need a small labelled
 * chip, and five hand-rolled versions is exactly how one screen ends up calling
 * a suspended account "red" and another calling it "orange".
 *
 * Distinct from `@/components/common/StatusBadge`, which is a closed enum keyed
 * to the CRM's own status constants (`connected`, `degraded`, `up`…). That
 * component is correct for the health tiles, and the health page uses it. This
 * one is open: it takes any label and a tone, for the admin vocabularies —
 * roles, invitation states, campaign phases — that have no CRM counterpart.
 *
 * The accessibility rule from `StatusBadge` is carried over unchanged: colour is
 * never the only signal, so every badge renders its label as text.
 */

const TONES = {
  neutral: 'bg-slate-100 text-slate-600 ring-slate-500/20',
  brand: 'bg-brand-50 text-brand-700 ring-brand-600/20',
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  warning: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  danger: 'bg-red-50 text-red-700 ring-red-600/20',
  info: 'bg-cyan-50 text-cyan-700 ring-cyan-600/20',
  violet: 'bg-violet-50 text-violet-700 ring-violet-600/20',
}

const SIZES = {
  sm: 'px-2 py-0.5 text-[11px]',
  md: 'px-2.5 py-1 text-xs',
}

/**
 * @param {{
 *   children: import('react').ReactNode,
 *   tone?: keyof typeof TONES,
 *   size?: keyof typeof SIZES,
 *   dot?: boolean,
 *   className?: string,
 * }} props
 *   `className` wins over `tone`, so a caller holding its own colour map — the
 *   role badges, for instance — can pass it straight through.
 */
export function AdminBadge({ children, tone = 'neutral', size = 'sm', dot = false, className }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full font-medium ring-1 ring-inset ${
        SIZES[size] ?? SIZES.sm
      } ${className ?? TONES[tone] ?? TONES.neutral}`}
    >
      {dot && (
        <span className="size-1.5 shrink-0 rounded-full bg-current opacity-70" aria-hidden="true" />
      )}
      {children}
    </span>
  )
}

export default AdminBadge
