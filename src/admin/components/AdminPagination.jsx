/**
 * The admin console's pagination control.
 *
 * A re-export. The implementation moved to `@/components/ui/Pagination` when
 * the CRM's own tables needed the same control — one component, one design,
 * one set of disabled rules everywhere.
 *
 * This name is kept because three admin screens import it and renaming them
 * would be churn for no gain. It behaves exactly as it did: the props are
 * unchanged, and `pageSizeOptions` still defaults to the same list.
 */

export { Pagination as AdminPagination, PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from '@/components/ui/Pagination'
export { Pagination as default } from '@/components/ui/Pagination'
