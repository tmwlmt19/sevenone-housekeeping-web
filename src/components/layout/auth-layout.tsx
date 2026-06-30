import { Outlet } from 'react-router-dom'

export function AuthLayout() {
  return (
    <div className="bg-muted/40 flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <Outlet />
      </div>
    </div>
  )
}
