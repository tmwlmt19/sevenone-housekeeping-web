import { Eye, LayoutGrid, List, Map, Plus, Users } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Outlet, useSearchParams } from 'react-router-dom'

import { useAuth } from '@/auth/auth-context'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { FloorAssignView } from '@/features/floor-map/floor-assign-view'
import { FloorMapView } from '@/features/floor-map/floor-map-view'
import { FloorStatusView } from '@/features/floor-map/floor-status-view'
import { MinWidthGate } from '@/features/floor-map/min-width-gate'
import { RoomsTable } from '@/features/rooms/rooms-table'

// The floor map's editor + assign tools want a tablet/desktop screen; below this
// width they show a notice. The read-only status view has no such gate.
const MIN_WIDTH = 768

type MapMode = 'view' | 'edit' | 'assign'

export function RoomsPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const role = user?.role
  const isManager = role === 'manager'
  // Front desk + managers get the spatial map; admins (rarely here) list only.
  const canMap = role === 'manager' || role === 'front_desk'
  const [params] = useSearchParams()

  // Deep-link support: the dirty-room import's "assign on the map" path lands
  // here with ?view=map&mode=assign after marking rooms dirty.
  const wantsMap = canMap && params.get('view') === 'map'
  const [view, setView] = useState<'list' | 'map'>(wantsMap ? 'map' : 'list')
  const [mapMode, setMapMode] = useState<MapMode>(
    isManager && params.get('mode') === 'assign' ? 'assign' : 'view',
  )

  const mapModes: { key: MapMode; label: string; icon: typeof Eye }[] = [
    { key: 'view', label: t('roomsPage.mapMode.view'), icon: Eye },
    { key: 'edit', label: t('roomsPage.mapMode.edit'), icon: LayoutGrid },
    { key: 'assign', label: t('roomsPage.mapMode.assign'), icon: Users },
  ]

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
        <div className="mb-4 flex flex-wrap items-center gap-1.5">
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

          {/* Managers pick what the map does: view status, edit layout, assign. */}
          {view === 'map' && isManager && (
            <div className="ml-2 flex flex-wrap gap-1.5 border-l pl-2">
              {mapModes.map((m) => (
                <Button
                  key={m.key}
                  variant={mapMode === m.key ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setMapMode(m.key)}
                >
                  <m.icon className="size-4" />
                  {m.label}
                </Button>
              ))}
            </div>
          )}
        </div>
      )}

      {canMap && view === 'map' ? <MapPane mapMode={isManager ? mapMode : 'view'} /> : <RoomsTable />}

      {/* Route-aware request modal renders here over the list. */}
      <Outlet />
    </div>
  )
}

/** The map body for the chosen mode. Edit + assign need room to work, so they sit
 *  behind the min-width gate; the status view works at any size. */
function MapPane({ mapMode }: { mapMode: MapMode }) {
  if (mapMode === 'edit') {
    return (
      <MinWidthGate minWidth={MIN_WIDTH}>
        <FloorMapView />
      </MinWidthGate>
    )
  }
  if (mapMode === 'assign') {
    return (
      <MinWidthGate minWidth={MIN_WIDTH}>
        <FloorAssignView />
      </MinWidthGate>
    )
  }
  return <FloorStatusView />
}
