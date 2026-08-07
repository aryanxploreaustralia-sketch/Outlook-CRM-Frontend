/**
 * The page frame: header, optional notice, content.
 *
 * Composes `AdminHeader` rather than re-declaring it, so a page passes its
 * title, subtitle, breadcrumb and actions to one component and gets consistent
 * spacing without choosing any of it.
 *
 * The `--spacing-page` measure here versus the CRM shell's narrower one is the
 * only intentional divergence: admin work is table work, and an eight-column
 * table needs more room than a lead form does.
 */

import { Info } from 'lucide-react'

import { AdminHeader } from '@/admin/components/AdminHeader'

/**
 * @param {{
 *   title: string,
 *   subtitle?: string,
 *   breadcrumb?: import('./AdminBreadcrumb').Crumb[],
 *   actions?: import('react').ReactNode,
 *   notice?: import('react').ReactNode,
 *   isRefreshing?: boolean,
 *   className?: string,
 *   children: import('react').ReactNode,
 * }} props
 */
export function AdminPageContainer({
  title,
  subtitle,
  breadcrumb,
  actions,
  notice,
  isRefreshing = false,
  className = '',
  children,
}) {
  return (
    /*
     * The measure comes from `--spacing-page` (Phase 16.1B), so every admin
     * page is exactly as wide as every other. The gutter grows with the
     * viewport so content never sits against the chrome on a large screen.
     */
    <div
      className={`mx-auto w-full max-w-(--spacing-page) px-4 py-6 sm:px-6 sm:py-8 xl:px-8 ${className}`}
    >
      <AdminHeader
        title={title}
        subtitle={subtitle}
        breadcrumb={breadcrumb}
        actions={actions}
      />

      {notice && (
        <div className="mt-5 flex items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
          <Info className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden="true" />
          <p className="min-w-0">{notice}</p>
        </div>
      )}

      {/*
        A refetch dims the current render instead of replacing it with a
        skeleton. Swapping rendered rows for placeholder bars on every filter
        keystroke is a layout jump the user reads as flicker, and the data they
        were looking at was perfectly valid a moment ago.
      */}
      <div
        /*
         * `space-y-6` is the one vertical rhythm every admin page uses. A page
         * that sets its own spacing is the reason two screens in the same
         * product stop feeling related.
         */
        className={`mt-7 space-y-6 transition-opacity duration-[--duration-base] ${
          isRefreshing ? 'opacity-60' : 'opacity-100'
        }`}
        aria-busy={isRefreshing || undefined}
      >
        {children}
      </div>
    </div>
  )
}

export default AdminPageContainer
