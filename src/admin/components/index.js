/**
 * Admin component barrel.
 *
 * Pages import from here so a page's import block is one line rather than
 * twelve, and so a component can be moved or renamed without touching eleven
 * call sites.
 *
 * Deliberately **not** a re-export of the CRM's shared primitives. `Button`,
 * `Skeleton`, `Spinner`, `StatusBadge` and `UserAvatar` are imported from
 * `@/components/*` directly, at their real paths, so it stays obvious which
 * parts of this module are new and which are reuse.
 */

export { AdminBadge } from './AdminBadge'
export { AdminBreadcrumb } from './AdminBreadcrumb'
export { AdminNoAccess } from './AdminNoAccess'
export { AdminRoute } from './AdminRoute'
export { Can, CanAll, CanAny } from './Can'
export { AdminCard } from './AdminCard'
export { AdminAreaChart, AdminBarChart, AdminRankChart } from './AdminChart'
// Re-exported from the constants module, not from `AdminChart.jsx`: that file
// exports components only, so Fast Refresh can hot-swap a chart.
export { ADMIN_CHART_COLORS } from '@/admin/constants/adminChart.constants'
export { AdminDateRange } from './AdminDateRange'
export { AdminDrawer } from './AdminDrawer'
export { AdminEmptyState } from './AdminEmptyState'
export { AdminErrorState } from './AdminErrorState'
export { AdminSelectField, AdminTextArea, AdminTextField } from './AdminField'
export { AdminFilterBar, AdminFilterSelect } from './AdminFilter'
export { AdminHeader } from './AdminHeader'
export {
  AdminChartLoading,
  AdminListLoading,
  AdminStatsLoading,
  AdminTableLoading,
} from './AdminLoadingState'
export { AdminModal } from './AdminModal'
export { AdminPageContainer } from './AdminPageContainer'
export { AdminPagination } from './AdminPagination'
export { AdminScoreMeter } from './AdminScoreMeter'
export { AdminSearch } from './AdminSearch'
export { AdminSection } from './AdminSection'
export { AdminSidebar } from './AdminSidebar'
export { AdminSidebarNavItem } from './AdminSidebarNavItem'
export { AdminStatCard } from './AdminStatCard'
export { AdminTable, AdminTableIdentity } from './AdminTable'
export { AdminTopbar } from './AdminTopbar'
