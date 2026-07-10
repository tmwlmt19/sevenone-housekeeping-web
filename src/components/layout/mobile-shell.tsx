import { LogOut, UserCircle } from 'lucide-react'
import { Link, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { useAuth } from '@/auth/auth-context'
import { PreferencesMenu } from '@/components/preferences-menu'
import { Button } from '@/components/ui/button'

export function MobileShell() {
  const { t } = useTranslation()
  const { logout } = useAuth()

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col">
      <header className="flex h-14 items-center justify-between border-b px-4">
        <span className="font-semibold">SevenOne</span>
        <div className="flex items-center gap-1">
          <PreferencesMenu />
          <Button
            asChild
            variant="ghost"
            size="icon"
            aria-label={t('nav.account')}
          >
            <Link to="/account">
              <UserCircle className="size-4" />
            </Link>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => logout()}>
            <LogOut className="size-4" />
            {t('nav.logout')}
          </Button>
        </div>
      </header>
      <main className="flex-1 p-4">
        <Outlet />
      </main>
    </div>
  )
}
