import { Plus } from 'lucide-react'
import { Link, Outlet } from 'react-router-dom'

import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { RoomsTable } from '@/features/rooms/rooms-table'

export function RoomsPage() {
  return (
    <div>
      <PageHeader
        title="Rooms"
        description="Manage the rooms in your hotel."
        action={
          <Button asChild>
            <Link to="/rooms/new">
              <Plus className="size-4" />
              New room
            </Link>
          </Button>
        }
      />
      <RoomsTable />
      {/* Route-aware create/edit modal renders here over the list. */}
      <Outlet />
    </div>
  )
}
