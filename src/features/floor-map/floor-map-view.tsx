import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { useAuth } from '@/auth/auth-context'
import { Skeleton } from '@/components/ui/skeleton'
import { ApiError } from '@/lib/api/unwrap'
import { type FloorMapWrite } from '@/lib/api/types'
import { useHotelMap, useSaveFloorMap } from '@/lib/queries/floor-map'

import { FloorMapCanvas } from './floor-map-canvas'
import { FloorMapEditor } from './floor-map-editor'
import { FloorSelector, StatusLegend } from './map-chrome'

export function FloorMapView() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const isManager = user?.role === 'manager'
  const { data, isLoading, isError } = useHotelMap()
  const saveMutation = useSaveFloorMap()
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

  async function handleSave(body: FloorMapWrite) {
    try {
      await saveMutation.mutateAsync({ floor: current.floor, body })
      toast.success(t('floorMap.saved'))
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : t('common.somethingWentWrong'),
      )
      throw err // keep the editor's draft so nothing is lost
    }
  }

  const unplaced = current.rooms.filter((room) => !room.placement)

  return (
    <div className="space-y-4">
      <FloorSelector
        floors={data.floors}
        current={current.floor}
        onSelect={setFloor}
      />
      <StatusLegend />

      {isManager ? (
        <FloorMapEditor
          key={current.floor}
          floor={current}
          onSave={handleSave}
          saving={saveMutation.isPending}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
          <FloorMapCanvas floor={current} />
          <aside>
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
          </aside>
        </div>
      )}
    </div>
  )
}
