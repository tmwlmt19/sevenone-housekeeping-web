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
 * Read-only render of one floor: the floor panel, a light grid, decorations, and
 * every placed room colored by status. Geometry is integer feet; the SVG viewBox
 * is in feet (with an edge buffer) so it scales crisply to any container width.
 */
export function FloorMapCanvas({ floor }: { floor: FloorMap }) {
  const width = floor.width_ft ?? DEFAULT_W
  const height = floor.height_ft ?? DEFAULT_H

  return (
    <svg
      viewBox={paddedViewBox(width, height)}
      preserveAspectRatio="xMidYMid meet"
      className="bg-muted/20 h-auto w-full rounded-lg border"
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
          />
        ) : null,
      )}
    </svg>
  )
}
