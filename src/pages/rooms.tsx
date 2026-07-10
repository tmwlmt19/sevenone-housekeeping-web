import { Plus } from 'lucide-react'
import { Link, Outlet } from 'react-router-dom'

import { useAuth } from '@/auth/auth-context'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { RoomsTable } from '@/features/rooms/rooms-table'

export function RoomsPage() {
  const { user } = useAuth()
  const isManager = user?.role === 'manager'

  return (
    <div>
      <PageHeader
        title="Rooms"
        description="Manage the rooms in your hotel."
        action={
          isManager ? (
            <Button asChild>
              <Link to="/rooms/request">
                <Plus className="size-4" />
                Request room
              </Link>
            </Button>
          ) : undefined
        }
      />
      <RoomsTable />
      {/* Route-aware request modal renders here over the list. */}
      <Outlet />
    </div>
  )
}
