import { RotateCcw, RotateCw, Save, Trash2, Undo2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DECORATION_KINDS,
  type FloorMap,
  type FloorMapWrite,
  isMergeableKind,
  type Polygon,
  type Vertex,
} from '@/lib/api/types'
import { cn } from '@/lib/utils'

import {
  DecorationShape,
  FloorBackdrop,
  paddedViewBox,
  polygonPoints,
  RoomShape,
} from './canvas-parts'
import {
  boundingBox,
  centroid,
  doorSegment,
  edgeLengths,
  edgeOrientationDeg,
  internalAngles,
  nearestEdge,
  pointInPolygon,
  rotatePoint,
  rotatePolygon,
  sharedEdge,
  snapAngle,
  snapVertexToNeighbors,
  translate,
  unionPolygons,
} from './geometry'
import { pointerToSvg, snap } from './svg-coords'
import { type ItemType, useFloorEditor } from './use-floor-editor'

type Selected = Set<string> // keys: `room:<id>` / `deco:<key>` / `outline:floor`
const OUTLINE_ID = 'floor'
const SNAP_TOL = 1.5 // ft — Shift-snap radius for corner-to-corner alignment
const ROT_SNAP = 15 // degrees

const selKey = (type: ItemType, id: string) => `${type}:${id}`
function splitKey(key: string): [ItemType, string] {
  const i = key.indexOf(':')
  return [key.slice(0, i) as ItemType, key.slice(i + 1)]
}

/** The object's own frame: its rotation (from the baseline edge), its centroid
 *  pivot, and its bounding box measured in that un-rotated frame. Handles + resize
 *  work in this frame so they stay attached to the object and follow its length/
 *  width axes rather than the world's. */
function localFrame(vertices: Polygon) {
  const angle = edgeOrientationDeg(vertices)
  const pivot = centroid(vertices)
  const local = rotatePolygon(vertices, -angle, pivot)
  const lbb = boundingBox(local)
  return { angle, pivot, local, lbb }
}

/** Number field for a floor dimension: commits on blur / Enter, not per keystroke. */
function FloorSizeField({
  label,
  value,
  onCommit,
}: {
  label: string
  value: number
  onCommit: (n: number) => void
}) {
  const [text, setText] = useState(String(value))
  useEffect(() => setText(String(value)), [value])
  function commit() {
    const n = parseInt(text, 10)
    if (Number.isFinite(n) && n > 0) onCommit(n)
    else setText(String(value))
  }
  return (
    <label className="text-muted-foreground flex items-center gap-1 text-xs">
      {label}
      <Input
        type="number"
        inputMode="numeric"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
        }}
        className="h-8 w-20"
      />
    </label>
  )
}

/** Editing affordances for the single selected shape. In `simple` mode there's one
 *  corner resize handle (widen/lengthen); in `vertex` mode every corner is
 *  draggable and edges gain add/remove. Length + angle labels are optional and are
 *  placed off the shape (lengths just outside each edge, angles just inside each
 *  corner) so they don't touch the sides. */
function ShapeOverlay({
  vertices,
  mode,
  showRotation,
  showLengths,
  showAngles,
  onVertexDown,
  onVertexDoubleClick,
  onRotateDown,
  onResizeDown,
}: {
  vertices: Polygon
  mode: 'simple' | 'vertex'
  showRotation: boolean
  showLengths: boolean
  showAngles: boolean
  onVertexDown: (e: React.PointerEvent, index: number) => void
  onVertexDoubleClick: (index: number) => void
  onRotateDown: (e: React.PointerEvent) => void
  onResizeDown?: (e: React.PointerEvent) => void
}) {
  const { t } = useTranslation()
  const [cx, cy] = centroid(vertices)
  // Handles live in the object's own frame so they stay attached as it rotates.
  const { angle, pivot, lbb } = localFrame(vertices)
  const midXLocal = (lbb.minX + lbb.maxX) / 2
  const topMid = rotatePoint([midXLocal, lbb.minY], angle, pivot)
  const knob = rotatePoint([midXLocal, lbb.minY - 6], angle, pivot)
  const resizeAt = rotatePoint([lbb.maxX, lbb.maxY], angle, pivot)
  const lengths = showLengths ? edgeLengths(vertices) : null
  const angles = showAngles ? internalAngles(vertices) : null
  const labelClass = 'pointer-events-none select-none [paint-order:stroke]'

  return (
    <g>
      {/* Edge-length labels, offset outward from each edge so they clear the side. */}
      {lengths?.map((len, i) => {
        const [x1, y1] = vertices[i]
        const [x2, y2] = vertices[(i + 1) % vertices.length]
        const mx = (x1 + x2) / 2
        const my = (y1 + y2) / 2
        const el = Math.hypot(x2 - x1, y2 - y1) || 1
        let nx = -(y2 - y1) / el
        let ny = (x2 - x1) / el
        if (nx * (cx - mx) + ny * (cy - my) > 0) {
          nx = -nx
          ny = -ny
        }
        return (
          <text
            key={`len${i}`}
            x={mx + nx * 2.6}
            y={my + ny * 2.6}
            className={cn(labelClass, 'fill-muted-foreground stroke-background')}
            strokeWidth={0.7}
            fontSize={2.2}
            textAnchor="middle"
            dominantBaseline="central"
          >
            {t('floorMap.feet', { value: Math.round(len) })}
          </text>
        )
      })}

      {/* Internal-angle labels, offset inward from each corner toward the centroid. */}
      {angles?.map((ang, i) => {
        const [x, y] = vertices[i]
        const dx = cx - x
        const dy = cy - y
        const d = Math.hypot(dx, dy) || 1
        const off = Math.min(4, d * 0.5)
        return (
          <text
            key={`ang${i}`}
            x={x + (dx / d) * off}
            y={y + (dy / d) * off}
            className={cn(labelClass, 'fill-foreground stroke-background')}
            strokeWidth={0.7}
            fontSize={2.3}
            fontWeight={600}
            textAnchor="middle"
            dominantBaseline="central"
          >
            {t('floorMap.degrees', { value: Math.round(ang) })}
          </text>
        )
      })}

      {/* Rotation knob (rooms + decorations, not the floor outline), attached to
          the object's top edge in its rotational plane. */}
      {showRotation && (
        <g>
          <line
            x1={topMid[0]}
            y1={topMid[1]}
            x2={knob[0]}
            y2={knob[1]}
            className="stroke-foreground/50"
            strokeWidth={0.25}
          />
          <circle
            cx={knob[0]}
            cy={knob[1]}
            r={1.6}
            className="fill-background stroke-foreground cursor-grab"
            strokeWidth={0.4}
            onPointerDown={onRotateDown}
          />
        </g>
      )}

      {mode === 'vertex'
        ? // Every corner draggable; double-click a handle removes that vertex.
          vertices.map(([x, y], i) => (
            <rect
              key={`vh${i}`}
              x={x - 1.25}
              y={y - 1.25}
              width={2.5}
              height={2.5}
              rx={0.4}
              className="fill-foreground stroke-background cursor-move"
              strokeWidth={0.3}
              onPointerDown={(e) => onVertexDown(e, i)}
              onDoubleClick={() => onVertexDoubleClick(i)}
            />
          ))
        : // Simple mode: one handle on the object's own bottom-right corner.
          onResizeDown && (
            <rect
              x={resizeAt[0] - 1.25}
              y={resizeAt[1] - 1.25}
              width={2.5}
              height={2.5}
              rx={0.4}
              className="fill-foreground stroke-background cursor-nwse-resize"
              strokeWidth={0.3}
              onPointerDown={onResizeDown}
            />
          )}
    </g>
  )
}

export function FloorMapEditor({
  floor,
  onSave,
  saving,
}: {
  floor: FloorMap
  onSave: (body: FloorMapWrite) => Promise<void>
  saving: boolean
}) {
  const { t } = useTranslation()
  const editor = useFloorEditor(floor)
  const svgRef = useRef<SVGSVGElement>(null)
  const dragRef = useRef<{
    items: Array<{ type: ItemType; id: string; start: Polygon }>
    px: number
    py: number
    pointerId: number
  } | null>(null)
  const stretchRef = useRef<{
    type: ItemType
    id: string
    index: number
    pointerId: number
  } | null>(null)
  const rotateRef = useRef<{
    type: ItemType
    id: string
    start: Polygon
    center: Vertex
    startAngle: number
    pointerId: number
  } | null>(null)
  const scaleRef = useRef<{
    type: ItemType
    id: string
    angle: number
    pivot: Vertex
    startLocal: Polygon
    anchorLocal: Vertex
    startW: number
    startH: number
    pointerId: number
  } | null>(null)
  const movedRef = useRef(false)
  const lastArrowRef = useRef(0)
  const [armed, setArmed] = useState<string | null>(null)
  const [placeBlocked, setPlaceBlocked] = useState(false)
  const [doorMode, setDoorMode] = useState(false)
  const [doorMoveMode, setDoorMoveMode] = useState(false)
  const [doorInvalid, setDoorInvalid] = useState(false)
  const [removeSideMode, setRemoveSideMode] = useState(false)
  const [selected, setSelected] = useState<Selected>(new Set())
  const [showLengths, setShowLengths] = useState(true)
  const [showAngles, setShowAngles] = useState(false)
  // Which shape (if any) is unlocked for per-corner editing; the floor outline is
  // always corner-editable. Everything else defaults to a single resize handle.
  const [vertexModeKey, setVertexModeKey] = useState<string | null>(null)
  const isVertexMode = (type: ItemType, id: string) =>
    type === 'outline' || vertexModeKey === selKey(type, id)

  const selectedKeys = [...selected]
  const single = selectedKeys.length === 1 ? splitKey(selectedKeys[0]) : null
  const selectedRoom =
    single?.[0] === 'room'
      ? (editor.placedRooms.find((p) => p.room.id === single[1]) ?? null)
      : null
  const selectedDeco =
    single?.[0] === 'deco'
      ? (editor.decorations.find((d) => d.key === single[1]) ?? null)
      : null
  const singleVertices = single ? editor.itemVertices(single[0], single[1]) : null
  const isShape = !!singleVertices && singleVertices.length >= 3

  // Selected decorations that could be unioned into one (share edges, in order).
  const selectedDecoKeys = selectedKeys
    .map(splitKey)
    .filter(([type]) => type === 'deco')
    .map(([, id]) => id)
  const mergePreview = (() => {
    if (selectedDecoKeys.length < 2) return null
    const polys = selectedDecoKeys.map((k) =>
      editor.decorations.find((d) => d.key === k),
    )
    // Only halls/lobbies union — stairs/elevators (and labels) stay independent.
    if (polys.some((d) => !d || !isMergeableKind(d.kind))) return null
    let acc: Polygon | null = polys[0]!.vertices
    for (let i = 1; i < polys.length; i++) {
      acc = unionPolygons(acc, polys[i]!.vertices)
      if (!acc) return null
    }
    return acc
  })()
  const sharedEdgeSeg =
    selectedDecoKeys.length === 2
      ? (() => {
          const a = editor.decorations.find((d) => d.key === selectedDecoKeys[0])
          const b = editor.decorations.find((d) => d.key === selectedDecoKeys[1])
          if (!a || !b) return null
          // Only hint "ready to merge" for shapes that actually can — a stairwell
          // touching a hall shares an edge but must stay its own shape.
          if (!isMergeableKind(a.kind) || !isMergeableKind(b.kind)) return null
          const s = sharedEdge(a.vertices, b.vertices)
          return s ? [a.vertices[s.i], a.vertices[(s.i + 1) % a.vertices.length]] : null
        })()
      : null

  function at(e: { clientX: number; clientY: number }): Vertex {
    const p = pointerToSvg(svgRef.current!, e.clientX, e.clientY)
    return [p.x, p.y]
  }

  /** All vertices of shapes other than (excludeType, excludeId) — Shift-snap targets. */
  function neighborVertices(excludeType: ItemType, excludeId: string): Vertex[] {
    const out: Vertex[] = []
    for (const { room, placement } of editor.placedRooms) {
      if (excludeType === 'room' && room.id === excludeId) continue
      out.push(...placement.vertices)
    }
    for (const d of editor.decorations) {
      if (excludeType === 'deco' && d.key === excludeId) continue
      out.push(...d.vertices)
    }
    if (editor.outline && !(excludeType === 'outline')) out.push(...editor.outline)
    return out
  }

  /** A door may only sit on a wall that borders another object. Probe just
   *  outside the edge and see whether it lands inside a decoration or another
   *  room. */
  function edgeBordersObject(
    roomVerts: Polygon,
    edgeIndex: number,
    point: Vertex,
    roomId: string,
  ): boolean {
    const n = roomVerts.length
    const a = roomVerts[edgeIndex]
    const b = roomVerts[(edgeIndex + 1) % n]
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
    let nx = -(b[1] - a[1]) / len
    let ny = (b[0] - a[0]) / len
    const [cx, cy] = centroid(roomVerts)
    if (nx * (cx - point[0]) + ny * (cy - point[1]) > 0) {
      nx = -nx
      ny = -ny
    }
    const probe: Vertex = [point[0] + nx * 0.75, point[1] + ny * 0.75]
    for (const d of editor.decorations) {
      if (d.kind !== 'label' && pointInPolygon(probe, d.vertices)) return true
    }
    for (const { room, placement } of editor.placedRooms) {
      if (room.id !== roomId && pointInPolygon(probe, placement.vertices)) return true
    }
    return false
  }

  function removeSelected() {
    if (selected.size === 0) return
    editor.beginChange()
    for (const key of selected) {
      const [type, id] = splitKey(key)
      if (type === 'room') editor.unplace(id)
      else if (type === 'deco') editor.removeDecoration(id)
    }
    setSelected(new Set())
    setVertexModeKey(null)
    setRemoveSideMode(false)
  }

  // Keyboard: Delete removes the selection; arrows nudge it by one grid step.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      // In "move door" mode, arrows slide the selected room's door along its wall.
      if (doorMoveMode) {
        const only = selected.size === 1 ? splitKey([...selected][0]) : null
        const placed =
          only?.[0] === 'room'
            ? editor.placedRooms.find((p) => p.room.id === only[1])
            : null
        const door = placed?.placement.door
        if (!door) return
        const dir =
          e.key === 'ArrowRight' || e.key === 'ArrowUp'
            ? 1
            : e.key === 'ArrowLeft' || e.key === 'ArrowDown'
              ? -1
              : 0
        if (dir === 0) return
        e.preventDefault()
        const v = placed!.placement.vertices
        const a = v[door.edge]
        const b = v[(door.edge + 1) % v.length]
        const edgeLen = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
        const now = Date.now()
        if (now - lastArrowRef.current > 400) editor.beginChange()
        lastArrowRef.current = now
        const t = Math.max(0, Math.min(1, door.t + (editor.grid / edgeLen) * dir))
        editor.setDoor(placed!.room.id, { edge: door.edge, t })
        return
      }
      if (selected.size === 0) return
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        editor.beginChange()
        for (const key of selected) {
          const [type, id] = splitKey(key)
          if (type === 'room') editor.unplace(id)
          else if (type === 'deco') editor.removeDecoration(id)
        }
        setSelected(new Set())
        setVertexModeKey(null)
        setRemoveSideMode(false)
        return
      }
      const step = editor.grid
      const delta =
        e.key === 'ArrowUp'
          ? [0, -step]
          : e.key === 'ArrowDown'
            ? [0, step]
            : e.key === 'ArrowLeft'
              ? [-step, 0]
              : e.key === 'ArrowRight'
                ? [step, 0]
                : null
      if (!delta) return
      e.preventDefault()
      const now = Date.now()
      if (now - lastArrowRef.current > 400) editor.beginChange()
      lastArrowRef.current = now
      const updates = [...selected]
        .map((key) => {
          const [type, id] = splitKey(key)
          const v = editor.itemVertices(type, id)
          return v ? { type, id, vertices: translate(v, delta[0], delta[1]) } : null
        })
        .filter((u) => u !== null)
      editor.moveItems(updates)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected, editor, doorMoveMode])

  // Turn off tool modes once they no longer apply (deselect, delete, door removed).
  useEffect(() => {
    const roomSel =
      single?.[0] === 'room'
        ? editor.placedRooms.find((p) => p.room.id === single[1])
        : null
    if ((doorMode || doorMoveMode) && !roomSel) {
      setDoorMode(false)
      setDoorMoveMode(false)
    }
    if (doorMoveMode && roomSel && !roomSel.placement.door) setDoorMoveMode(false)
    if (removeSideMode && !(single && isShape)) setRemoveSideMode(false)
  }, [single, isShape, editor, doorMode, doorMoveMode, removeSideMode])

  function onCanvasPointerDown(e: React.PointerEvent) {
    if (armed) {
      const [x, y] = at(e)
      // Don't drop a room on top of another object — keep the tool armed so they
      // can tap an open spot, and flag why nothing happened.
      if (!editor.canPlaceAt(armed, x, y)) {
        setPlaceBlocked(true)
        return
      }
      editor.beginChange()
      editor.placeAt(armed, x, y)
      setSelected(new Set([selKey('room', armed)]))
      setArmed(null)
      setPlaceBlocked(false)
      setRemoveSideMode(false)
    } else {
      setSelected(new Set())
      setVertexModeKey(null)
      setRemoveSideMode(false)
    }
  }

  function onItemPointerDown(e: React.PointerEvent, type: ItemType, id: string) {
    if (armed) return // let the click fall through to place the armed room
    e.stopPropagation()
    if ((doorMode || doorMoveMode) && type === 'room') {
      const verts = editor.itemVertices('room', id)
      setSelected(new Set([selKey('room', id)]))
      if (verts) {
        const { index, point, t } = nearestEdge(at(e), verts)
        if (edgeBordersObject(verts, index, point, id)) {
          editor.beginChange()
          editor.setDoor(id, { edge: index, t })
          setDoorInvalid(false)
          if (doorMode) setDoorMode(false) // one-shot placement; move mode stays
        } else {
          // Wall doesn't border anything — keep the tool active so they retry.
          setDoorInvalid(true)
        }
      }
      return
    }
    if (removeSideMode) {
      const v = editor.itemVertices(type, id)
      if (v && v.length > 3) {
        const { index } = nearestEdge(at(e), v)
        editor.beginChange()
        editor.deleteEdge(type, id, index)
      }
      setRemoveSideMode(false)
      setSelected(new Set([selKey(type, id)]))
      return
    }
    const key = selKey(type, id)
    if (e.shiftKey) {
      setVertexModeKey(null)
      setRemoveSideMode(false)
      setSelected((prev) => {
        const next = new Set(prev)
        if (next.has(key)) next.delete(key)
        else next.add(key)
        return next
      })
      return
    }
    // Selecting a different shape drops back to the single-corner (simple) mode.
    if (key !== vertexModeKey) setVertexModeKey(null)
    const dragKeys = selected.has(key) ? [...selected] : [key]
    if (!selected.has(key)) setSelected(new Set([key]))
    const items = dragKeys
      .map((k) => {
        const [tt, ii] = splitKey(k)
        const v = editor.itemVertices(tt, ii)
        return v ? { type: tt, id: ii, start: v.map((p) => [...p] as Vertex) } : null
      })
      .filter((it) => it !== null)
    const [x, y] = at(e)
    // Capture is deferred to the first move (see onPointerMove) so a plain click /
    // double-click still targets the shape rather than the captured <svg>.
    dragRef.current = { items, px: x, py: y, pointerId: e.pointerId }
    movedRef.current = false
  }

  function onItemDoubleClick(type: ItemType, id: string, e: React.MouseEvent) {
    // First double-click unlocks per-corner editing; once unlocked, double-click
    // an edge to add a point there.
    if (!isVertexMode(type, id)) {
      setSelected(new Set([selKey(type, id)]))
      setVertexModeKey(selKey(type, id))
      return
    }
    const v = editor.itemVertices(type, id)
    if (!v || v.length < 3) return
    const { index, point } = nearestEdge(at(e), v)
    editor.beginChange()
    editor.addVertexOnEdge(type, id, index, point)
  }

  function onResizeDown(e: React.PointerEvent, type: ItemType, id: string) {
    e.stopPropagation()
    const v = editor.itemVertices(type, id)
    if (!v) return
    const { angle, pivot, local, lbb } = localFrame(v)
    scaleRef.current = {
      type,
      id,
      angle,
      pivot,
      startLocal: local,
      anchorLocal: [lbb.minX, lbb.minY],
      startW: lbb.w || 1,
      startH: lbb.h || 1,
      pointerId: e.pointerId,
    }
    movedRef.current = false
  }

  function onVertexDown(e: React.PointerEvent, type: ItemType, id: string, index: number) {
    e.stopPropagation()
    stretchRef.current = { type, id, index, pointerId: e.pointerId }
    movedRef.current = false
  }

  function onRotateDown(e: React.PointerEvent, type: ItemType, id: string) {
    e.stopPropagation()
    const v = editor.itemVertices(type, id)
    if (!v) return
    const center = centroid(v)
    const [x, y] = at(e)
    const startAngle = (Math.atan2(y - center[1], x - center[0]) * 180) / Math.PI
    rotateRef.current = {
      type,
      id,
      start: v.map((p) => [...p] as Vertex),
      center,
      startAngle,
      pointerId: e.pointerId,
    }
    movedRef.current = false
  }

  function onPointerMove(e: React.PointerEvent) {
    const rz = stretchRef.current
    const rr = rotateRef.current
    const sc = scaleRef.current
    const dr = dragRef.current
    if (!rz && !rr && !sc && !dr) return
    const [x, y] = at(e)
    if (!movedRef.current) {
      editor.beginChange()
      movedRef.current = true
      // Capture only once a drag actually starts, so clicks/double-clicks still
      // reach the shape.
      const pid = sc?.pointerId ?? rr?.pointerId ?? rz?.pointerId ?? dr?.pointerId
      if (pid !== undefined) svgRef.current?.setPointerCapture(pid)
    }
    if (sc) {
      const MIN = 4
      // Resize in the object's own frame so it grows along its length/width axes.
      const lp = rotatePoint([x, y], -sc.angle, sc.pivot)
      const nx = Math.max(sc.anchorLocal[0] + MIN, snap(lp[0], editor.grid))
      const ny = Math.max(sc.anchorLocal[1] + MIN, snap(lp[1], editor.grid))
      const fx = (nx - sc.anchorLocal[0]) / sc.startW
      const fy = (ny - sc.anchorLocal[1]) / sc.startH
      const scaledLocal = sc.startLocal.map(
        ([px, py]) =>
          [
            sc.anchorLocal[0] + (px - sc.anchorLocal[0]) * fx,
            sc.anchorLocal[1] + (py - sc.anchorLocal[1]) * fy,
          ] as Vertex,
      )
      editor.moveItems([
        { type: sc.type, id: sc.id, vertices: rotatePolygon(scaledLocal, sc.angle, sc.pivot) },
      ])
      return
    }
    if (rz) {
      let pt: Vertex = [snap(x, editor.grid), snap(y, editor.grid)]
      if (e.shiftKey) pt = snapVertexToNeighbors(pt, neighborVertices(rz.type, rz.id), SNAP_TOL)
      editor.stretchVertex(rz.type, rz.id, rz.index, pt)
      return
    }
    if (rr) {
      const ang = (Math.atan2(y - rr.center[1], x - rr.center[0]) * 180) / Math.PI
      let delta = ang - rr.startAngle
      if (e.shiftKey) delta = snapAngle(delta, ROT_SNAP)
      editor.moveItems([
        { type: rr.type, id: rr.id, vertices: rotatePolygon(rr.start, delta, rr.center) },
      ])
      return
    }
    if (dr) {
      const sdx = snap(x - dr.px, editor.grid)
      const sdy = snap(y - dr.py, editor.grid)
      editor.moveItems(
        dr.items.map((it) => ({
          type: it.type,
          id: it.id,
          vertices: translate(it.start, sdx, sdy),
        })),
      )
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    if (
      dragRef.current ||
      stretchRef.current ||
      rotateRef.current ||
      scaleRef.current
    ) {
      if (svgRef.current?.hasPointerCapture(e.pointerId)) {
        svgRef.current.releasePointerCapture(e.pointerId)
      }
      dragRef.current = null
      stretchRef.current = null
      rotateRef.current = null
      scaleRef.current = null
    }
  }

  async function handleSave() {
    try {
      await onSave(editor.buildPayload())
      editor.markSaved()
    } catch {
      // Parent surfaces the error toast; keep the draft so nothing is lost.
    }
  }

  function doMerge() {
    editor.beginChange()
    const survivor = editor.mergeDecorations(selectedDecoKeys)
    if (survivor) setSelected(new Set([selKey('deco', survivor)]))
  }

  const rotationReadout =
    isShape && singleVertices
      ? t('floorMap.degrees', { value: Math.round(edgeOrientationDeg(singleVertices)) })
      : null

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={handleSave} disabled={!editor.dirty || saving}>
          <Save className="size-4" />
          {saving ? t('common.saving') : t('common.save')}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            editor.undo()
            setSelected(new Set())
            setVertexModeKey(null)
            setRemoveSideMode(false)
          }}
          disabled={!editor.canUndo || saving}
        >
          <Undo2 className="size-4" />
          {t('floorMap.undo')}
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="outline" disabled={!editor.dirty || saving}>
              <RotateCcw className="size-4" />
              {t('floorMap.reset')}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('floorMap.resetConfirmTitle')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('floorMap.resetConfirmBody')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  editor.reset()
                  setSelected(new Set())
                  setArmed(null)
                  setVertexModeKey(null)
                  setRemoveSideMode(false)
                }}
              >
                {t('floorMap.resetConfirmAction')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <span className="bg-border h-6 w-px" aria-hidden />
        <FloorSizeField
          label={t('floorMap.widthLabel')}
          value={editor.width}
          onCommit={(n) => {
            editor.beginChange()
            editor.setDimensions(n, editor.height)
          }}
        />
        <FloorSizeField
          label={t('floorMap.heightLabel')}
          value={editor.height}
          onCommit={(n) => {
            editor.beginChange()
            editor.setDimensions(editor.width, n)
          }}
        />

        <span className="bg-border h-6 w-px" aria-hidden />
        <Button
          size="sm"
          variant={showLengths ? 'default' : 'outline'}
          aria-pressed={showLengths}
          onClick={() => setShowLengths((v) => !v)}
        >
          {t('floorMap.lengths')}
        </Button>
        <Button
          size="sm"
          variant={showAngles ? 'default' : 'outline'}
          aria-pressed={showAngles}
          onClick={() => setShowAngles((v) => !v)}
        >
          {t('floorMap.angles')}
        </Button>

        <span className="bg-border h-6 w-px" aria-hidden />
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            editor.beginChange()
            editor.initOutline()
            setSelected(new Set([selKey('outline', OUTLINE_ID)]))
          }}
        >
          {t('floorMap.outlineEdit')}
        </Button>
        {editor.outline && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              editor.beginChange()
              editor.clearOutline()
              setSelected(new Set())
            }}
          >
            {t('floorMap.outlineReset')}
          </Button>
        )}

        {(selectedRoom || selectedDeco) && (
          <>
            <span className="bg-border h-6 w-px" aria-hidden />
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (!single) return
                editor.beginChange()
                editor.rotateItem(single[0], single[1], 90)
              }}
            >
              <RotateCw className="size-4" />
              {t('floorMap.rotateBy')}
            </Button>
            {rotationReadout && (
              <span className="text-muted-foreground text-xs tabular-nums">
                {rotationReadout}
              </span>
            )}
          </>
        )}

        {single && isShape && (
          <Button
            size="sm"
            variant={removeSideMode ? 'default' : 'outline'}
            onClick={() => {
              setDoorMode(false)
              setDoorMoveMode(false)
              setRemoveSideMode((v) => !v)
            }}
          >
            {t('floorMap.removeSide')}
          </Button>
        )}

        {selectedRoom && (
          <>
            {!selectedRoom.placement.door ? (
              <Button
                size="sm"
                variant={doorMode ? 'default' : 'outline'}
                onClick={() => {
                  setRemoveSideMode(false)
                  setDoorMoveMode(false)
                  setDoorInvalid(false)
                  setDoorMode((d) => !d)
                }}
              >
                {t('floorMap.setDoor')}
              </Button>
            ) : (
              <>
                <Button
                  size="sm"
                  variant={doorMoveMode ? 'default' : 'outline'}
                  onClick={() => {
                    setRemoveSideMode(false)
                    setDoorMode(false)
                    setDoorInvalid(false)
                    setDoorMoveMode((d) => !d)
                  }}
                >
                  {t('floorMap.moveDoor')}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    editor.beginChange()
                    editor.setDoor(selectedRoom.room.id, null)
                    setDoorMoveMode(false)
                    setDoorInvalid(false)
                  }}
                >
                  {t('floorMap.removeDoor')}
                </Button>
              </>
            )}
            <Button size="sm" variant="ghost" onClick={removeSelected}>
              <X className="size-4" />
              {t('floorMap.unplaceRoom', { room: selectedRoom.room.room_number })}
            </Button>
          </>
        )}

        {selectedDeco && (
          <>
            <Input
              value={selectedDeco.label ?? ''}
              onFocus={() => editor.beginChange()}
              onChange={(e) => editor.setDecorationLabel(selectedDeco.key, e.target.value)}
              placeholder={t('floorMap.labelPlaceholder')}
              className="h-8 w-40"
            />
            <Button size="sm" variant="ghost" onClick={removeSelected}>
              <Trash2 className="size-4" />
              {t('floorMap.deleteDecoration')}
            </Button>
          </>
        )}

        {selectedDecoKeys.length >= 2 && (
          <Button
            size="sm"
            variant="outline"
            onClick={doMerge}
            disabled={!mergePreview}
            title={mergePreview ? undefined : t('floorMap.mergeHint')}
          >
            {t('floorMap.merge')}
          </Button>
        )}

        {selected.size > 1 && selectedDecoKeys.length < 2 && (
          <Button size="sm" variant="ghost" onClick={removeSelected}>
            <Trash2 className="size-4" />
            {t('floorMap.removeSelected', { count: selected.size })}
          </Button>
        )}

        {single &&
          isShape &&
          !isVertexMode(single[0], single[1]) &&
          !doorMode &&
          !doorMoveMode &&
          !removeSideMode && (
            <span className="text-muted-foreground text-xs">
              {t('floorMap.editCornersHint')}
            </span>
          )}
        {(doorMode || doorMoveMode) && (
          <span
            className={cn(
              'text-xs',
              doorInvalid ? 'text-destructive' : 'text-muted-foreground',
            )}
          >
            {doorInvalid
              ? t('floorMap.doorInvalid')
              : doorMoveMode
                ? t('floorMap.moveDoorHint')
                : t('floorMap.doorHint')}
          </span>
        )}
        {removeSideMode && (
          <span className="text-muted-foreground text-xs">
            {t('floorMap.removeSideHint')}
          </span>
        )}
        {editor.dirty && (
          <span className="text-muted-foreground text-xs">{t('floorMap.unsaved')}</span>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <svg
          ref={svgRef}
          viewBox={paddedViewBox(editor.width, editor.height)}
          preserveAspectRatio="xMidYMid meet"
          className={cn(
            'bg-muted/20 h-auto w-full rounded-lg border',
            (armed || doorMode || doorMoveMode || removeSideMode) &&
              'cursor-crosshair',
          )}
          style={{ touchAction: 'none' }}
          role="application"
          aria-label={t('floorMap.title')}
          onPointerDown={onCanvasPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          <FloorBackdrop width={editor.width} height={editor.height} outline={editor.outline} />

          {/* Outline handles when the floor shape is selected. */}
          {single?.[0] === 'outline' && editor.outline && (
            <g
              onPointerDown={(e) => onItemPointerDown(e, 'outline', OUTLINE_ID)}
              onDoubleClick={(e) => onItemDoubleClick('outline', OUTLINE_ID, e)}
            >
              <polygon
                points={polygonPoints(editor.outline)}
                className="stroke-foreground fill-none"
                strokeWidth={0.4}
                strokeDasharray="1 1"
              />
              <ShapeOverlay
                vertices={editor.outline}
                mode="vertex"
                showRotation={false}
                showLengths={showLengths}
                showAngles={showAngles}
                onVertexDown={(e, i) => onVertexDown(e, 'outline', OUTLINE_ID, i)}
                onVertexDoubleClick={(i) => {
                  editor.beginChange()
                  editor.removeVertex('outline', OUTLINE_ID, i)
                }}
                onRotateDown={() => {}}
              />
            </g>
          )}

          {editor.decorations.map((d) => {
            const isSel = selected.has(selKey('deco', d.key))
            const isSingleSel = single?.[0] === 'deco' && single[1] === d.key
            return (
              <g
                key={d.key}
                className="cursor-grab"
                onPointerDown={(e) => onItemPointerDown(e, 'deco', d.key)}
                onDoubleClick={(e) => onItemDoubleClick('deco', d.key, e)}
              >
                <DecorationShape
                  deco={{
                    id: d.key,
                    kind: d.kind,
                    vertices: d.vertices,
                    label: d.label,
                  }}
                />
                {/* Transparent hit area so labels + thin shapes are grabbable. */}
                {d.kind === 'label' ? (
                  <circle cx={d.vertices[0][0]} cy={d.vertices[0][1]} r={3} fill="transparent" />
                ) : (
                  <polygon points={polygonPoints(d.vertices)} fill="transparent" />
                )}
                {isSel && !isSingleSel && (
                  <polygon
                    points={polygonPoints(d.vertices)}
                    className="stroke-foreground fill-none"
                    strokeWidth={0.4}
                    strokeDasharray="1 1"
                  />
                )}
                {isSingleSel && d.kind !== 'label' && (
                  <ShapeOverlay
                    vertices={d.vertices}
                    mode={isVertexMode('deco', d.key) ? 'vertex' : 'simple'}
                    showRotation
                    showLengths={showLengths}
                    showAngles={showAngles}
                    onVertexDown={(e, i) => onVertexDown(e, 'deco', d.key, i)}
                    onVertexDoubleClick={(i) => {
                      editor.beginChange()
                      editor.removeVertex('deco', d.key, i)
                    }}
                    onRotateDown={(e) => onRotateDown(e, 'deco', d.key)}
                    onResizeDown={(e) => onResizeDown(e, 'deco', d.key)}
                  />
                )}
              </g>
            )
          })}

          {/* Shared-edge highlight when two decorations are ready to merge. */}
          {sharedEdgeSeg && (
            <line
              x1={sharedEdgeSeg[0][0]}
              y1={sharedEdgeSeg[0][1]}
              x2={sharedEdgeSeg[1][0]}
              y2={sharedEdgeSeg[1][1]}
              className="stroke-primary"
              strokeWidth={0.8}
              strokeLinecap="round"
            />
          )}

          {editor.placedRooms.map(({ room, placement }) => {
            const isSel = selected.has(selKey('room', room.id))
            const isSingleSel = single?.[0] === 'room' && single[1] === room.id
            return (
              <g
                key={room.id}
                onDoubleClick={(e) => onItemDoubleClick('room', room.id, e)}
              >
                <RoomShape
                  vertices={placement.vertices}
                  status={room.status}
                  roomNumber={room.room_number}
                  selected={isSel}
                  interactive
                  onPointerDown={(e) => onItemPointerDown(e, 'room', room.id)}
                />
                {placement.door &&
                  (() => {
                    const seg = doorSegment(placement.vertices, placement.door)
                    if (!seg) return null
                    const active =
                      doorMoveMode && single?.[0] === 'room' && single[1] === room.id
                    return (
                      <g>
                        {active && (
                          <line
                            x1={seg[0][0]}
                            y1={seg[0][1]}
                            x2={seg[1][0]}
                            y2={seg[1][1]}
                            className="stroke-primary/30"
                            strokeWidth={3}
                            strokeLinecap="round"
                          />
                        )}
                        <line
                          x1={seg[0][0]}
                          y1={seg[0][1]}
                          x2={seg[1][0]}
                          y2={seg[1][1]}
                          className="stroke-primary"
                          strokeWidth={active ? 1.4 : 1}
                          strokeLinecap="round"
                        />
                      </g>
                    )
                  })()}
                {isSel && !isSingleSel && (
                  <polygon
                    points={polygonPoints(placement.vertices)}
                    className="stroke-foreground fill-none"
                    strokeWidth={0.4}
                    strokeDasharray="1 1"
                  />
                )}
                {isSingleSel && (
                  <ShapeOverlay
                    vertices={placement.vertices}
                    mode={isVertexMode('room', room.id) ? 'vertex' : 'simple'}
                    showRotation
                    showLengths={showLengths}
                    showAngles={showAngles}
                    onVertexDown={(e, i) => onVertexDown(e, 'room', room.id, i)}
                    onVertexDoubleClick={(i) => {
                      editor.beginChange()
                      editor.removeVertex('room', room.id, i)
                    }}
                    onRotateDown={(e) => onRotateDown(e, 'room', room.id)}
                    onResizeDown={(e) => onResizeDown(e, 'room', room.id)}
                  />
                )}
              </g>
            )
          })}
        </svg>

        <aside className="space-y-4">
          {/* Decoration palette */}
          <div>
            <h3 className="mb-2 text-sm font-medium">{t('floorMap.addHeading')}</h3>
            <div className="flex flex-wrap gap-1.5">
              {DECORATION_KINDS.map((kind) => (
                <Button
                  key={kind}
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    editor.beginChange()
                    setSelected(new Set([selKey('deco', editor.addDecoration(kind))]))
                  }}
                >
                  {t(`floorMap.deco.${kind}`)}
                </Button>
              ))}
            </div>
          </div>

          {/* Unplaced-rooms tray: tap to arm, then tap the map to drop. */}
          <div>
            <h3 className="text-sm font-medium">{t('floorMap.unplacedHeading')}</h3>
            <p
              className={cn(
                'mt-1 text-xs',
                placeBlocked && armed ? 'text-destructive' : 'text-muted-foreground',
              )}
            >
              {armed
                ? placeBlocked
                  ? t('floorMap.placeBlocked')
                  : t('floorMap.placeHint')
                : t('floorMap.trayHint')}
            </p>
            {editor.unplacedRooms.length === 0 ? (
              <p className="text-muted-foreground mt-2 text-sm">
                {t('floorMap.unplacedEmpty')}
              </p>
            ) : (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {editor.unplacedRooms.map((room) => (
                  <li key={room.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setPlaceBlocked(false)
                        setArmed((cur) => (cur === room.id ? null : room.id))
                      }}
                      className={cn(
                        'rounded-md border px-2 py-1 text-sm',
                        armed === room.id
                          ? 'bg-primary text-primary-foreground border-transparent'
                          : 'bg-muted/40 hover:bg-muted',
                      )}
                    >
                      {room.room_number}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
