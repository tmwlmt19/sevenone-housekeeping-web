import { Plus } from 'lucide-react'
import { Link, Outlet } from 'react-router-dom'

import { useAuth } from '@/auth/auth-context'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { StaffTable } from '@/features/staff/staff-table'

export function StaffPage() {
  const { user } = useAuth()
  const isManager = user?.role === 'manager'

  return (
    <div>
      <PageHeader
        title="Staff"
        description="The people who work at your hotel."
        action={
          isManager ? (
            <Button asChild>
              <Link to="/staff/request">
                <Plus className="size-4" />
                Request staff
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
