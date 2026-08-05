import { useRef, useState } from 'react'

import type { FloorMap, MapRoom } from '@/lib/api/types'
import { cn } from '@/lib/utils'

import type { ZoneMap } from './assign'
import {
  DecorationShape,
  FloorBackdrop,
  HallBorders,
  paddedViewBox,
} from './canvas-parts'
import { pointerToSvg } from './svg-coords'
import { zoneColor } from './zone-colors'

const DEFAULT_W = 120
const DEFAULT_H = 60

// A room is a cleaning candidate (and thus assignable) when it's dirty AND
// doesn't already carry a live task — assigning it again would double-task it.
export function isCandidate(room: MapRoom): boolean {
  return room.status === 'dirty' && !room.has_open_task
}

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/** Rooms whose center falls inside the (feet) rectangle. */
function roomsInRect(rooms: MapRoom[], rect: Rect): string[] {
  const ids: string[] = []
  for (const room of rooms) {
    const p = room.placement
    if (!p) continue
    const cx = p.x + p.w / 2
    const cy = p.y + p.h / 2
    if (cx >= rect.x && cx <= rect.x + rect.w && cy >= rect.y && cy <= rect.y + rect.h) {
      ids.push(room.id)
    }
  }
  return ids
}

/**
 * Assignment-mode canvas. Dirty rooms are cleaning candidates. Assignment works
 * both directions: pick a housekeeper first and tap/lasso to paint their zone
 * directly, or (with no housekeeper active) tap/lasso to build a pending
 * selection, then pick a housekeeper to assign the lot. Assigned rooms take their
 * housekeeper's zone color; selected-but-unassigned rooms get a solid ring;
 * unassigned candidates show a dashed "needs assigning" outline; non-candidate
 * rooms are dimmed context only. Geometry is integer feet; the viewBox is in feet
 * so it scales crisply. Interaction is gated by `interactive`.
 */
export function FloorAssignCanvas({
  floor,
  zones,
  colorIndexByHk,
  selectedRoomIds,
  interactive,
  onRoomTap,
  onLasso,
}: {
  floor: FloorMap
  zones: ZoneMap
  colorIndexByHk: Record<string, number>
  selectedRoomIds: Set<string>
  interactive: boolean
  onRoomTap: (roomId: string) => void
  onLasso: (roomIds: string[]) => void
}) {
  const width = floor.width_ft ?? DEFAULT_W
  const height = floor.height_ft ?? DEFAULT_H
  const svgRef = useRef<SVGSVGElement>(null)
  const lassoStart = useRef<{ x: number; y: number } | null>(null)
  const [lasso, setLasso] = useState<Rect | null>(null)

  function at(e: React.PointerEvent) {
    return pointerToSvg(svgRef.current!, e.clientX, e.clientY)
  }

  function onCanvasPointerDown(e: React.PointerEvent) {
    if (!interactive) return
    const { x, y } = at(e)
    lassoStart.current = { x, y }
    setLasso({ x, y, w: 0, h: 0 })
    svgRef.current?.setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: React.PointerEvent) {
    const start = lassoStart.current
    if (!start) return
    const { x, y } = at(e)
    setLasso({
      x: Math.min(start.x, x),
      y: Math.min(start.y, y),
      w: Math.abs(x - start.x),
      h: Math.abs(y - start.y),
    })
  }

  function onPointerUp(e: React.PointerEvent) {
    const start = lassoStart.current
    lassoStart.current = null
    svgRef.current?.releasePointerCapture(e.pointerId)
    const rect = lasso
    setLasso(null)
    if (!start || !rect) return
    // A negligible drag is a tap on empty floor — ignore it (no rooms selected).
    if (rect.w < 1 && rect.h < 1) return
    const ids = roomsInRect(floor.rooms.filter(isCandidate), rect)
    if (ids.length > 0) onLasso(ids)
  }

  return (
    <svg
      ref={svgRef}
      viewBox={paddedViewBox(width, height)}
      preserveAspectRatio="xMidYMid meet"
      className="bg-muted/20 h-auto w-full touch-none rounded-lg border"
      role="img"
      aria-label="Assignment map"
      onPointerDown={onCanvasPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <FloorBackdrop width={width} height={height} />

      {floor.decorations.map((deco) => (
        <DecorationShape key={deco.id} deco={deco} />
      ))}
      <HallBorders decorations={floor.decorations} />

      {floor.rooms.map((room) => {
        if (!room.placement) return null
        const candidate = isCandidate(room)
        const hkId = zones[room.id]
        const color =
          hkId !== undefined ? zoneColor(colorIndexByHk[hkId] ?? 0) : null
        return (
          <AssignRoomRect
            key={room.id}
            room={room}
            candidate={candidate}
            fill={color?.fill}
            stroke={color?.stroke}
            selected={selectedRoomIds.has(room.id)}
            interactive={interactive && candidate}
            onPointerDown={
              interactive && candidate
                ? (e) => {
                    e.stopPropagation()
                    onRoomTap(room.id)
                  }
                : undefined
            }
          />
        )
      })}

      {lasso && (
        <rect
          x={lasso.x}
          y={lasso.y}
          width={lasso.w}
          height={lasso.h}
          className="fill-primary/10 stroke-primary"
          strokeWidth={0.3}
          strokeDasharray="1 1"
        />
      )}
    </svg>
  )
}

function AssignRoomRect({
  room,
  candidate,
  fill,
  stroke,
  selected,
  interactive,
  onPointerDown,
}: {
  room: MapRoom
  candidate: boolean
  fill?: string
  stroke?: string
  selected: boolean
  interactive: boolean
  onPointerDown?: (e: React.PointerEvent) => void
}) {
  const p = room.placement!
  const cx = p.x + p.w / 2
  const cy = p.y + p.h / 2
  const fontSize = Math.max(2, Math.min(p.w, p.h) * 0.28)
  const assigned = !!fill

  return (
    <g
      transform={p.rotation ? `rotate(${p.rotation} ${cx} ${cy})` : undefined}
      onPointerDown={onPointerDown}
      className={interactive ? 'cursor-pointer' : undefined}
      role={interactive ? 'button' : undefined}
      aria-label={
        candidate
          ? `Room ${room.room_number} – ${assigned ? 'assigned' : selected ? 'selected' : 'unassigned'}`
          : undefined
      }
    >
      <rect
        x={p.x}
        y={p.y}
        width={p.w}
        height={p.h}
        rx={0.75}
        className={cn(
          assigned
            ? cn(fill, stroke)
            : candidate
              ? 'fill-amber-100 stroke-amber-400 dark:fill-amber-900/30 dark:stroke-amber-600'
              : 'fill-muted/40 stroke-border',
        )}
        strokeWidth={assigned ? 0.5 : 0.3}
        strokeDasharray={candidate && !assigned && !selected ? '1.2 1' : undefined}
        opacity={candidate ? 1 : 0.5}
      />
      {/* Pending-selection ring — overlays any base style so it reads whether the
          room is still unassigned or is being moved from another housekeeper. */}
      {selected && (
        <rect
          x={p.x}
          y={p.y}
          width={p.w}
          height={p.h}
          rx={0.75}
          className="fill-none stroke-primary"
          strokeWidth={0.8}
        />
      )}
      <text
        x={cx}
        y={cy}
        className={cn(
          'select-none',
          candidate ? 'fill-zinc-800 dark:fill-zinc-100' : 'fill-muted-foreground',
        )}
        fontSize={fontSize}
        textAnchor="middle"
        dominantBaseline="central"
      >
        {room.room_number}
      </text>
    </g>
  )
}
