/**
 * Generic dashboard information card.
 *
 * Three of the four dashboard cards are the same object: an icon, a title, an
 * optional badge, and a list of label/value rows. Rather than write three
 * near-identical components, they compose this one and differ only in data —
 * which is what keeps their spacing, typography and truncation identical.
 *
 * `CardRow` is exported so a page can add a row with custom content (a badge, a
 * link) while keeping the shared row layout.
 */

/**
 * @param {{
 *   title: string,
 *   description?: string,
 *   icon?: import('react').ElementType,
 *   iconTone?: string,
 *   action?: import('react').ReactNode,
 *   badge?: import('react').ReactNode,
 *   footer?: import('react').ReactNode,
 *   className?: string,
 *   children: import('react').ReactNode,
 * }} props
 */
export function StatusCard({
  title,
  description,
  icon: Icon,
  iconTone = 'bg-brand-50 text-brand-600 ring-brand-600/10',
  action,
  badge,
  footer,
  className = '',
  children,
}) {
  return (
    <section
      className={`flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card transition-shadow hover:shadow-card-hover ${className}`}
    >
      <header className="flex items-start gap-3 border-b border-slate-100 px-5 py-4">
        {Icon && (
          <span
            className={`grid size-9 shrink-0 place-items-center rounded-lg ring-1 ring-inset ${iconTone}`}
          >
            <Icon className="size-[18px]" aria-hidden="true" />
          </span>
        )}

        {/* `min-w-0` lets the title truncate instead of widening the card. */}
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold text-slate-900">{title}</h2>
          {description && <p className="mt-0.5 truncate text-xs text-slate-500">{description}</p>}
        </div>

        {badge && <div className="shrink-0">{badge}</div>}
        {action && <div className="shrink-0">{action}</div>}
      </header>

      <div className="flex-1 px-5 py-2">
        <dl className="divide-y divide-slate-100">{children}</dl>
      </div>

      {footer && (
        <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-3 text-xs text-slate-500">
          {footer}
        </div>
      )}
    </section>
  )
}

/**
 * A single label/value row.
 *
 * @param {{
 *   label: string,
 *   value?: import('react').ReactNode,
 *   mono?: boolean,
 *   emptyLabel?: string,
 *   title?: string,
 * }} props
 *   When `value` is null or undefined, `emptyLabel` renders in muted text — an
 *   explicit "Not available" is clearer than a blank cell the user has to
 *   interpret.
 */
export function CardRow({ label, value, mono = false, emptyLabel = 'Not available', title }) {
  const isEmpty = value === null || value === undefined || value === ''

  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <dt className="shrink-0 text-xs text-slate-500">{label}</dt>
      <dd
        // `title` gives a hover tooltip for values that truncate.
        title={title ?? (typeof value === 'string' ? value : undefined)}
        className={`min-w-0 truncate text-right text-sm ${
          isEmpty ? 'text-slate-400' : 'font-medium text-slate-900'
        } ${mono ? 'font-mono text-xs' : ''}`}
      >
        {isEmpty ? emptyLabel : value}
      </dd>
    </div>
  )
}

export default StatusCard
