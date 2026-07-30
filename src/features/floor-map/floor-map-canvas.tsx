import type { Decoration, FloorMap, MapRoom } from '@/lib/api/types'
import { cn } from '@/lib/utils'

import { STATUS_FILL, STATUS_STROKE } from './status-fill'

// Fallback canvas extent (feet) for a floor that has rooms but no saved map yet,
// so there's something to render before dimensions are set in the editor.
const DEFAULT_W = 120
const DEFAULT_H = 60
// Visual grid spacing in feet (major lines). The snap grid (grid_ft) is a
// separate, finer editing aid handled by the editor, not drawn here.
const GRID_FT = 10

function range(step: number, max: number): number[] {
  const out: number[] = []
  for (let v = step; v < max; v += step) out.push(v)
  return out
}

function DecorationShape({ deco }: { deco: Decoration }) {
  if (deco.kind === 'label') {
    return (
      <text
        x={deco.x}
        y={deco.y}
        className="fill-muted-foreground select-none"
        fontSize={3}
        dominantBaseline="hanging"
      >
        {deco.label}
      </text>
    )
  }

  const muted = deco.kind === 'hall' || deco.kind === 'lobby'
  const cx = deco.x + deco.w / 2
  const cy = deco.y + deco.h / 2
  return (
    <g>
      <rect
        x={deco.x}
        y={deco.y}
        width={deco.w}
        height={deco.h}
        rx={0.5}
        className={cn(
          'stroke-border',
          muted ? 'fill-muted/40' : 'fill-muted/70',
        )}
        strokeWidth={0.2}
      />
      {deco.w >= 4 && deco.h >= 3 && (
        <text
          x={cx}
          y={cy}
          className="fill-muted-foreground select-none"
          fontSize={2.4}
          textAnchor="middle"
          dominantBaseline="central"
        >
          {deco.label ?? deco.kind}
        </text>
      )}
    </g>
  )
}

function RoomShape({ room }: { room: MapRoom }) {
  const p = room.placement
  if (!p) return null
  const cx = p.x + p.w / 2
  const cy = p.y + p.h / 2
  const fontSize = Math.max(2, Math.min(p.w, p.h) * 0.28)
  return (
    <g transform={p.rotation ? `rotate(${p.rotation} ${cx} ${cy})` : undefined}>
      <rect
        x={p.x}
        y={p.y}
        width={p.w}
        height={p.h}
        rx={0.75}
        className={cn(STATUS_FILL[room.status], STATUS_STROKE[room.status])}
        strokeWidth={0.3}
      />
      <text
        x={cx}
        y={cy}
        className="fill-zinc-800 select-none dark:fill-zinc-100"
        fontSize={fontSize}
        textAnchor="middle"
        dominantBaseline="central"
      >
        {room.room_number}
      </text>
    </g>
  )
}

/**
 * Read-only render of one floor: the canvas outline, a light grid, decorations,
 * and every placed room colored by status. Geometry is integer feet; the SVG
 * viewBox is in feet so it scales crisply to any container width.
 */
export function FloorMapCanvas({ floor }: { floor: FloorMap }) {
  const width = floor.width_ft ?? DEFAULT_W
  const height = floor.height_ft ?? DEFAULT_H

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      className="bg-card h-auto w-full rounded-lg border"
      role="img"
      aria-label="Floor map"
    >
      {/* Grid */}
      <g className="stroke-border/60" strokeWidth={0.1}>
        {range(GRID_FT, width).map((x) => (
          <line key={`v${x}`} x1={x} y1={0} x2={x} y2={height} />
        ))}
        {range(GRID_FT, height).map((y) => (
          <line key={`h${y}`} x1={0} y1={y} x2={width} y2={y} />
        ))}
      </g>

      {floor.decorations.map((deco) => (
        <DecorationShape key={deco.id} deco={deco} />
      ))}

      {floor.rooms.map((room) => (
        <RoomShape key={room.id} room={room} />
      ))}
    </svg>
  )
}
