import { Plus } from 'lucide-react'
import { Link, Outlet } from 'react-router-dom'

import { useAuth } from '@/auth/auth-context'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { StaffTable } from '@/features/staff/staff-table'

export function StaffPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

  return (
    <div>
      <PageHeader
        title="Staff"
        description="The people who work at your hotel."
        action={
          isAdmin ? (
            <Button asChild>
              <Link to="/staff/new">
                <Plus className="size-4" />
                Add staff
              </Link>
            </Button>
          ) : undefined
        }
      />
      <StaffTable />
      <Outlet />
    </div>
  )
}
