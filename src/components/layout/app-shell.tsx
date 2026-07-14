import {
  BedDouble,
  ClipboardList,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  UserCircle,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useState } from 'react'
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
  // Sidebar is open by default on desktop, collapsed on small screens where it
  // becomes an off-canvas drawer toggled by the header hamburger.
  const [sidebarOpen, setSidebarOpen] = useState(
    () => window.matchMedia('(min-width: 768px)').matches,
  )

  const items = NAV_ITEMS.filter((item) =>
    user ? item.roles.includes(user.role) : false,
  )

  // On mobile, tapping a link should also close the drawer.
  const closeOnMobile = () => {
    if (!window.matchMedia('(min-width: 768px)').matches) setSidebarOpen(false)
  }

  return (
    <div className="flex min-h-screen">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          aria-hidden
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside
        className={cn(
          'bg-sidebar text-sidebar-foreground fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r transition-transform duration-200 md:static md:z-auto md:translate-x-0 md:transition-[width]',
          sidebarOpen
            ? 'translate-x-0 md:w-60'
            : '-translate-x-full md:w-0 md:overflow-hidden md:border-r-0',
        )}
      >
        <div className="flex items-center justify-between px-5 py-4">
          <span className="text-lg font-semibold">SevenOne</span>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label={t('nav.closeMenu')}
            onClick={() => setSidebarOpen(false)}
          >
            <X className="size-5" />
          </Button>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {items.map(({ to, labelKey, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={closeOnMobile}
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
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              aria-label={t('nav.toggleMenu')}
              onClick={() => setSidebarOpen((open) => !open)}
            >
              <Menu className="size-5" />
            </Button>
            <span className="text-sm font-medium">
              {hotel?.name ?? t('nav.housekeeping')}
            </span>
          </div>
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
