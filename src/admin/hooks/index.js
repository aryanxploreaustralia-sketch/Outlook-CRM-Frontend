/**
 * Admin hook barrel.
 *
 * Same rationale as the component barrel: one import line per page, and a hook
 * can be relocated without editing every screen that uses it.
 *
 * `useAdminTable` was removed in Phase 14.2. It filtered, sorted and paginated
 * in the browser, which was correct while the data came from fixtures. The
 * endpoints do that work now — and they have to: client-side filtering silently
 * stops being correct the moment a list outgrows one page, because it filters
 * only the page it happens to hold.
 */

export { useAdminBreadcrumbs } from './useAdminBreadcrumbs'
export { useAdminResource } from './useAdminResource'
export { DEFAULT_PRESET, useDateRange } from './useDateRange'
export { useDebouncedValue } from './useDebouncedValue'
export { useDialog } from './useDialog'
export { useElementWidth } from './useElementWidth'
export { usePermission, usePermissions } from './usePermissions'
export { useScrollMemory } from './useScrollMemory'
export { useSectionObserver } from './useSectionObserver'
