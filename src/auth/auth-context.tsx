import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import { api } from '@/lib/api/client'

import { redirectToLogin } from './redirect'
import type { AuthUser } from './types'

type Status = 'loading' | 'authed' | 'unauthed'

interface AuthContextValue {
  user: AuthUser | null
  status: Status
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [status, setStatus] = useState<Status>('loading')

  useEffect(() => {
    let active = true
    void (async () => {
      const { data } = await api.GET('/api/v1/auth/me')
      if (!active) return
      if (data) {
        // hotel_id is nullable on the API (platform admins have none), but the
        // web app is only used by hotel-scoped roles, which always have one.
        setUser({ id: data.id, hotelId: data.hotel_id ?? '', role: data.role })
        setStatus('authed')
      } else {
        // A 401 already triggered a redirect to the login app in the client.
        setStatus('unauthed')
      }
    })()
    return () => {
      active = false
    }
  }, [])

  const logout = useCallback(async () => {
    await api.POST('/api/v1/auth/logout', {})
    redirectToLogin()
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ user, status, logout }),
    [user, status, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = use(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
