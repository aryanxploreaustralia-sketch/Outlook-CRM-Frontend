/**
 * Breadcrumb trail.
 *
 * Renders a real `<nav aria-label="Breadcrumb">` containing an ordered list,
 * which is the structure assistive technology expects; a row of `<span>`s
 * separated by slashes looks identical and conveys nothing.
 *
 * The final crumb is the current page. It is not a link — a link to where you
 * already are is a dead control — and it carries `aria-current="page"`.
 */

import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'

/**
 * @typedef  {object}  Crumb
 * @property {string}  label
 * @property {?string} [to]   Omit on the final crumb.
 */

/**
 * @param {{ items: Crumb[], className?: string }} props
 */
export function AdminBreadcrumb({ items, className = '' }) {
  if (!items?.length) return null

  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex flex-wrap items-center gap-1 text-xs text-slate-500">
        {items.map((crumb, index) => {
          const isLast = index === items.length - 1

          return (
            <li key={`${crumb.label}-${index}`} className="flex items-center gap-1">
              {index > 0 && (
                <ChevronRight className="size-3.5 shrink-0 text-slate-300" aria-hidden="true" />
              )}

              {isLast || !crumb.to ? (
                <span
                  aria-current={isLast ? 'page' : undefined}
                  className={isLast ? 'font-medium text-slate-700' : undefined}
                >
                  {crumb.label}
                </span>
              ) : (
                <Link
                  to={crumb.to}
                  className="rounded transition-colors hover:text-brand-700 hover:underline"
                >
                  {crumb.label}
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

export default AdminBreadcrumb
