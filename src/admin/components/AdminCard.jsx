/**
 * The admin surface primitive.
 *
 * A near-sibling of `@/components/common/Card`, and a deliberate one rather than
 * a wrapper. The CRM card is used by nine shipped pages; widening it with the
 * `padded`, `tone` and `footer` slots the admin screens need would change a
 * component those pages depend on, which this phase is not permitted to do.
 *
 * The two share the same visual language — 1px slate ring, `rounded-xl`, soft
 * shadow, `px-6 py-5` rhythm — so they read as one product. If the CRM ever
 * needs these slots, the merge is mechanical.
 */

/**
 * `padded: false` hands the body to the child unpadded, which is what a table
 * needs: a table must reach the card's edges or its header row floats in a
 * gutter and the sticky header has a visible seam.
 *
 * @param {{
 *   title?: import('react').ReactNode,
 *   description?: import('react').ReactNode,
 *   action?: import('react').ReactNode,
 *   footer?: import('react').ReactNode,
 *   padded?: boolean,
 *   as?: import('react').ElementType,
 *   className?: string,
 *   bodyClassName?: string,
 *   children: import('react').ReactNode,
 * }} props
 */
export function AdminCard({
  title,
  description,
  action,
  footer,
  padded = true,
  as: Component = 'section',
  className = '',
  bodyClassName = '',
  children,
}) {
  const hasHeader = Boolean(title || description || action)

  return (
    <Component
      className={`surface-card flex flex-col overflow-hidden ${className}`}
    >
      {hasHeader && (
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
          {/* `min-w-0` lets a long title truncate instead of pushing the action
              button out of the card — the same rule the CRM topbar relies on. */}
          <div className="min-w-0">
            {title && (
              <h2 className="truncate text-[0.9375rem] font-semibold tracking-[-0.01em] text-slate-900">
                {title}
              </h2>
            )}
            {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}

      <div className={`${padded ? 'px-6 py-5' : ''} min-w-0 flex-1 ${bodyClassName}`}>{children}</div>

      {footer && (
        <footer className="border-t border-slate-100 bg-slate-50/60 px-6 py-3.5">{footer}</footer>
      )}
    </Component>
  )
}

export default AdminCard
