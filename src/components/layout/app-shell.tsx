import {
  BedDouble,
  ClipboardList,
  Inbox,
  LayoutDashboard,
  LogOut,
  Settings,
  UserCircle,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { useAuth } from '@/auth/auth-context'
import type { Role } from '@/auth/types'
import { PreferencesMenu } from '@/components/preferences-menu'
import { Button } from '@/components/ui/button'
import { useHotel } from '@/lib/queries/hotel'
import { cn } from '@/lib/utils'

type NavLabelKey =
  | 'nav.dashboard'
  | 'nav.rooms'
  | 'nav.staff'
  | 'nav.tasks'
  | 'nav.requests'
  | 'nav.settings'

interface NavItem {
  to: string
  labelKey: NavLabelKey
  icon: LucideIcon
  roles: Role[]
}

const NAV_ITEMS: readonly NavItem[] = [
  {
    to: '/dashboard',
    labelKey: 'nav.dashboard',
    icon: LayoutDashboard,
    roles: ['admin', 'manager'],
  },
  {
    to: '/rooms',
    labelKey: 'nav.rooms',
    icon: BedDouble,
    roles: ['admin', 'manager'],
  },
  {
    to: '/staff',
    labelKey: 'nav.staff',
    icon: Users,
    roles: ['admin', 'manager'],
  },
  {
    to: '/tasks',
    labelKey: 'nav.tasks',
    icon: ClipboardList,
    roles: ['admin', 'manager'],
  },
  {
    to: '/requests',
    labelKey: 'nav.requests',
    icon: Inbox,
    roles: ['manager'],
  },
  {
    to: '/settings/hotel',
    labelKey: 'nav.settings',
    icon: Settings,
    roles: ['admin'],
  },
]

export function AppShell() {
  const { t } = useTranslation()
  const { user, logout } = useAuth()
  const { data: hotel } = useHotel()

  const items = NAV_ITEMS.filter((item) =>
    user ? item.roles.includes(user.role) : false,
  )

  return (
    <div className="flex min-h-screen">
      <aside className="bg-sidebar text-sidebar-foreground flex w-60 flex-col border-r">
        <div className="px-5 py-4 text-lg font-semibold">SevenOne</div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {items.map(({ to, labelKey, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
                )
              }
            >
              <Icon className="size-4" />
              {t(labelKey)}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b px-6">
          <span className="text-sm font-medium">
            {hotel?.name ?? t('nav.housekeeping')}
          </span>
          <div className="flex items-center gap-1">
            <PreferencesMenu />
            <Button asChild variant="ghost" size="sm">
              <Link to="/account">
                <UserCircle className="size-4" />
                {t('nav.account')}
              </Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => logout()}>
              <LogOut className="size-4" />
              {t('nav.logout')}
            </Button>
          </div>
        </header>
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
