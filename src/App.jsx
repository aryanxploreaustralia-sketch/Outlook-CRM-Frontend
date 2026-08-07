/**
 * Application root.
 *
 * Kept intentionally thin: it composes global providers around the router.
 *
 * Provider order matters. `AuthProvider` is outermost because the route guard
 * inside the router depends on it; `UiProvider` sits inside because layout chrome
 * is only rendered for authenticated routes but must still be available to the
 * whole tree below.
 */

import { RouterProvider } from 'react-router-dom'

import { AuthProvider } from '@/context/AuthProvider'
import { UiProvider } from '@/context/UiProvider'
import { router } from '@/routes/router'

export function App() {
  return (
    <AuthProvider>
      <UiProvider>
        <RouterProvider router={router} />
      </UiProvider>
    </AuthProvider>
  )
}

export default App
