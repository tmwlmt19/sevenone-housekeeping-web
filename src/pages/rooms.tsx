import { Plus } from 'lucide-react'
import { Link, Outlet } from 'react-router-dom'

import { useAuth } from '@/auth/auth-context'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { RoomsTable } from '@/features/rooms/rooms-table'

export function RoomsPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

  return (
    <div>
      <PageHeader
        title="Rooms"
        description="Manage the rooms in your hotel."
        action={
          isAdmin ? (
            <Button asChild>
              <Link to="/rooms/new">
                <Plus className="size-4" />
                New room
              </Link>
            </Button>
          ) : undefined
        }
      />
      <RoomsTable />
      {/* Route-aware create/edit modal renders here over the list. */}
      <Outlet />
    </div>
  )
}
