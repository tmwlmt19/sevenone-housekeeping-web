import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import {
  clearToken,
  getToken,
  setOnUnauthorized,
  setToken,
} from '@/lib/api/token-store'

import { decodeJwt, isExpired } from './jwt'
import type { AuthUser } from './types'

interface AuthContextValue {
  user: AuthUser | null
  isAuthenticated: boolean
  login: (token: string) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function userFromToken(token: string | null): AuthUser | null {
  if (!token) return null
  const claims = decodeJwt(token)
  if (!claims || isExpired(claims)) return null
  return { id: claims.sub, hotelId: claims.hotel_id, role: claims.role }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() =>
    userFromToken(getToken()),
  )

  const logout = useCallback(() => {
    clearToken()
    setUser(null)
  }, [])

  const login = useCallback((token: string) => {
    setToken(token)
    setUser(userFromToken(token))
  }, [])

  useEffect(() => {
    // Drop any stale/expired token left in storage on first load.
    if (!user && getToken()) clearToken()
    // The API client calls this when it sees a 401.
    setOnUnauthorized(() => setUser(null))
    return () => setOnUnauthorized(null)
  }, [user])

  const value = useMemo<AuthContextValue>(
    () => ({ user, isAuthenticated: user !== null, login, logout }),
    [user, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = use(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
