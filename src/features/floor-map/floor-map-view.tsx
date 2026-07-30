import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { RoomStatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ROOM_STATUSES } from '@/lib/api/types'
import { useHotelMap } from '@/lib/queries/floor-map'

import { FloorMapCanvas } from './floor-map-canvas'

export function FloorMapView() {
  const { t } = useTranslation()
  const { data, isLoading, isError } = useHotelMap()
  const [floor, setFloor] = useState<number>()

  // Default to floor 1 (or the lowest floor) once the map loads.
  useEffect(() => {
    if (!data || floor !== undefined) return
    const floors = data.floors.map((f) => f.floor)
    if (floors.length === 0) return
    setFloor(floors.includes(1) ? 1 : floors[0])
  }, [data, floor])

  if (isLoading) return <Skeleton className="h-[60vh] w-full" />
  if (isError || !data) {
    return <p className="text-destructive text-sm">{t('floorMap.loadError')}</p>
  }
  if (data.floors.length === 0) {
    return <p className="text-muted-foreground text-sm">{t('floorMap.noRooms')}</p>
  }

  const current = data.floors.find((f) => f.floor === floor) ?? data.floors[0]
  const unplaced = current.rooms.filter((room) => !room.placement)

  return (
    <div className="space-y-4">
      {/* Floor selector */}
      <div className="flex flex-wrap items-center gap-2">
        {data.floors.map((f) => (
          <Button
            key={f.floor}
            variant={f.floor === current.floor ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFloor(f.floor)}
          >
            {f.name ?? t('floorMap.floorLabel', { floor: f.floor })}
          </Button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <FloorMapCanvas floor={current} />

        <aside className="space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {ROOM_STATUSES.map((status) => (
              <RoomStatusBadge key={status} status={status} />
            ))}
          </div>

          <div className="rounded-lg border p-3">
            <h3 className="mb-2 text-sm font-medium">
              {t('floorMap.unplacedHeading')}
            </h3>
            {unplaced.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                {t('floorMap.unplacedEmpty')}
              </p>
            ) : (
              <ul className="flex flex-wrap gap-1.5">
                {unplaced.map((room) => (
                  <li
                    key={room.id}
                    className="bg-muted/40 rounded-md border px-2 py-1 text-sm"
                  >
                    {room.room_number}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
