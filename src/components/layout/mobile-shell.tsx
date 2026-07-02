import { LogOut, UserCircle } from 'lucide-react'
import { Link, Outlet, useNavigate } from 'react-router-dom'

import { useAuth } from '@/auth/auth-context'
import { Button } from '@/components/ui/button'

export function MobileShell() {
  const { logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col">
      <header className="flex h-14 items-center justify-between border-b px-4">
        <span className="font-semibold">SevenOne</span>
        <div className="flex items-center gap-1">
          <Button asChild variant="ghost" size="icon" aria-label="Account">
            <Link to="/account">
              <UserCircle className="size-4" />
            </Link>
          </Button>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="size-4" />
            Logout
          </Button>
        </div>
      </header>
      <main className="flex-1 p-4">
        <Outlet />
      </main>
    </div>
  )
}
