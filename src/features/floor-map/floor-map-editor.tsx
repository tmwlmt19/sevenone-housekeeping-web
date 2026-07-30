import { Save, Undo2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import type { FloorMap, FloorMapWrite } from '@/lib/api/types'
import { cn } from '@/lib/utils'

import { DecorationShape, GridLines, RoomRect } from './canvas-parts'
import { pointerToSvg } from './svg-coords'
import { useFloorEditor } from './use-floor-editor'

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
  const dragRef = useRef<{ roomId: string; dx: number; dy: number } | null>(null)
  const [armed, setArmed] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)

  // Delete / Backspace unplaces the selected room.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selected) {
        editor.unplace(selected)
        setSelected(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected, editor])

  function at(e: React.PointerEvent) {
    return pointerToSvg(svgRef.current!, e.clientX, e.clientY)
  }

  function onCanvasPointerDown(e: React.PointerEvent) {
    if (armed) {
      const { x, y } = at(e)
      editor.placeAt(armed, x, y)
      setSelected(armed)
      setArmed(null)
    } else {
      setSelected(null)
    }
  }

  function onRoomPointerDown(e: React.PointerEvent, roomId: string) {
    if (armed) return
    e.stopPropagation()
    setSelected(roomId)
    const { x, y } = at(e)
    const p = editor.placements[roomId]
    dragRef.current = { roomId, dx: x - p.x, dy: y - p.y }
    svgRef.current?.setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: React.PointerEvent) {
    const drag = dragRef.current
    if (!drag) return
    const { x, y } = at(e)
    editor.move(drag.roomId, x - drag.dx, y - drag.dy)
  }

  function onPointerUp(e: React.PointerEvent) {
    if (dragRef.current) {
      svgRef.current?.releasePointerCapture(e.pointerId)
      dragRef.current = null
    }
  }

  async function handleSave() {
    try {
      await onSave(editor.buildPayload())
      editor.markSaved()
    } catch {
      // The parent surfaces the error toast; keep the draft so nothing is lost.
    }
  }

  const selectedRoom = editor.placedRooms.find((p) => p.room.id === selected)

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
            editor.reset()
            setSelected(null)
            setArmed(null)
          }}
          disabled={!editor.dirty || saving}
        >
          <Undo2 className="size-4" />
          {t('floorMap.reset')}
        </Button>
        {selectedRoom && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              editor.unplace(selectedRoom.room.id)
              setSelected(null)
            }}
          >
            <X className="size-4" />
            {t('floorMap.unplaceRoom', {
              room: selectedRoom.room.room_number,
            })}
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
          viewBox={`0 0 ${editor.width} ${editor.height}`}
          preserveAspectRatio="xMidYMid meet"
          className={cn(
            'bg-card h-auto w-full rounded-lg border',
            armed && 'cursor-crosshair',
          )}
          style={{ touchAction: 'none' }}
          role="application"
          aria-label={t('floorMap.title')}
          onPointerDown={onCanvasPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          <GridLines width={editor.width} height={editor.height} />

          {floor.decorations.map((deco) => (
            <DecorationShape key={deco.id} deco={deco} />
          ))}

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
              selected={room.id === selected}
              interactive
              onPointerDown={(e) => onRoomPointerDown(e, room.id)}
            />
          ))}
        </svg>

        {/* Unplaced-rooms tray: tap to arm, then tap the map to drop. */}
        <aside className="space-y-2">
          <h3 className="text-sm font-medium">
            {t('floorMap.unplacedHeading')}
          </h3>
          <p className="text-muted-foreground text-xs">
            {armed ? t('floorMap.placeHint') : t('floorMap.trayHint')}
          </p>
          {editor.unplacedRooms.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {t('floorMap.unplacedEmpty')}
            </p>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
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
        </aside>
      </div>
    </div>
  )
}
