import {
  BedDouble,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Settings,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'

import { useAuth } from '@/auth/auth-context'
import type { Role } from '@/auth/types'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  roles: Role[]
}

const NAV_ITEMS: readonly NavItem[] = [
  {
    to: '/dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    roles: ['admin', 'manager'],
  },
  {
    to: '/rooms',
    label: 'Rooms',
    icon: BedDouble,
    roles: ['admin', 'manager'],
  },
  { to: '/staff', label: 'Staff', icon: Users, roles: ['admin', 'manager'] },
  {
    to: '/tasks',
    label: 'Tasks',
    icon: ClipboardList,
    roles: ['admin', 'manager'],
  },
  {
    to: '/settings/hotel',
    label: 'Settings',
    icon: Settings,
    roles: ['admin'],
  },
]

export function AppShell() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const items = NAV_ITEMS.filter((item) =>
    user ? item.roles.includes(user.role) : false,
  )

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex min-h-screen">
      <aside className="bg-sidebar text-sidebar-foreground flex w-60 flex-col border-r">
        <div className="px-5 py-4 text-lg font-semibold">SevenOne</div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {items.map(({ to, label, icon: Icon }) => (
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
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b px-6">
          <span className="text-muted-foreground text-sm">Housekeeping</span>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="size-4" />
            Logout
          </Button>
        </header>
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
