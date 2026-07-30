import { List, Map, Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Outlet } from 'react-router-dom'

import { useAuth } from '@/auth/auth-context'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { FloorStatusView } from '@/features/floor-map/floor-status-view'
import { RoomsTable } from '@/features/rooms/rooms-table'

export function RoomsPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const role = user?.role
  const isManager = role === 'manager'
  // Front desk + managers get the spatial map; admins (rarely here) list only.
  const canMap = role === 'manager' || role === 'front_desk'
  const [view, setView] = useState<'list' | 'map'>('list')

  return (
    <div>
      <PageHeader
        title={t('roomsPage.title')}
        description={t('roomsPage.subtitle')}
        action={
          isManager ? (
            <Button asChild>
              <Link to="/rooms/request">
                <Plus className="size-4" />
                {t('roomsPage.requestRoom')}
              </Link>
            </Button>
          ) : undefined
        }
      />

      {canMap && (
        <div className="mb-4 flex gap-1.5">
          <Button
            variant={view === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setView('list')}
          >
            <List className="size-4" />
            {t('roomsPage.listView')}
          </Button>
          <Button
            variant={view === 'map' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setView('map')}
          >
            <Map className="size-4" />
            {t('roomsPage.mapView')}
          </Button>
        </div>
      )}

      {canMap && view === 'map' ? <FloorStatusView /> : <RoomsTable />}

      {/* Route-aware request modal renders here over the list. */}
      <Outlet />
    </div>
  )
}
