import type { Decoration, Polygon, RoomStatus } from '@/lib/api/types'
import { cn } from '@/lib/utils'

import { boundingBox, centroid, rectVertices } from './geometry'
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

/** An SVG `points` string ("x,y x,y …") for a polygon. */
export function polygonPoints(v: Polygon): string {
  return v.map(([x, y]) => `${x},${y}`).join(' ')
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

/** The placeable floor: the floor's outline polygon (or the plain width×height
 *  rectangle when no custom outline is set) with the grid, inside the edge buffer. */
export function FloorBackdrop({
  width,
  height,
  outline,
}: {
  width: number
  height: number
  outline?: Polygon | null
}) {
  const hasOutline = !!outline && outline.length >= 3
  return (
    <>
      {hasOutline ? (
        <polygon
          points={polygonPoints(outline)}
          className="fill-card stroke-border"
          strokeWidth={0.3}
        />
      ) : (
        <rect
          x={0}
          y={0}
          width={width}
          height={height}
          rx={1}
          className="fill-card stroke-border"
          strokeWidth={0.3}
        />
      )}
      <GridLines width={width} height={height} />
    </>
  )
}

/** A stairs / elevator pictogram centered at (cx, cy), sized to the shape and
 *  drawn upright (independent of the shape's rotation) so it reads at a glance on
 *  the manager/front-desk map. `size` is the shape's shorter side, in feet. */
function DecorationIcon({
  kind,
  cx,
  cy,
  size,
}: {
  kind: Decoration['kind']
  cx: number
  cy: number
  size: number
}) {
  const r = size * 0.28 // glyph half-extent
  if (kind === 'stairs') {
    // A staircase climbing to the right — a stepped profile, stroked.
    const step = (r * 2) / 4
    const pts: [number, number][] = [[-r, r]]
    for (let i = 0; i < 4; i++) {
      const [px, py] = pts[pts.length - 1]
      pts.push([px, py - step]) // riser
      pts.push([px + step, py - step]) // tread
    }
    return (
      <polyline
        points={pts.map(([x, y]) => `${cx + x},${cy + y}`).join(' ')}
        className="stroke-foreground/80 fill-none"
        strokeWidth={size * 0.07}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    )
  }
  if (kind !== 'elevator') return null
  // Elevator — the universal up/down-triangle pictogram.
  const w = r * 0.62
  const up = `${cx},${cy - r} ${cx - w},${cy - r * 0.15} ${cx + w},${cy - r * 0.15}`
  const down = `${cx},${cy + r} ${cx - w},${cy + r * 0.15} ${cx + w},${cy + r * 0.15}`
  return (
    <g className="fill-foreground/80">
      <polygon points={up} />
      <polygon points={down} />
    </g>
  )
}

export function DecorationShape({ deco }: { deco: Decoration }) {
  if (deco.kind === 'label') {
    const [x, y] = deco.vertices[0] ?? [0, 0]
    return (
      <text
        x={x}
        y={y}
        className="fill-muted-foreground select-none"
        fontSize={3}
        dominantBaseline="hanging"
      >
        {deco.label}
      </text>
    )
  }

  const circulation = deco.kind === 'stairs' || deco.kind === 'elevator'
  const muted = deco.kind === 'hall' || deco.kind === 'lobby'
  const [cx, cy] = centroid(deco.vertices)
  const bb = boundingBox(deco.vertices)
  const size = Math.min(bb.w, bb.h)
  // A labelled circulation node lifts its icon so the name sits underneath it.
  const hasLabel = !!deco.label && bb.w >= 4 && bb.h >= 3
  const iconCy = circulation && hasLabel ? cy - size * 0.16 : cy
  return (
    <g>
      <polygon
        points={polygonPoints(deco.vertices)}
        className={cn(muted ? 'fill-muted/40' : 'fill-muted/70', 'stroke-border')}
        strokeWidth={0.2}
      />
      {circulation && bb.w >= 3 && bb.h >= 3 && (
        <DecorationIcon kind={deco.kind} cx={cx} cy={iconCy} size={size} />
      )}
      {/* Halls/lobbies show text only when the user names them (blank otherwise,
          so merged shapes stay unnamed); circulation nodes tuck the name below
          their icon. */}
      {hasLabel && (
        <text
          x={cx}
          y={circulation ? cy + size * 0.32 : cy}
          className="fill-muted-foreground select-none"
          fontSize={circulation ? 2 : 2.4}
          textAnchor="middle"
          dominantBaseline="central"
        >
          {deco.label}
        </text>
      )}
    </g>
  )
}

export function RoomShape({
  vertices,
  status,
  roomNumber,
  selected = false,
  interactive = false,
  onPointerDown,
}: {
  vertices: Polygon
  status: RoomStatus
  roomNumber: string
  selected?: boolean
  interactive?: boolean
  onPointerDown?: (e: React.PointerEvent) => void
}) {
  const [cx, cy] = centroid(vertices)
  const bb = boundingBox(vertices)
  const fontSize = Math.max(2, Math.min(bb.w, bb.h) * 0.28)
  return (
    <g
      onPointerDown={onPointerDown}
      className={interactive ? 'cursor-grab' : undefined}
      role={interactive ? 'button' : undefined}
      aria-label={interactive ? `Room ${roomNumber} – ${status}` : undefined}
    >
      <polygon
        points={polygonPoints(vertices)}
        className={cn(
          STATUS_FILL[status],
          selected ? 'stroke-foreground' : STATUS_STROKE[status],
        )}
        strokeWidth={selected ? 0.6 : 0.3}
      />
      {/* Room number stays upright at the centroid, legible at any rotation. */}
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

// A convenience re-export so callers can build a default rectangle footprint.
export { rectVertices }
