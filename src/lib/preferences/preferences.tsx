import { useTheme } from 'next-themes'
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react'
import { useTranslation } from 'react-i18next'

import { useAuth } from '@/auth/auth-context'
import { api } from '@/lib/api/client'
import type { Language, Theme } from '@/lib/api/types'
import { setLanguage } from '@/lib/i18n'

interface PreferencesValue {
  theme: Theme
  language: Language
  setTheme: (theme: Theme) => void
  setLanguage: (language: Language) => void
}

const PreferencesContext = createContext<PreferencesValue | null>(null)

/**
 * Bridges the user's persisted preferences (from `/auth/me`) with the local
 * theme (next-themes) and language (i18next) state, and writes changes back to
 * the API so they follow the user across devices. Local state stays the
 * fast/optimistic path; the server is the source of truth on next load.
 */
export function PreferencesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { theme, setTheme } = useTheme()
  const { i18n } = useTranslation()
  const appliedFor = useRef<string | null>(null)

  // On login (or user switch), apply the server-stored preferences once.
  useEffect(() => {
    if (!user || appliedFor.current === user.id) return
    appliedFor.current = user.id
    setTheme(user.theme)
    setLanguage(user.preferredLanguage)
  }, [user, setTheme])

  const persist = useCallback(
    (body: { theme?: Theme; preferred_language?: Language }) => {
      void api.PATCH('/api/v1/auth/me/preferences', { body })
    },
    [],
  )

  const changeTheme = useCallback(
    (next: Theme) => {
      setTheme(next)
      persist({ theme: next })
    },
    [setTheme, persist],
  )

  const changeLanguage = useCallback(
    (next: Language) => {
      setLanguage(next)
      persist({ preferred_language: next })
    },
    [persist],
  )

  const value = useMemo<PreferencesValue>(
    () => ({
      theme: (theme as Theme | undefined) ?? 'system',
      language: (i18n.language as Language) === 'es' ? 'es' : 'en',
      setTheme: changeTheme,
      setLanguage: changeLanguage,
    }),
    [theme, i18n.language, changeTheme, changeLanguage],
  )

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  )
}

export function usePreferences(): PreferencesValue {
  const ctx = use(PreferencesContext)
  if (!ctx)
    throw new Error('usePreferences must be used within a PreferencesProvider')
  return ctx
}
