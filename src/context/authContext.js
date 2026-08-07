/**
 * The auth context object itself.
 *
 * Kept in its own module, separate from both the provider component and the
 * consumer hook. Vite's Fast Refresh only preserves component state when a file
 * exports components exclusively; mixing a context object, a provider and a hook
 * into one file silently degrades the development experience by forcing a full
 * reload on every edit.
 *
 * `null` is the default so `useAuth` can detect use outside a provider and throw
 * a clear error, rather than handing back a plausible-looking empty object.
 */

import { createContext } from 'react'

export const AuthContext = createContext(null)

export default AuthContext
