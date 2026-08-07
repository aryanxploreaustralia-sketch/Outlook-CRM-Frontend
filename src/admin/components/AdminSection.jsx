/**
 * A titled band within a page.
 *
 * Pages group cards; groups need labels. Without this the label markup is
 * copied into eleven pages and drifts — one uses `text-sm`, another `text-xs`,
 * a third forgets the description entirely.
 *
 * Renders a real `<section>` with an `aria-labelledby` pointing at its heading,
 * so assistive technology gets the same grouping a sighted user sees.
 */

import { useId } from 'react'

/**
 * @param {{
 *   title?: import('react').ReactNode,
 *   description?: import('react').ReactNode,
 *   action?: import('react').ReactNode,
 *   className?: string,
 *   children: import('react').ReactNode,
 * }} props
 */
export function AdminSection({ title, description, action, className = '', children }) {
  const headingId = useId()

  return (
    <section
      aria-labelledby={title ? headingId : undefined}
      className={`space-y-3 ${className}`}
    >
      {(title || action) && (
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            {title && (
              <h2 id={headingId} className="text-sm font-semibold text-slate-900">
                {title}
              </h2>
            )}
            {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}

      {children}
    </section>
  )
}

export default AdminSection
