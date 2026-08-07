/**
 * Fetches the caller's permissions once and shares them.
 *
 * Mounted inside the admin shell rather than at the application root, because
 * the CRM does not consult permissions yet and every user of it would otherwise
 * pay for a request they never read.
 *
 * ## What this is, and what it is not
 *
 * It is what decides **what renders**. It is not a security control, and
 * nothing here should ever be mistaken for one: a determined user can edit the
 * set in a debugger and reveal every hidden button. Each of those buttons calls
 * an endpoint that checks again, server-side, against the same matrix — and
 * refuses with a 403.
 *
 * Hiding a control is a courtesy to the person using the product: it keeps the
 * interface honest about what they can do. The refusal is the control.
 *
 * ## Failing closed
 *
 * If the fetch fails, `permissions` stays empty and `can()` answers false for
 * everything. The console then shows an error rather than a shell of empty
 * pages, and — importantly — never renders a control on the assumption that the
 * caller probably had the right to it.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { PermissionContext } from '@/admin/context/permissionContext'
import { fetchMyPermissions } from '@/admin/services/admin.service'
import { isCancelledError } from '@/utils/apiError'

/** Shared empty set, so the pre-load path allocates nothing per render. */
const NONE = Object.freeze(new Set())

export function PermissionProvider({ children }) {
  const [state, setState] = useState({
    isReady: false,
    error: null,
    role: null,
    roleLabel: null,
    permissions: NONE,
    adminAccess: false,
    catalogue: {},
    groups: [],
  })

  const [nonce, setNonce] = useState(0)

  /**
   * Keys already reported as unknown.
   *
   * `can()` runs on every render of every gated element, so without this a
   * single bad key would print a warning hundreds of times and bury everything
   * else in the console.
   */
  const warnedRef = useRef(new Set())

  useEffect(() => {
    const controller = new AbortController()

    fetchMyPermissions({ signal: controller.signal })
      .then((data) => {
        setState({
          isReady: true,
          error: null,
          role: data.role,
          roleLabel: data.roleLabel,
          permissions: new Set(data.permissions ?? []),
          adminAccess: data.adminAccess === true,
          catalogue: data.catalogue ?? {},
          groups: data.groups ?? [],
        })
      })
      .catch((error) => {
        // An abort is a superseded request or an unmount, not a failure.
        if (isCancelledError(error)) return

        // Fail closed: ready, but holding nothing.
        setState((previous) => ({
          ...previous,
          isReady: true,
          error,
          permissions: NONE,
          adminAccess: false,
        }))
      })

    return () => controller.abort()
  }, [nonce])

  const { permissions, catalogue } = state

  /**
   * Warns once per unknown key, in development only.
   *
   * This is what makes the client-side key list safe to keep: a string that has
   * drifted out of step with the server is reported the first time it is used,
   * instead of silently hiding a control that should have been visible.
   */
  const assertKnown = useCallback(
    (permission) => {
      if (!import.meta.env.DEV) return
      if (!state.isReady) return
      // An empty catalogue means the fetch failed; nothing to check against.
      if (Object.keys(catalogue).length === 0) return
      if (catalogue[permission] !== undefined) return
      if (warnedRef.current.has(permission)) return

      warnedRef.current.add(permission)
      // eslint-disable-next-line no-console
      console.warn(
        `[permissions] "${permission}" is not in the server's registry. ` +
          'It will never grant access. Check @/admin/constants/permissions against ' +
          'backend/src/constants/permissions.js.',
      )
    },
    [catalogue, state.isReady],
  )

  const can = useCallback(
    (permission) => {
      if (!permission) return false
      assertKnown(permission)
      return permissions.has(permission)
    },
    [permissions, assertKnown],
  )

  const canAny = useCallback(
    (list) => (list?.length ? list.some((permission) => can(permission)) : false),
    [can],
  )

  const canAll = useCallback(
    (list) => (list?.length ? list.every((permission) => can(permission)) : false),
    [can],
  )

  const refresh = useCallback(() => setNonce((previous) => previous + 1), [])

  const value = useMemo(
    () => ({ ...state, can, canAny, canAll, refresh }),
    [state, can, canAny, canAll, refresh],
  )

  return <PermissionContext.Provider value={value}>{children}</PermissionContext.Provider>
}

export default PermissionProvider
