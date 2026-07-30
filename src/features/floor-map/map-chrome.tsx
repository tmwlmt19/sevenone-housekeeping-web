import { useTranslation } from 'react-i18next'

import { RoomStatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { ROOM_STATUSES, type FloorMap } from '@/lib/api/types'

/** Floor picker shared by the editor and the status view. */
export function FloorSelector({
  floors,
  current,
  onSelect,
}: {
  floors: FloorMap[]
  current: number
  onSelect: (floor: number) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-wrap items-center gap-2">
      {floors.map((f) => (
        <Button
          key={f.floor}
          variant={f.floor === current ? 'default' : 'outline'}
          size="sm"
          onClick={() => onSelect(f.floor)}
        >
          {f.name ?? t('floorMap.floorLabel', { floor: f.floor })}
        </Button>
      ))}
    </div>
  )
}

/** Room-status color key. */
export function StatusLegend() {
  return (
    <div className="flex flex-wrap gap-1.5">
      {ROOM_STATUSES.map((status) => (
        <RoomStatusBadge key={status} status={status} />
      ))}
    </div>
  )
}
