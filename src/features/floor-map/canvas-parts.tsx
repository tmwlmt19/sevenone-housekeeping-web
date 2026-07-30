import type { Decoration, RoomStatus } from '@/lib/api/types'
import { cn } from '@/lib/utils'

import { STATUS_FILL, STATUS_STROKE } from './status-fill'

// Visual grid spacing in feet (major lines). The snap grid (grid_ft) is a finer
// editing aid applied on drop/drag, not drawn here.
const GRID_FT = 10

function range(step: number, max: number): number[] {
  const out: number[] = []
  for (let v = step; v < max; v += step) out.push(v)
  return out
}

export function GridLines({
  width,
  height,
}: {
  width: number
  height: number
}) {
  return (
    <g className="stroke-border/60" strokeWidth={0.1}>
      {range(GRID_FT, width).map((x) => (
        <line key={`v${x}`} x1={x} y1={0} x2={x} y2={height} />
      ))}
      {range(GRID_FT, height).map((y) => (
        <line key={`h${y}`} x1={0} y1={y} x2={width} y2={y} />
      ))}
    </g>
  )
}

export function DecorationShape({ deco }: { deco: Decoration }) {
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
        className={cn('stroke-border', muted ? 'fill-muted/40' : 'fill-muted/70')}
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

export function RoomRect({
  x,
  y,
  w,
  h,
  rotation,
  status,
  roomNumber,
  selected = false,
  interactive = false,
  onPointerDown,
}: {
  x: number
  y: number
  w: number
  h: number
  rotation: number
  status: RoomStatus
  roomNumber: string
  selected?: boolean
  interactive?: boolean
  onPointerDown?: (e: React.PointerEvent) => void
}) {
  const cx = x + w / 2
  const cy = y + h / 2
  const fontSize = Math.max(2, Math.min(w, h) * 0.28)
  return (
    <g
      transform={rotation ? `rotate(${rotation} ${cx} ${cy})` : undefined}
      onPointerDown={onPointerDown}
      className={interactive ? 'cursor-grab' : undefined}
      role={interactive ? 'button' : undefined}
      aria-label={interactive ? `Room ${roomNumber} – ${status}` : undefined}
    >
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={0.75}
        className={cn(
          STATUS_FILL[status],
          selected ? 'stroke-foreground' : STATUS_STROKE[status],
        )}
        strokeWidth={selected ? 0.6 : 0.3}
      />
      <text
        x={cx}
        y={cy}
        className="fill-zinc-800 select-none dark:fill-zinc-100"
        fontSize={fontSize}
        textAnchor="middle"
        dominantBaseline="central"
      >
        {roomNumber}
      </text>
    </g>
  )
}
