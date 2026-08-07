/**
 * The permission context object.
 *
 * Its own file so `PermissionProvider.jsx` exports only a component — a module
 * that exports both a component and a value defeats Fast Refresh, which is the
 * same reason `@/context/authContext.js` sits apart from `AuthProvider.jsx`.
 */

import { createContext } from 'react'

/**
 * @typedef  {object} PermissionContextValue
 * @property {boolean}  isReady      False until the grant set has been fetched.
 * @property {?object}  error        Normalised API error, when the fetch failed.
 * @property {?string}  role
 * @property {?string}  roleLabel
 * @property {Set<string>} permissions  The caller's effective grants.
 * @property {boolean}  adminAccess  Whether the console should open at all.
 * @property {object}   catalogue    Every permission the server knows, keyed by
 *   string. Used to warn about keys the client invented.
 * @property {Array}    groups       Catalogue grouping, for permission views.
 * @property {(permission: string) => boolean} can
 * @property {(permissions: string[]) => boolean} canAny
 * @property {(permissions: string[]) => boolean} canAll
 * @property {() => void} refresh
 */

export const PermissionContext = createContext(null)

export default PermissionContext
