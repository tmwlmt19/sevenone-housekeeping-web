import { Plus } from 'lucide-react'
import { Link, Outlet } from 'react-router-dom'

import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { StaffTable } from '@/features/staff/staff-table'

export function StaffPage() {
  return (
    <div>
      <PageHeader
        title="Staff"
        description="Manage the people who work at your hotel."
        action={
          <Button asChild>
            <Link to="/staff/new">
              <Plus className="size-4" />
              Add staff
            </Link>
          </Button>
        }
      />
      <StaffTable />
      <Outlet />
    </div>
  )
}
