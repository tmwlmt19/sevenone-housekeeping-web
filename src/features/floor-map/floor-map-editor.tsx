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
import { DECORATION_KINDS, type FloorMap, type FloorMapWrite } from '@/lib/api/types'
import { cn } from '@/lib/utils'

import {
  DecorationShape,
  FloorBackdrop,
  HallBorders,
  paddedViewBox,
  RoomRect,
} from './canvas-parts'
import { pointerToSvg, snap } from './svg-coords'
import { type ItemType, useFloorEditor } from './use-floor-editor'

type Selected = Set<string> // keys: `room:<id>` / `deco:<key>`

const selKey = (type: ItemType, id: string) => `${type}:${id}`
function splitKey(key: string): [ItemType, string] {
  const i = key.indexOf(':')
  return [key.slice(0, i) as ItemType, key.slice(i + 1)]
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
    items: Array<{ type: ItemType; id: string; startX: number; startY: number }>
    px: number
    py: number
  } | null>(null)
  const resizeRef = useRef<{ type: ItemType; id: string } | null>(null)
  const movedRef = useRef(false) // has the active gesture actually moved yet?
  const lastArrowRef = useRef(0) // for coalescing arrow-key nudges into one undo
  const [armed, setArmed] = useState<string | null>(null)
  const [selected, setSelected] = useState<Selected>(new Set())

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

  const selGeom = selectedRoom
    ? selectedRoom.placement
    : selectedDeco
      ? { x: selectedDeco.x, y: selectedDeco.y, w: selectedDeco.w, h: selectedDeco.h, rotation: 0 }
      : null

  function at(e: React.PointerEvent) {
    return pointerToSvg(svgRef.current!, e.clientX, e.clientY)
  }

  function geomOf(type: ItemType, id: string): { x: number; y: number } | null {
    if (type === 'room') {
      const p = editor.placements[id]
      return p ? { x: p.x, y: p.y } : null
    }
    const d = editor.decorations.find((dd) => dd.key === id)
    return d ? { x: d.x, y: d.y } : null
  }

  function removeSelected() {
    if (selected.size === 0) return
    editor.beginChange()
    for (const key of selected) {
      const [type, id] = splitKey(key)
      if (type === 'room') editor.unplace(id)
      else editor.removeDecoration(id)
    }
    setSelected(new Set())
  }

  // Keyboard: Delete removes the selection; arrows nudge it by one grid step.
  // Neither fires while typing in a field.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (selected.size === 0) return
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        editor.beginChange()
        for (const key of selected) {
          const [type, id] = splitKey(key)
          if (type === 'room') editor.unplace(id)
          else editor.removeDecoration(id)
        }
        setSelected(new Set())
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
          const g =
            type === 'room'
              ? editor.placements[id]
              : (editor.decorations.find((dd) => dd.key === id) ?? null)
          return g ? { type, id, x: g.x + delta[0], y: g.y + delta[1] } : null
        })
        .filter((u) => u !== null)
      editor.moveItemsTo(updates)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected, editor])

  function onCanvasPointerDown(e: React.PointerEvent) {
    if (armed) {
      const { x, y } = at(e)
      editor.beginChange()
      editor.placeAt(armed, x, y)
      setSelected(new Set([selKey('room', armed)]))
      setArmed(null)
    } else {
      setSelected(new Set())
    }
  }

  function onItemPointerDown(e: React.PointerEvent, type: ItemType, id: string) {
    if (armed) return // let the click fall through to place the armed room
    e.stopPropagation()
    const key = selKey(type, id)
    if (e.shiftKey) {
      // Toggle membership; don't start a drag.
      setSelected((prev) => {
        const next = new Set(prev)
        if (next.has(key)) next.delete(key)
        else next.add(key)
        return next
      })
      return
    }
    // Drag the whole selection if this item is part of it, else just this item.
    const dragKeys = selected.has(key) ? [...selected] : [key]
    if (!selected.has(key)) setSelected(new Set([key]))
    const items = dragKeys
      .map((k) => {
        const [t, i] = splitKey(k)
        const g = geomOf(t, i)
        return g ? { type: t, id: i, startX: g.x, startY: g.y } : null
      })
      .filter((it) => it !== null)
    const { x, y } = at(e)
    dragRef.current = { items, px: x, py: y }
    movedRef.current = false
    svgRef.current?.setPointerCapture(e.pointerId)
  }

  function onResizePointerDown(e: React.PointerEvent, type: ItemType, id: string) {
    e.stopPropagation()
    resizeRef.current = { type, id }
    movedRef.current = false
    svgRef.current?.setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: React.PointerEvent) {
    const rz = resizeRef.current
    const dr = dragRef.current
    if (!rz && !dr) return
    const { x, y } = at(e)
    if (!movedRef.current) {
      editor.beginChange() // one undo entry per gesture, only once it moves
      movedRef.current = true
    }
    if (rz) {
      if (rz.type === 'room') {
        const p = editor.placements[rz.id]
        if (p) editor.resize(rz.id, x - p.x, y - p.y)
      } else {
        const d = editor.decorations.find((dd) => dd.key === rz.id)
        if (d) editor.resizeDecoration(rz.id, x - d.x, y - d.y)
      }
      return
    }
    if (dr) {
      const sdx = snap(x - dr.px, editor.grid)
      const sdy = snap(y - dr.py, editor.grid)
      editor.moveItemsTo(
        dr.items.map((it) => ({
          type: it.type,
          id: it.id,
          x: it.startX + sdx,
          y: it.startY + sdy,
        })),
      )
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    if (dragRef.current || resizeRef.current) {
      svgRef.current?.releasePointerCapture(e.pointerId)
      dragRef.current = null
      resizeRef.current = null
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

  const showHandle =
    (selectedRoom && selectedRoom.placement.rotation === 0) || !!selectedDeco
  const handleType: ItemType = selectedRoom ? 'room' : 'deco'
  const handleId = selectedRoom ? selectedRoom.room.id : (selectedDeco?.key ?? '')

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
              <AlertDialogTitle>
                {t('floorMap.resetConfirmTitle')}
              </AlertDialogTitle>
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

        {selectedRoom && (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                editor.beginChange()
                editor.rotate(selectedRoom.room.id)
              }}
            >
              <RotateCw className="size-4" />
              {t('floorMap.rotate')}
            </Button>
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
              onChange={(e) =>
                editor.setDecorationLabel(selectedDeco.key, e.target.value)
              }
              placeholder={t('floorMap.labelPlaceholder')}
              className="h-8 w-40"
            />
            <Button size="sm" variant="ghost" onClick={removeSelected}>
              <Trash2 className="size-4" />
              {t('floorMap.deleteDecoration')}
            </Button>
          </>
        )}

        {selected.size > 1 && (
          <Button size="sm" variant="ghost" onClick={removeSelected}>
            <Trash2 className="size-4" />
            {t('floorMap.removeSelected', { count: selected.size })}
          </Button>
        )}

        {editor.dirty && (
          <span className="text-muted-foreground text-xs">
            {t('floorMap.unsaved')}
          </span>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <svg
          ref={svgRef}
          viewBox={paddedViewBox(editor.width, editor.height)}
          preserveAspectRatio="xMidYMid meet"
          className={cn(
            'bg-muted/20 h-auto w-full rounded-lg border',
            armed && 'cursor-crosshair',
          )}
          style={{ touchAction: 'none' }}
          role="application"
          aria-label={t('floorMap.title')}
          onPointerDown={onCanvasPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          <FloorBackdrop width={editor.width} height={editor.height} />

          {editor.decorations.map((d) => (
            <g
              key={d.key}
              className="cursor-grab"
              onPointerDown={(e) => onItemPointerDown(e, 'deco', d.key)}
            >
              <DecorationShape
                deco={{
                  id: d.key,
                  kind: d.kind,
                  x: d.x,
                  y: d.y,
                  w: d.w,
                  h: d.h,
                  label: d.label,
                }}
              />
              {/* Transparent hit area so even label-only decorations are grabbable. */}
              <rect x={d.x} y={d.y} width={d.w} height={d.h} fill="transparent" />
              {selected.has(selKey('deco', d.key)) && (
                <rect
                  x={d.x}
                  y={d.y}
                  width={d.w}
                  height={d.h}
                  rx={0.5}
                  className="stroke-foreground fill-none"
                  strokeWidth={0.4}
                  strokeDasharray="1 1"
                />
              )}
            </g>
          ))}
          <HallBorders
            decorations={editor.decorations.map((d) => ({
              id: d.key,
              kind: d.kind,
              x: d.x,
              y: d.y,
              w: d.w,
              h: d.h,
              label: d.label,
            }))}
          />

          {editor.placedRooms.map(({ room, placement }) => (
            <RoomRect
              key={room.id}
              x={placement.x}
              y={placement.y}
              w={placement.w}
              h={placement.h}
              rotation={placement.rotation}
              status={room.status}
              roomNumber={room.room_number}
              selected={selected.has(selKey('room', room.id))}
              interactive
              onPointerDown={(e) => onItemPointerDown(e, 'room', room.id)}
            />
          ))}

          {/* Dimension labels for a single selected element (in feet). */}
          {selGeom &&
            (() => {
              const sideways = selGeom.rotation % 180 === 90
              const spanX = sideways ? selGeom.h : selGeom.w
              const spanY = sideways ? selGeom.w : selGeom.h
              const cx = selGeom.x + selGeom.w / 2
              const cy = selGeom.y + selGeom.h / 2
              return (
                <g
                  className="fill-foreground pointer-events-none select-none"
                  fontSize={2.6}
                  fontWeight={600}
                >
                  <text x={cx} y={cy - spanY / 2 - 1} textAnchor="middle">
                    {t('floorMap.feet', { value: spanX })}
                  </text>
                  <text
                    x={cx - spanX / 2 - 1}
                    y={cy}
                    textAnchor="end"
                    dominantBaseline="central"
                  >
                    {t('floorMap.feet', { value: spanY })}
                  </text>
                </g>
              )
            })()}

          {/* Resize handle on a single selected element (rooms only when unrotated). */}
          {showHandle && selGeom && (
            <rect
              x={selGeom.x + selGeom.w - 1.25}
              y={selGeom.y + selGeom.h - 1.25}
              width={2.5}
              height={2.5}
              rx={0.4}
              className="fill-foreground stroke-background cursor-nwse-resize"
              strokeWidth={0.3}
              onPointerDown={(e) => onResizePointerDown(e, handleType, handleId)}
            />
          )}
        </svg>

        <aside className="space-y-4">
          {/* Decoration palette */}
          <div>
            <h3 className="mb-2 text-sm font-medium">
              {t('floorMap.addHeading')}
            </h3>
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
            <h3 className="text-sm font-medium">
              {t('floorMap.unplacedHeading')}
            </h3>
            <p className="text-muted-foreground mt-1 text-xs">
              {armed ? t('floorMap.placeHint') : t('floorMap.trayHint')}
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
                      onClick={() =>
                        setArmed((cur) => (cur === room.id ? null : room.id))
                      }
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
