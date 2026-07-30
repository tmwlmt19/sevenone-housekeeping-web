import { useMemo, useState } from 'react'

import type {
  DecorationKind,
  FloorMap,
  FloorMapWrite,
  MapRoom,
} from '@/lib/api/types'

import { clamp, snap } from './svg-coords'

const DEFAULT_W = 120
const DEFAULT_H = 60
const DEFAULT_ROOM_W = 12
const DEFAULT_ROOM_H = 16
const MIN_ROOM = 4
const MIN_DECO = 2
const MIN_FLOOR = 20

// Default footprint (feet) when a decoration is added from the palette. Labels
// get a small footprint too, so they have a hit area to select/drag.
const DECO_DEFAULTS: Record<DecorationKind, { w: number; h: number }> = {
  hall: { w: 40, h: 6 },
  stairs: { w: 8, h: 10 },
  elevator: { w: 8, h: 8 },
  lobby: { w: 20, h: 16 },
  label: { w: 24, h: 5 },
}

export type ItemType = 'room' | 'deco'

export interface DraftPlacement {
  x: number
  y: number
  w: number
  h: number
  rotation: number
}

export interface DraftDecoration {
  key: string // stable local id for React + selection
  serverId: string | null // real id if it exists on the server, else null (new)
  kind: DecorationKind
  x: number
  y: number
  w: number
  h: number
  label: string | null
}

export interface PlacedRoom {
  room: MapRoom
  placement: DraftPlacement
}

interface Draft {
  width: number
  height: number
  placements: Record<string, DraftPlacement>
  decorations: DraftDecoration[]
}

interface History {
  draft: Draft // the working layout
  baseline: Draft // last saved (or initial) layout — the Reset target
  past: Draft[] // undo stack (one entry per gesture)
}

function initialDraft(floor: FloorMap): Draft {
  const placements: Record<string, DraftPlacement> = {}
  for (const room of floor.rooms) {
    if (room.placement) placements[room.id] = { ...room.placement }
  }
  const decorations = floor.decorations.map((d) => {
    const def = DECO_DEFAULTS[d.kind]
    return {
      key: d.id,
      serverId: d.id,
      kind: d.kind,
      x: d.x,
      y: d.y,
      // Fall back to a usable footprint for legacy zero-size decorations.
      w: d.w || def.w,
      h: d.h || def.h,
      label: d.label,
    }
  })
  return {
    width: floor.width_ft ?? DEFAULT_W,
    height: floor.height_ft ?? DEFAULT_H,
    placements,
    decorations,
  }
}

function newKey(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `deco-${Math.random().toString(36).slice(2)}`
}

/**
 * Editable draft for one floor with undo history. Mutators change the draft;
 * `beginChange` snapshots the current draft onto the undo stack and should be
 * called once at the start of each user gesture (so one drag = one undo). Reset
 * returns to the last-saved baseline; markSaved makes the current draft the new
 * baseline. `buildPayload` produces the full-floor PUT body.
 *
 * Mount the editor with `key={floor}` so switching floors re-seeds this state.
 */
export function useFloorEditor(floor: FloorMap) {
  const grid = floor.grid_ft || 1

  const [hist, setHist] = useState<History>(() => {
    const draft = initialDraft(floor)
    return { draft, baseline: draft, past: [] }
  })

  const { draft } = hist
  const dirty = draft !== hist.baseline
  const canUndo = hist.past.length > 0

  const byId = useMemo(() => {
    const m: Record<string, MapRoom> = {}
    for (const room of floor.rooms) m[room.id] = room
    return m
  }, [floor.rooms])

  const placedRooms: PlacedRoom[] = floor.rooms
    .filter((room) => draft.placements[room.id])
    .map((room) => ({ room, placement: draft.placements[room.id] }))
  const unplacedRooms: MapRoom[] = floor.rooms.filter(
    (room) => !draft.placements[room.id],
  )

  /** Snap + clamp a top-left corner so a w×h footprint stays on the floor. */
  function fitIn(W: number, H: number, x: number, y: number, w: number, h: number) {
    return {
      x: clamp(snap(x, grid), 0, Math.max(0, W - w)),
      y: clamp(snap(y, grid), 0, Math.max(0, H - h)),
    }
  }

  function updateDraft(fn: (d: Draft) => Draft) {
    setHist((s) => ({ ...s, draft: fn(s.draft) }))
  }

  /** Snapshot the current draft for undo — call once per gesture, before edits. */
  function beginChange() {
    setHist((s) => ({ ...s, past: [...s.past, s.draft] }))
  }

  function undo() {
    setHist((s) =>
      s.past.length === 0
        ? s
        : { ...s, draft: s.past[s.past.length - 1], past: s.past.slice(0, -1) },
    )
  }

  // --- Floor dimensions ---

  function setDimensions(nextW: number, nextH: number) {
    updateDraft((d) => {
      const width = Math.max(MIN_FLOOR, Math.round(nextW))
      const height = Math.max(MIN_FLOOR, Math.round(nextH))
      const clampItem = <T extends { x: number; y: number; w: number; h: number }>(
        it: T,
      ): T => {
        const w = Math.min(it.w, width)
        const h = Math.min(it.h, height)
        return {
          ...it,
          w,
          h,
          x: clamp(it.x, 0, width - w),
          y: clamp(it.y, 0, height - h),
        }
      }
      const placements: Record<string, DraftPlacement> = {}
      for (const [id, p] of Object.entries(d.placements)) {
        placements[id] = clampItem(p)
      }
      return {
        width,
        height,
        placements,
        decorations: d.decorations.map(clampItem),
      }
    })
  }

  // --- Rooms ---

  function placeAt(roomId: string, x: number, y: number) {
    if (!byId[roomId]) return
    const w = DEFAULT_ROOM_W
    const h = DEFAULT_ROOM_H
    updateDraft((d) => ({
      ...d,
      placements: {
        ...d.placements,
        [roomId]: {
          ...fitIn(d.width, d.height, x - w / 2, y - h / 2, w, h),
          w,
          h,
          rotation: 0,
        },
      },
    }))
  }

  function move(roomId: string, x: number, y: number) {
    updateDraft((d) => {
      const cur = d.placements[roomId]
      if (!cur) return d
      const pos = fitIn(d.width, d.height, x, y, cur.w, cur.h)
      return { ...d, placements: { ...d.placements, [roomId]: { ...cur, ...pos } } }
    })
  }

  function resize(roomId: string, w: number, h: number) {
    updateDraft((d) => {
      const cur = d.placements[roomId]
      if (!cur) return d
      const nw = clamp(snap(w, grid), MIN_ROOM, Math.max(MIN_ROOM, d.width - cur.x))
      const nh = clamp(snap(h, grid), MIN_ROOM, Math.max(MIN_ROOM, d.height - cur.y))
      return { ...d, placements: { ...d.placements, [roomId]: { ...cur, w: nw, h: nh } } }
    })
  }

  function rotate(roomId: string) {
    updateDraft((d) => {
      const cur = d.placements[roomId]
      if (!cur) return d
      const rotation = (cur.rotation + 90) % 360
      const sideways = rotation % 180 === 90
      const effW = sideways ? cur.h : cur.w
      const effH = sideways ? cur.w : cur.h
      const cx = clamp(cur.x + cur.w / 2, effW / 2, Math.max(effW / 2, d.width - effW / 2))
      const cy = clamp(cur.y + cur.h / 2, effH / 2, Math.max(effH / 2, d.height - effH / 2))
      return {
        ...d,
        placements: {
          ...d.placements,
          [roomId]: {
            ...cur,
            rotation,
            x: snap(cx - cur.w / 2, grid),
            y: snap(cy - cur.h / 2, grid),
          },
        },
      }
    })
  }

  function unplace(roomId: string) {
    updateDraft((d) => {
      if (!d.placements[roomId]) return d
      const placements = { ...d.placements }
      delete placements[roomId]
      return { ...d, placements }
    })
  }

  // --- Decorations ---

  function addDecoration(kind: DecorationKind): string {
    const { w, h } = DECO_DEFAULTS[kind]
    const key = newKey()
    updateDraft((d) => ({
      ...d,
      decorations: [
        ...d.decorations,
        {
          key,
          serverId: null,
          kind,
          ...fitIn(d.width, d.height, d.width / 2 - w / 2, d.height / 2 - h / 2, w, h),
          w,
          h,
          label: null,
        },
      ],
    }))
    return key
  }

  function moveDecoration(key: string, x: number, y: number) {
    updateDraft((d) => ({
      ...d,
      decorations: d.decorations.map((dec) =>
        dec.key === key
          ? { ...dec, ...fitIn(d.width, d.height, x, y, dec.w, dec.h) }
          : dec,
      ),
    }))
  }

  function resizeDecoration(key: string, w: number, h: number) {
    updateDraft((d) => ({
      ...d,
      decorations: d.decorations.map((dec) => {
        if (dec.key !== key) return dec
        const nw = clamp(snap(w, grid), MIN_DECO, Math.max(MIN_DECO, d.width - dec.x))
        const nh = clamp(snap(h, grid), MIN_DECO, Math.max(MIN_DECO, d.height - dec.y))
        return { ...dec, w: nw, h: nh }
      }),
    }))
  }

  function setDecorationLabel(key: string, label: string) {
    updateDraft((d) => ({
      ...d,
      decorations: d.decorations.map((dec) =>
        dec.key === key ? { ...dec, label: label || null } : dec,
      ),
    }))
  }

  function removeDecoration(key: string) {
    updateDraft((d) => ({
      ...d,
      decorations: d.decorations.filter((dec) => dec.key !== key),
    }))
  }

  /** Batch absolute move (already-snapped positions) — for group drag + nudge. */
  function moveItemsTo(
    updates: Array<{ type: ItemType; id: string; x: number; y: number }>,
  ) {
    updateDraft((d) => {
      const placements = { ...d.placements }
      const decorations = [...d.decorations]
      for (const u of updates) {
        if (u.type === 'room') {
          const cur = placements[u.id]
          if (!cur) continue
          placements[u.id] = {
            ...cur,
            x: clamp(u.x, 0, Math.max(0, d.width - cur.w)),
            y: clamp(u.y, 0, Math.max(0, d.height - cur.h)),
          }
        } else {
          const i = decorations.findIndex((dec) => dec.key === u.id)
          if (i < 0) continue
          const cur = decorations[i]
          decorations[i] = {
            ...cur,
            x: clamp(u.x, 0, Math.max(0, d.width - cur.w)),
            y: clamp(u.y, 0, Math.max(0, d.height - cur.h)),
          }
        }
      }
      return { ...d, placements, decorations }
    })
  }

  function reset() {
    setHist((s) => ({ ...s, draft: s.baseline, past: [] }))
  }

  function markSaved() {
    setHist((s) => ({ draft: s.draft, baseline: s.draft, past: [] }))
  }

  function buildPayload(): FloorMapWrite {
    return {
      name: floor.name,
      width_ft: draft.width,
      height_ft: draft.height,
      grid_ft: grid,
      decorations: draft.decorations.map((d) => ({
        id: d.serverId,
        kind: d.kind,
        x: d.x,
        y: d.y,
        w: d.w,
        h: d.h,
        label: d.label,
      })),
      placements: Object.entries(draft.placements).map(([room_id, p]) => ({
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
    width: draft.width,
    height: draft.height,
    grid,
    placements: draft.placements,
    placedRooms,
    unplacedRooms,
    decorations: draft.decorations,
    dirty,
    canUndo,
    beginChange,
    undo,
    setDimensions,
    placeAt,
    move,
    resize,
    rotate,
    unplace,
    addDecoration,
    moveDecoration,
    resizeDecoration,
    setDecorationLabel,
    removeDecoration,
    moveItemsTo,
    reset,
    markSaved,
    buildPayload,
  }
}
