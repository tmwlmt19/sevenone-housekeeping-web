import type { FloorMap } from '@/lib/api/types'

import {
  DecorationShape,
  FloorBackdrop,
  HallBorders,
  paddedViewBox,
  RoomRect,
} from './canvas-parts'

// Fallback canvas extent (feet) for a floor that has rooms but no saved map yet,
// so there's something to render before dimensions are set in the editor.
const DEFAULT_W = 120
const DEFAULT_H = 60

/**
 * Render of one floor: the floor panel, a light grid, decorations, and every
 * placed room colored by status. Read-only by default; pass `onRoomClick` to make
 * rooms tappable (used by the status view for tap-to-change-status). Geometry is
 * integer feet; the viewBox is in feet (with an edge buffer) so it scales crisply.
 */
export function FloorMapCanvas({
  floor,
  onRoomClick,
  selectedRoomId,
}: {
  floor: FloorMap
  onRoomClick?: (roomId: string) => void
  selectedRoomId?: string | null
}) {
  const width = floor.width_ft ?? DEFAULT_W
  const height = floor.height_ft ?? DEFAULT_H

  return (
    <svg
      viewBox={paddedViewBox(width, height)}
      preserveAspectRatio="xMidYMid meet"
      className="bg-muted/20 h-auto w-full rounded-lg border"
      style={onRoomClick ? { touchAction: 'none' } : undefined}
      role="img"
      aria-label="Floor map"
    >
      <FloorBackdrop width={width} height={height} />

      {floor.decorations.map((deco) => (
        <DecorationShape key={deco.id} deco={deco} />
      ))}
      <HallBorders decorations={floor.decorations} />

      {floor.rooms.map((room) =>
        room.placement ? (
          <RoomRect
            key={room.id}
            x={room.placement.x}
            y={room.placement.y}
            w={room.placement.w}
            h={room.placement.h}
            rotation={room.placement.rotation}
            status={room.status}
            roomNumber={room.room_number}
            selected={selectedRoomId === room.id}
            interactive={!!onRoomClick}
            onPointerDown={onRoomClick ? () => onRoomClick(room.id) : undefined}
          />
        ) : null,
      )}
    </svg>
  )
}
