import { Navigate, Outlet } from 'react-router-dom'

import { useAuth } from '@/auth/auth-context'
import type { Role } from '@/auth/types'

/** Where each role lands after login / when blocked from a route. */
export function homePathFor(role: Role): string {
  return role === 'housekeeper' ? '/my-tasks' : '/dashboard'
}

function FullScreen({ children }: { children: string }) {
  return (
    <div className="text-muted-foreground flex min-h-screen items-center justify-center text-sm">
      {children}
    </div>
  )
}

/** Gate: must have a session. While checking (or redirecting to the login app
 * on 401) we render a lightweight placeholder. */
export function RequireAuth() {
  const { status } = useAuth()
  if (status !== 'authed') {
    return <FullScreen>Loading…</FullScreen>
  }
  return <Outlet />
}

/** Gate: role must be allowed, else bounce to the user's own home. */
export function RequireRole({ allow }: { allow: Role[] }) {
  const { user } = useAuth()
  if (!user) return <FullScreen>Loading…</FullScreen>
  if (!allow.includes(user.role)) {
    return <Navigate to={homePathFor(user.role)} replace />
  }
  return <Outlet />
}

/** Index route: send each role to its home. */
export function RootRedirect() {
  const { user } = useAuth()
  if (!user) return <FullScreen>Loading…</FullScreen>
  return <Navigate to={homePathFor(user.role)} replace />
}
