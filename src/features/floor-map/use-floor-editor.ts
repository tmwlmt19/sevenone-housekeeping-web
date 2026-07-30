import { useMemo, useState } from 'react'

import type { FloorMap, FloorMapWrite, MapRoom } from '@/lib/api/types'

import { clamp, snap } from './svg-coords'

// Fallbacks for a floor with rooms but no saved map yet, and the footprint a
// room takes when first dropped (feet).
const DEFAULT_W = 120
const DEFAULT_H = 60
const DEFAULT_ROOM_W = 12
const DEFAULT_ROOM_H = 16
const MIN_ROOM = 4

export interface DraftPlacement {
  x: number
  y: number
  w: number
  h: number
  rotation: number
}

export interface PlacedRoom {
  room: MapRoom
  placement: DraftPlacement
}

function initialPlacements(floor: FloorMap): Record<string, DraftPlacement> {
  const out: Record<string, DraftPlacement> = {}
  for (const room of floor.rooms) {
    if (room.placement) out[room.id] = { ...room.placement }
  }
  return out
}

/**
 * Editable draft for one floor. Holds a placement per placed room (keyed by room
 * id); place / move / unplace mutate the draft and snap+clamp geometry to the
 * grid and canvas. `buildPayload` produces the full-floor PUT body, carrying the
 * floor's existing decorations through unchanged (they aren't edited here yet).
 *
 * Mount the editor with `key={floor}` so switching floors re-seeds this state.
 */
export function useFloorEditor(floor: FloorMap) {
  const width = floor.width_ft ?? DEFAULT_W
  const height = floor.height_ft ?? DEFAULT_H
  const grid = floor.grid_ft || 1

  const [placements, setPlacements] = useState(() => initialPlacements(floor))
  const [dirty, setDirty] = useState(false)

  const byId = useMemo(() => {
    const m: Record<string, MapRoom> = {}
    for (const room of floor.rooms) m[room.id] = room
    return m
  }, [floor.rooms])

  const placedRooms: PlacedRoom[] = floor.rooms
    .filter((room) => placements[room.id])
    .map((room) => ({ room, placement: placements[room.id] }))

  const unplacedRooms: MapRoom[] = floor.rooms.filter(
    (room) => !placements[room.id],
  )

  /** Snap + clamp a top-left corner so a w×h footprint stays on the canvas. */
  function fit(x: number, y: number, w: number, h: number) {
    return {
      x: clamp(snap(x, grid), 0, Math.max(0, width - w)),
      y: clamp(snap(y, grid), 0, Math.max(0, height - h)),
    }
  }

  function placeAt(roomId: string, x: number, y: number) {
    if (!byId[roomId]) return
    const w = DEFAULT_ROOM_W
    const h = DEFAULT_ROOM_H
    const pos = fit(x - w / 2, y - h / 2, w, h)
    setPlacements((prev) => ({
      ...prev,
      [roomId]: { ...pos, w, h, rotation: 0 },
    }))
    setDirty(true)
  }

  function move(roomId: string, x: number, y: number) {
    setPlacements((prev) => {
      const cur = prev[roomId]
      if (!cur) return prev
      const pos = fit(x, y, cur.w, cur.h)
      return { ...prev, [roomId]: { ...cur, ...pos } }
    })
    setDirty(true)
  }

  /** Resize keeps the top-left fixed; clamps within the canvas and a min size. */
  function resize(roomId: string, w: number, h: number) {
    setPlacements((prev) => {
      const cur = prev[roomId]
      if (!cur) return prev
      const nw = clamp(snap(w, grid), MIN_ROOM, Math.max(MIN_ROOM, width - cur.x))
      const nh = clamp(snap(h, grid), MIN_ROOM, Math.max(MIN_ROOM, height - cur.y))
      return { ...prev, [roomId]: { ...cur, w: nw, h: nh } }
    })
    setDirty(true)
  }

  /** Rotate 90° at a time; re-center so the rotated footprint stays on canvas. */
  function rotate(roomId: string) {
    setPlacements((prev) => {
      const cur = prev[roomId]
      if (!cur) return prev
      const rotation = (cur.rotation + 90) % 360
      const sideways = rotation % 180 === 90
      const effW = sideways ? cur.h : cur.w
      const effH = sideways ? cur.w : cur.h
      const cx = clamp(
        cur.x + cur.w / 2,
        effW / 2,
        Math.max(effW / 2, width - effW / 2),
      )
      const cy = clamp(
        cur.y + cur.h / 2,
        effH / 2,
        Math.max(effH / 2, height - effH / 2),
      )
      return {
        ...prev,
        [roomId]: {
          ...cur,
          rotation,
          x: snap(cx - cur.w / 2, grid),
          y: snap(cy - cur.h / 2, grid),
        },
      }
    })
    setDirty(true)
  }

  function unplace(roomId: string) {
    setPlacements((prev) => {
      if (!prev[roomId]) return prev
      const next = { ...prev }
      delete next[roomId]
      return next
    })
    setDirty(true)
  }

  function reset() {
    setPlacements(initialPlacements(floor))
    setDirty(false)
  }

  function markSaved() {
    setDirty(false)
  }

  function buildPayload(): FloorMapWrite {
    return {
      name: floor.name,
      width_ft: width,
      height_ft: height,
      grid_ft: grid,
      decorations: floor.decorations.map((d) => ({
        id: d.id,
        kind: d.kind,
        x: d.x,
        y: d.y,
        w: d.w,
        h: d.h,
        label: d.label,
      })),
      placements: Object.entries(placements).map(([room_id, p]) => ({
        room_id,
        x: p.x,
        y: p.y,
        w: p.w,
        h: p.h,
        rotation: p.rotation,
      })),
    }
  }

  return {
    width,
    height,
    placements,
    placedRooms,
    unplacedRooms,
    dirty,
    placeAt,
    move,
    resize,
    rotate,
    unplace,
    reset,
    markSaved,
    buildPayload,
  }
}
