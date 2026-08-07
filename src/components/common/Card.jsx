/**
 * Generic surface container used to group related content.
 *
 * `action` renders in the header's trailing slot, which keeps buttons and
 * badges aligned consistently across every card in the app.
 */

/**
 * @param {{
 *   title?: import('react').ReactNode,
 *   description?: import('react').ReactNode,
 *   action?: import('react').ReactNode,
 *   className?: string,
 *   children: import('react').ReactNode,
 * }} props
 */
export function Card({ title, description, action, className = '', children }) {
  const hasHeader = Boolean(title || description || action)

  return (
    <section
      className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}
    >
      {hasHeader && (
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            {title && <h2 className="text-sm font-semibold text-slate-900">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <div className="px-5 py-4">{children}</div>
    </section>
  )
}

export default Card
