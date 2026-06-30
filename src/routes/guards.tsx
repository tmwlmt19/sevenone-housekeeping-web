import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { useAuth } from '@/auth/auth-context'
import type { Role } from '@/auth/types'

/** Where each role lands after login / when blocked from a route. */
export function homePathFor(role: Role): string {
  return role === 'housekeeper' ? '/my-tasks' : '/dashboard'
}

/** Gate: must be authenticated, else redirect to /login (remembering origin). */
export function RequireAuth() {
  const { isAuthenticated } = useAuth()
  const location = useLocation()
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }
  return <Outlet />
}

/** Gate: role must be allowed, else bounce to the user's own home. */
export function RequireRole({ allow }: { allow: Role[] }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (!allow.includes(user.role)) {
    return <Navigate to={homePathFor(user.role)} replace />
  }
  return <Outlet />
}

/** Index route: send each role to its home. */
export function RootRedirect() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return <Navigate to={homePathFor(user.role)} replace />
}
