import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Skeleton } from '@/components/ui/skeleton'
import { RoomStatusControl } from '@/features/rooms/room-status-control'
import { useHotelMap } from '@/lib/queries/floor-map'
import { useRooms } from '@/lib/queries/rooms'

import { FloorMapCanvas } from './floor-map-canvas'
import { FloorSelector, StatusLegend } from './map-chrome'

/**
 * Read-only spatial view of room status with tap-to-change-status. Colors come
 * from the map query; tapping a placed room opens the shared RoomStatusControl
 * (full Room from the rooms query), whose mutation invalidates both the rooms and
 * map queries so the list, dashboard, and map all stay in sync.
 */
export function FloorStatusView() {
  const { t } = useTranslation()
  const { data: map, isLoading, isError } = useHotelMap()
  const { data: rooms } = useRooms()
  const [floor, setFloor] = useState<number>()
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null)

  useEffect(() => {
    if (!map || floor !== undefined) return
    const floors = map.floors.map((f) => f.floor)
    if (floors.length === 0) return
    setFloor(floors.includes(1) ? 1 : floors[0])
  }, [map, floor])

  if (isLoading) return <Skeleton className="h-[60vh] w-full" />
  if (isError || !map) {
    return <p className="text-destructive text-sm">{t('floorMap.loadError')}</p>
  }
  if (map.floors.length === 0) {
    return <p className="text-muted-foreground text-sm">{t('floorMap.noRooms')}</p>
  }

  const current = map.floors.find((f) => f.floor === floor) ?? map.floors[0]
  const selectedRoom = rooms?.find((r) => r.id === selectedRoomId) ?? null

  return (
    <div className="space-y-4">
      <FloorSelector
        floors={map.floors}
        current={current.floor}
        onSelect={(f) => {
          setFloor(f)
          setSelectedRoomId(null)
        }}
      />
      <StatusLegend />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <FloorMapCanvas
          floor={current}
          onRoomClick={setSelectedRoomId}
          selectedRoomId={selectedRoomId}
        />
        <aside>
          {selectedRoom ? (
            <div className="space-y-2">
              <h3 className="text-sm font-medium">
                {t('floorMap.roomHeading', { number: selectedRoom.room_number })}
              </h3>
              <RoomStatusControl room={selectedRoom} />
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              {t('floorMap.tapToInspect')}
            </p>
          )}
        </aside>
      </div>
    </div>
  )
}
