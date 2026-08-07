import { useMemo, useState } from 'react'

import {
  type DecorationKind,
  type DoorRef,
  type FloorMap,
  type FloorMapWrite,
  type MapRoom,
  type Polygon,
  type Vertex,
  isMergeableKind,
} from '@/lib/api/types'

import {
  boundingBox,
  lineIntersection,
  polygonsOverlap,
  rectVertices,
  rotatePolygon,
  roundPolygon,
  roundVertex,
  translate,
  unionPolygons,
} from './geometry'
import { clamp } from './svg-coords'

const DEFAULT_W = 120
const DEFAULT_H = 60
const DEFAULT_ROOM_W = 12
const DEFAULT_ROOM_H = 16
const MIN_FLOOR = 20

// Default footprint (feet) when a decoration is added from the palette. Labels
// are a single anchor point, so they have no footprint here.
const DECO_DEFAULTS: Record<DecorationKind, { w: number; h: number }> = {
  hall: { w: 40, h: 6 },
  stairs: { w: 8, h: 10 },
  elevator: { w: 8, h: 8 },
  lobby: { w: 20, h: 16 },
  label: { w: 0, h: 0 },
}

export type ItemType = 'room' | 'deco' | 'outline'

export interface DraftPlacement {
  vertices: Polygon
  door: DoorRef | null
}

export interface DraftDecoration {
  key: string // stable local id for React + selection
  serverId: string | null // real id if it exists on the server, else null (new)
  kind: DecorationKind
  vertices: Polygon
  label: string | null
}

export interface PlacedRoom {
  room: MapRoom
  placement: DraftPlacement
}

interface Draft {
  width: number
  height: number
  outline: Polygon | null
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
    if (room.placement) {
      placements[room.id] = {
        vertices: room.placement.vertices.map((p) => [...p] as Vertex),
        door: room.placement.door ? { ...room.placement.door } : null,
      }
    }
  }
  const decorations = floor.decorations.map((d) => ({
    key: d.id,
    serverId: d.id,
    kind: d.kind,
    vertices: d.vertices.map((p) => [...p] as Vertex),
    label: d.label,
  }))
  return {
    width: floor.width_ft ?? DEFAULT_W,
    height: floor.height_ft ?? DEFAULT_H,
    outline: floor.outline ? floor.outline.map((p) => [...p] as Vertex) : null,
    placements,
    decorations,
  }
}

function newKey(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `deco-${Math.random().toString(36).slice(2)}`
}

/** Translate a polygon so its bounding box sits within [0, W] × [0, H]. Bigger-
 *  than-floor shapes pin to the top-left corner. */
function clampToFloor(poly: Polygon, W: number, H: number): Polygon {
  const bb = boundingBox(poly)
  let dx = 0
  let dy = 0
  if (bb.minX < 0) dx = -bb.minX
  else if (bb.maxX > W) dx = W - bb.maxX
  if (bb.minY < 0) dy = -bb.minY
  else if (bb.maxY > H) dy = H - bb.maxY
  return dx || dy ? translate(poly, dx, dy) : poly
}

function getItemVertices(d: Draft, type: ItemType, id: string): Polygon | null {
  if (type === 'room') return d.placements[id]?.vertices ?? null
  if (type === 'deco') return d.decorations.find((x) => x.key === id)?.vertices ?? null
  return d.outline
}

function setItemVertices(
  d: Draft,
  type: ItemType,
  id: string,
  vertices: Polygon,
): Draft {
  if (type === 'room') {
    const cur = d.placements[id]
    if (!cur) return d
    return { ...d, placements: { ...d.placements, [id]: { ...cur, vertices } } }
  }
  if (type === 'deco') {
    return {
      ...d,
      decorations: d.decorations.map((x) =>
        x.key === id ? { ...x, vertices } : x,
      ),
    }
  }
  return { ...d, outline: vertices }
}

/** Shapes that occupy area for overlap purposes — every placed room and every
 *  non-label decoration — as {key, vertices}. Labels (anchor points) and the floor
 *  outline are excluded: the outline bounds the floor, so everything sits "on" it. */
function areaShapes(d: Draft): Array<{ key: string; vertices: Polygon }> {
  const out: Array<{ key: string; vertices: Polygon }> = []
  for (const [id, p] of Object.entries(d.placements)) {
    out.push({ key: `room:${id}`, vertices: p.vertices })
  }
  for (const dec of d.decorations) {
    if (dec.kind !== 'label') out.push({ key: `deco:${dec.key}`, vertices: dec.vertices })
  }
  return out
}

/** Would placing item (type,id) at `candVerts` create an overlap it doesn't
 *  already have? Only *new* overlaps are blocked, so a shape can still be dragged
 *  free of one it already sits on (e.g. an older layout), and a rigid multi-drag
 *  ignores the shapes moving with it (`movingKeys`). Touching is fine —
 *  `polygonsOverlap` reads a shared boundary as non-overlapping, so rooms can sit
 *  wall to wall and stairs/elevators can butt against a hall. */
function createsNewOverlap(
  d: Draft,
  type: ItemType,
  id: string,
  candVerts: Polygon,
  movingKeys: Set<string>,
): boolean {
  if (type === 'outline' || candVerts.length < 3) return false
  // A label has no footprint, so it can go anywhere.
  if (type === 'deco' && d.decorations.find((x) => x.key === id)?.kind === 'label') {
    return false
  }
  const selfKey = `${type}:${id}`
  const before = getItemVertices(d, type, id)
  for (const shape of areaShapes(d)) {
    if (shape.key === selfKey || movingKeys.has(shape.key)) continue
    if (!polygonsOverlap(candVerts, shape.vertices)) continue
    if (!before || !polygonsOverlap(before, shape.vertices)) return true
  }
  return false
}

/**
 * Editable draft for one floor with undo history. Geometry is absolute polygons
 * (float feet); a rectangle is four right-angle vertices. Mutators change the
 * draft; `beginChange` snapshots the current draft onto the undo stack and should
 * be called once at the start of each user gesture (so one drag = one undo).
 * `buildPayload` produces the full-floor PUT body (rounded to 0.01 ft).
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

  function itemVertices(type: ItemType, id: string): Polygon | null {
    return getItemVertices(draft, type, id)
  }

  // --- Floor dimensions ---

  function setDimensions(nextW: number, nextH: number) {
    updateDraft((d) => {
      const width = Math.max(MIN_FLOOR, Math.round(nextW))
      const height = Math.max(MIN_FLOOR, Math.round(nextH))
      const placements: Record<string, DraftPlacement> = {}
      for (const [id, p] of Object.entries(d.placements)) {
        placements[id] = { ...p, vertices: clampToFloor(p.vertices, width, height) }
      }
      return {
        width,
        height,
        outline: d.outline ? clampToFloor(d.outline, width, height) : null,
        placements,
        decorations: d.decorations.map((dec) => ({
          ...dec,
          vertices: clampToFloor(dec.vertices, width, height),
        })),
      }
    })
  }

  // --- Rooms ---

  /** Default footprint a tap-to-place would drop at (x, y), clamped to the floor. */
  function placeVerts(d: Draft, x: number, y: number): Polygon {
    return clampToFloor(
      rectVertices(x - DEFAULT_ROOM_W / 2, y - DEFAULT_ROOM_H / 2, DEFAULT_ROOM_W, DEFAULT_ROOM_H),
      d.width,
      d.height,
    )
  }

  /** Whether a room could be dropped at (x, y) without landing on another object. */
  function canPlaceAt(roomId: string, x: number, y: number): boolean {
    if (!byId[roomId]) return false
    return !createsNewOverlap(
      draft,
      'room',
      roomId,
      placeVerts(draft, x, y),
      new Set([`room:${roomId}`]),
    )
  }

  /** Drop a room as a default rectangle. No-op (returns false) if it would overlap
   *  another object. */
  function placeAt(roomId: string, x: number, y: number): boolean {
    if (!byId[roomId]) return false
    if (createsNewOverlap(draft, 'room', roomId, placeVerts(draft, x, y), new Set([`room:${roomId}`])))
      return false
    updateDraft((d) => ({
      ...d,
      placements: { ...d.placements, [roomId]: { vertices: placeVerts(d, x, y), door: null } },
    }))
    return true
  }

  function unplace(roomId: string) {
    updateDraft((d) => {
      if (!d.placements[roomId]) return d
      const placements = { ...d.placements }
      delete placements[roomId]
      return { ...d, placements }
    })
  }

  function setDoor(roomId: string, door: DoorRef | null) {
    updateDraft((d) => {
      const cur = d.placements[roomId]
      if (!cur) return d
      return { ...d, placements: { ...d.placements, [roomId]: { ...cur, door } } }
    })
  }

  // --- Generic geometry ops (keyed by item type) ---

  /** Absolute move: replace each item's vertices, clamped to the floor. Rejects the
   *  whole update if any moved shape would newly overlap another object — so during
   *  a drag/rotate/resize the shape holds its last valid spot and only advances once
   *  the target is clear (it can still jump past an obstacle to open space). */
  function moveItems(
    updates: Array<{ type: ItemType; id: string; vertices: Polygon }>,
  ) {
    updateDraft((d) => {
      const movingKeys = new Set(updates.map((u) => `${u.type}:${u.id}`))
      const clamped = updates.map((u) => ({
        type: u.type,
        id: u.id,
        vertices: clampToFloor(u.vertices, d.width, d.height),
      }))
      if (
        clamped.some((u) => createsNewOverlap(d, u.type, u.id, u.vertices, movingKeys))
      ) {
        return d
      }
      let next = d
      for (const u of clamped) next = setItemVertices(next, u.type, u.id, u.vertices)
      return next
    })
  }

  function rotateItem(type: ItemType, id: string, deg: number, pivot?: Vertex) {
    updateDraft((d) => {
      const cur = getItemVertices(d, type, id)
      if (!cur || cur.length < 3) return d
      const rotated = clampToFloor(rotatePolygon(cur, deg, pivot), d.width, d.height)
      return setItemVertices(d, type, id, rotated)
    })
  }

  /** Move a single vertex (corner-stretch), clamped to the canvas. Won't apply a
   *  drag that would push the shape into another object. */
  function stretchVertex(type: ItemType, id: string, index: number, pt: Vertex) {
    updateDraft((d) => {
      const cur = getItemVertices(d, type, id)
      if (!cur || index < 0 || index >= cur.length) return d
      const v: Vertex = [clamp(pt[0], 0, d.width), clamp(pt[1], 0, d.height)]
      const next = cur.map((p, i) => (i === index ? v : p))
      if (createsNewOverlap(d, type, id, next, new Set([`${type}:${id}`]))) return d
      return setItemVertices(d, type, id, next)
    })
  }

  /** Insert a new vertex just after `edgeIndex` (splits that edge). */
  function addVertexOnEdge(
    type: ItemType,
    id: string,
    edgeIndex: number,
    pt: Vertex,
  ) {
    updateDraft((d) => {
      const cur = getItemVertices(d, type, id)
      if (!cur) return d
      const v: Vertex = [clamp(pt[0], 0, d.width), clamp(pt[1], 0, d.height)]
      const next = [...cur.slice(0, edgeIndex + 1), v, ...cur.slice(edgeIndex + 1)]
      return setItemVertices(d, type, id, next)
    })
  }

  function removeVertex(type: ItemType, id: string, index: number) {
    updateDraft((d) => {
      const cur = getItemVertices(d, type, id)
      if (!cur || cur.length <= 3) return d
      return setItemVertices(
        d,
        type,
        id,
        cur.filter((_, i) => i !== index),
      )
    })
  }

  // --- Decorations ---

  function addDecoration(kind: DecorationKind): string {
    const key = newKey()
    updateDraft((d) => {
      const vertices: Polygon =
        kind === 'label'
          ? [[d.width / 2, d.height / 2]]
          : clampToFloor(
              rectVertices(
                d.width / 2 - DECO_DEFAULTS[kind].w / 2,
                d.height / 2 - DECO_DEFAULTS[kind].h / 2,
                DECO_DEFAULTS[kind].w,
                DECO_DEFAULTS[kind].h,
              ),
              d.width,
              d.height,
            )
      return {
        ...d,
        decorations: [
          ...d.decorations,
          { key, serverId: null, kind, vertices, label: null },
        ],
      }
    })
    return key
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

  /** Merge decorations (in `keys` order) into one shape by unioning along shared
   *  edges. Keeps the first decoration's id/kind/label; removes the rest. Only
   *  mergeable kinds (halls/lobbies) qualify — stairs/elevators stay independent.
   *  Returns the surviving key on success, or null if any pair doesn't line up. */
  function mergeDecorations(keys: string[]): string | null {
    if (keys.length < 2) return null
    const decos = keys
      .map((k) => draft.decorations.find((d) => d.key === k))
      .filter((d): d is DraftDecoration => !!d && isMergeableKind(d.kind))
    if (decos.length !== keys.length) return null
    let merged: Polygon | null = decos[0].vertices
    for (let i = 1; i < decos.length; i++) {
      merged = unionPolygons(merged, decos[i].vertices)
      if (!merged) return null
    }
    const survivor = decos[0].key
    const dropped = new Set(decos.slice(1).map((d) => d.key))
    const finalVerts = merged
    updateDraft((d) => ({
      ...d,
      decorations: d.decorations
        .filter((dec) => !dropped.has(dec.key))
        .map((dec) =>
          // Drop the inherited label so the merged shape starts unlabeled and the
          // user can name the combined space themselves.
          dec.key === survivor ? { ...dec, vertices: finalVerts, label: null } : dec,
        ),
    }))
    return survivor
  }

  /** Delete edge `edgeIndex` (between vertices i and i+1): remove both endpoints
   *  and rejoin the neighbouring edges where they meet (or at the deleted edge's
   *  midpoint if they're parallel). A polygon must keep at least 3 sides. */
  function deleteEdge(type: ItemType, id: string, edgeIndex: number) {
    updateDraft((d) => {
      const cur = getItemVertices(d, type, id)
      if (!cur || cur.length <= 3) return d
      const n = cur.length
      const i = edgeIndex
      const iNext = (i + 1) % n
      const prev = cur[(i - 1 + n) % n]
      const b = cur[i]
      const c = cur[iNext]
      const after = cur[(i + 2) % n]
      const mid: Vertex = [(b[0] + c[0]) / 2, (b[1] + c[1]) / 2]
      const inter = lineIntersection(prev, b, c, after)
      // Fall back to the midpoint if the neighbours are parallel or would meet
      // impractically far away.
      let joint = inter ?? mid
      if (
        inter &&
        Math.hypot(inter[0] - mid[0], inter[1] - mid[1]) >
          Math.max(d.width, d.height)
      ) {
        joint = mid
      }
      const clamped: Vertex = [
        clamp(joint[0], 0, d.width),
        clamp(joint[1], 0, d.height),
      ]
      const out: Polygon = []
      for (let k = 0; k < n; k++) {
        if (k === i) out.push(clamped)
        else if (k === iNext) continue
        else out.push(cur[k])
      }
      return setItemVertices(d, type, id, out)
    })
  }

  // --- Floor outline ---

  function initOutline() {
    updateDraft((d) => ({
      ...d,
      outline: d.outline ?? rectVertices(0, 0, d.width, d.height),
    }))
  }

  function clearOutline() {
    updateDraft((d) => ({ ...d, outline: null }))
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
      outline: draft.outline ? roundPolygon(draft.outline) : null,
      decorations: draft.decorations.map((d) => ({
        id: d.serverId,
        kind: d.kind,
        vertices: d.kind === 'label' ? d.vertices.map(roundVertex) : roundPolygon(d.vertices),
        label: d.label,
      })),
      placements: Object.entries(draft.placements).map(([room_id, p]) => ({
        room_id,
        vertices: roundPolygon(p.vertices),
        door: p.door ?? null,
      })),
    }
  }

  return {
    width: draft.width,
    height: draft.height,
    outline: draft.outline,
    grid,
    placements: draft.placements,
    placedRooms,
    unplacedRooms,
    decorations: draft.decorations,
    dirty,
    canUndo,
    beginChange,
    undo,
    itemVertices,
    setDimensions,
    canPlaceAt,
    placeAt,
    unplace,
    setDoor,
    moveItems,
    rotateItem,
    stretchVertex,
    addVertexOnEdge,
    removeVertex,
    deleteEdge,
    addDecoration,
    setDecorationLabel,
    removeDecoration,
    mergeDecorations,
    initOutline,
    clearOutline,
    reset,
    markSaved,
    buildPayload,
  }
}
