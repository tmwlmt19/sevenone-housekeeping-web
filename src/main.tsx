import { QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'

import './index.css'
import '@/lib/i18n'
import { AuthProvider } from '@/auth/auth-context'
import { Toaster } from '@/components/ui/sonner'
import { PreferencesProvider } from '@/lib/preferences/preferences'
import { queryClient } from '@/lib/query-client'
import { router } from '@/routes/router'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      storageKey="sevenone-theme"
      disableTransitionOnChange
    >
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <PreferencesProvider>
            <RouterProvider router={router} />
            <Toaster />
          </PreferencesProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
)
