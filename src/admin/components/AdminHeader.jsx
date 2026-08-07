/**
 * The page header every admin screen opens with.
 *
 * Owns the four things every admin page needs — breadcrumb, title, subtitle and
 * the action slot — so a page cannot ship missing one, and so the vertical
 * rhythm above the fold is identical on all ten screens.
 *
 * ## What Phase 14.2 removed
 *
 * The Ready / Loading / Empty switch. It existed because Phase 14.1 had no
 * backend, and a loading skeleton that could not be reached was a design nobody
 * had actually reviewed. There is a backend now: loading is a real request and
 * empty is a real answer, and a control that fakes either would only hide the
 * genuine one.
 */

import { AdminBreadcrumb } from '@/admin/components/AdminBreadcrumb'

/**
 * @param {{
 *   title?: string,
 *   subtitle?: string,
 *   breadcrumb?: import('./AdminBreadcrumb').Crumb[],
 *   actions?: import('react').ReactNode,
 *   className?: string,
 * }} props
 */
export function AdminHeader({ title, subtitle, breadcrumb, actions, className = '' }) {
  return (
    <header className={`space-y-3 ${className}`}>
      {breadcrumb?.length > 0 && <AdminBreadcrumb items={breadcrumb} />}

      {/* Wraps rather than truncates: an action row pushed off-screen on a
          narrow viewport is the most common way a "responsive" admin page
          turns out not to be. */}
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          {/*
            Phase 16.1: a genuine display size, with negative tracking.
            `text-xl` read as a section heading rather than as the page's
            subject — at 1.5rem with tighter tracking it anchors the page, and
            the subtitle below it stops competing.
          */}
          {/*
            Optional since Phase 16.1A. The dashboard supplies its own heading
            (the greeting), and rendering an empty `h1` here would put a
            nameless heading in the accessibility tree above it.
          */}
          {title && (
            <h1 className="text-2xl font-semibold tracking-[-0.02em] text-slate-900">{title}</h1>
          )}
          {subtitle && (
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-500">{subtitle}</p>
          )}
        </div>

        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  )
}

export default AdminHeader
