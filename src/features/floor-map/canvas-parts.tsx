import type { Decoration, RoomStatus } from '@/lib/api/types'
import { cn } from '@/lib/utils'

import { STATUS_FILL, STATUS_STROKE } from './status-fill'

// Visual grid spacing in feet (major lines). The snap grid (grid_ft) is a finer
// editing aid applied on drop/drag, not drawn here.
const GRID_FT = 10
// Non-placeable buffer (feet) drawn around the floor so dimension labels near an
// edge stay visible. Placement is still clamped to the floor (0..width/height).
export const CANVAS_PAD = 10

/** viewBox string that surrounds a width×height floor with the edge buffer. */
export function paddedViewBox(width: number, height: number): string {
  return `${-CANVAS_PAD} ${-CANVAS_PAD} ${width + CANVAS_PAD * 2} ${
    height + CANVAS_PAD * 2
  }`
}

function range(step: number, max: number): number[] {
  const out: number[] = []
  for (let v = step; v < max; v += step) out.push(v)
  return out
}

function GridLines({ width, height }: { width: number; height: number }) {
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

/** The placeable floor: a bordered panel with the grid, inside the edge buffer. */
export function FloorBackdrop({
  width,
  height,
}: {
  width: number
  height: number
}) {
  return (
    <>
      <rect
        x={0}
        y={0}
        width={width}
        height={height}
        rx={1}
        className="fill-card stroke-border"
        strokeWidth={0.3}
      />
      <GridLines width={width} height={height} />
    </>
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

  // Halls draw fill only; their outline is rendered by <HallBorders> so touching
  // corridors read as one shape (no border on shared edges).
  const isHall = deco.kind === 'hall'
  const muted = isHall || deco.kind === 'lobby'
  const cx = deco.x + deco.w / 2
  const cy = deco.y + deco.h / 2
  return (
    <g>
      <rect
        x={deco.x}
        y={deco.y}
        width={deco.w}
        height={deco.h}
        rx={isHall ? 0 : 0.5}
        className={cn(muted ? 'fill-muted/40' : 'fill-muted/70', !isHall && 'stroke-border')}
        strokeWidth={isHall ? 0 : 0.2}
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

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/** Remove the covered sub-intervals from [start, end], returning what's left. */
function subtractIntervals(
  start: number,
  end: number,
  covered: Array<[number, number]>,
): Array<[number, number]> {
  let parts: Array<[number, number]> = [[start, end]]
  for (const [cs, ce] of covered) {
    const next: Array<[number, number]> = []
    for (const [s, e] of parts) {
      if (ce <= s || cs >= e) {
        next.push([s, e])
        continue
      }
      if (cs > s) next.push([s, Math.min(cs, e)])
      if (ce < e) next.push([Math.max(ce, s), e])
    }
    parts = next
  }
  return parts.filter(([s, e]) => e - s > 0.01)
}

interface Seg {
  x1: number
  y1: number
  x2: number
  y2: number
}

/** Outline segments for a set of hall rects, omitting edges shared with another
 *  hall so touching corridors render as a single connected shape. */
export function hallBorderSegments(halls: Rect[]): Seg[] {
  const segs: Seg[] = []
  for (const r of halls) {
    const left = r.x
    const right = r.x + r.w
    const top = r.y
    const bottom = r.y + r.h

    const hCover = (edgeY: number, isTop: boolean) =>
      halls
        .filter((o) => o !== r && (isTop ? o.y + o.h === edgeY : o.y === edgeY))
        .map(
          (o) =>
            [Math.max(left, o.x), Math.min(right, o.x + o.w)] as [
              number,
              number,
            ],
        )
        .filter(([s, e]) => e > s)
    const vCover = (edgeX: number, isLeft: boolean) =>
      halls
        .filter((o) => o !== r && (isLeft ? o.x + o.w === edgeX : o.x === edgeX))
        .map(
          (o) =>
            [Math.max(top, o.y), Math.min(bottom, o.y + o.h)] as [
              number,
              number,
            ],
        )
        .filter(([s, e]) => e > s)

    for (const [s, e] of subtractIntervals(left, right, hCover(top, true)))
      segs.push({ x1: s, y1: top, x2: e, y2: top })
    for (const [s, e] of subtractIntervals(left, right, hCover(bottom, false)))
      segs.push({ x1: s, y1: bottom, x2: e, y2: bottom })
    for (const [s, e] of subtractIntervals(top, bottom, vCover(left, true)))
      segs.push({ x1: left, y1: s, x2: left, y2: e })
    for (const [s, e] of subtractIntervals(top, bottom, vCover(right, false)))
      segs.push({ x1: right, y1: s, x2: right, y2: e })
  }
  return segs
}

export function HallBorders({ decorations }: { decorations: Decoration[] }) {
  const halls = decorations
    .filter((d) => d.kind === 'hall')
    .map((d) => ({ x: d.x, y: d.y, w: d.w, h: d.h }))
  if (halls.length === 0) return null
  return (
    <g className="stroke-border" strokeWidth={0.3} strokeLinecap="round">
      {hallBorderSegments(halls).map((s, i) => (
        <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} />
      ))}
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
