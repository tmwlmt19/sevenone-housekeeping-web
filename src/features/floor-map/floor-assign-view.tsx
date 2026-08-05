import { Sparkles, Users, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { ApiError } from '@/lib/api/unwrap'
import type { FloorMap, Staff, TaskPriority } from '@/lib/api/types'
import { TASK_PRIORITIES } from '@/lib/api/types'
import { useHotelMap } from '@/lib/queries/floor-map'
import { useStaff } from '@/lib/queries/staff'
import { useImportDirtyRooms } from '@/lib/queries/tasks'
import { cn } from '@/lib/utils'

import { autoClusterRooms, zonesToAssignments, type ZoneMap } from './assign'
import { FloorAssignCanvas, isCandidate } from './floor-assign-canvas'
import { FloorSelector } from './map-chrome'
import { zoneColor } from './zone-colors'

/**
 * Manual-zone assignment (floor-map use case #2). Dirty rooms are cleaning
 * candidates; the manager paints them into per-housekeeper zones — tap or lasso
 * on the map, or one-click Auto-assign (proximity split) — then creates one
 * cleaning task per assigned room in a single POST /tasks/import. Both paths
 * build the same zone map, so they share the same explicit-assignment payload.
 * Manager-only (creating tasks); front desk never reaches this view.
 */
export function FloorAssignView() {
  const { t } = useTranslation()
  const { data: map, isLoading, isError } = useHotelMap()
  const [floor, setFloor] = useState<number>()

  useEffect(() => {
    if (!map || floor !== undefined) return
    const floors = map.floors.map((f) => f.floor)
    if (floors.length === 0) return
    setFloor(floors.includes(1) ? 1 : floors[0])
  }, [map, floor])

  if (isLoading) return <Skeleton className="h-[60vh] w-full" />
  if (isError || !map) {
    return <p className="text-destructive text-sm">{t('floorMap.loadError')}</p>
  }
  if (map.floors.length === 0) {
    return <p className="text-muted-foreground text-sm">{t('floorMap.noRooms')}</p>
  }

  const current = map.floors.find((f) => f.floor === floor) ?? map.floors[0]

  return (
    <div className="space-y-4">
      <FloorSelector floors={map.floors} current={current.floor} onSelect={setFloor} />
      {/* Key by floor so zone selections reset when switching floors. */}
      <FloorAssignBody key={current.floor} floor={current} />
    </div>
  )
}

function FloorAssignBody({ floor }: { floor: FloorMap }) {
  const { t } = useTranslation()
  const { data: staff } = useStaff()
  const importRooms = useImportDirtyRooms()

  const [zones, setZones] = useState<ZoneMap>({})
  const [activeHkId, setActiveHkId] = useState<string | null>(null)
  const [priority, setPriority] = useState<TaskPriority>('normal')

  const housekeepers = useMemo<Staff[]>(
    () => (staff ?? []).filter((s) => s.role === 'housekeeper'),
    [staff],
  )
  const colorIndexByHk = useMemo(() => {
    const m: Record<string, number> = {}
    housekeepers.forEach((h, i) => (m[h.id] = i))
    return m
  }, [housekeepers])

  const candidates = floor.rooms.filter(isCandidate)
  const placedCandidates = candidates.filter((r) => r.placement)
  const unplacedCandidates = candidates.filter((r) => !r.placement)
  const assignedCount = candidates.filter((r) => zones[r.id]).length
  const unassignedCount = candidates.length - assignedCount

  const countByHk = useMemo(() => {
    const m: Record<string, number> = {}
    for (const hkId of Object.values(zones)) m[hkId] = (m[hkId] ?? 0) + 1
    return m
  }, [zones])

  function toggleRoom(roomId: string) {
    if (!activeHkId) return
    setZones((prev) => {
      const next = { ...prev }
      if (next[roomId] === activeHkId) delete next[roomId]
      else next[roomId] = activeHkId
      return next
    })
  }

  function assignMany(roomIds: string[]) {
    if (!activeHkId) return
    setZones((prev) => {
      const next = { ...prev }
      for (const id of roomIds) next[id] = activeHkId
      return next
    })
  }

  function autoAssign() {
    if (housekeepers.length === 0) return
    // Proximity split over placed candidates; unplaced ones stay for manual tap.
    setZones(autoClusterRooms(placedCandidates, housekeepers.map((h) => h.id)))
  }

  function submit() {
    const assignments = zonesToAssignments(zones, floor.rooms)
    importRooms.mutate(
      { assignments, priority },
      {
        onSuccess: (res) => {
          const parts = [t('importRooms.createdCount', { count: res.tasks_created })]
          if (res.skipped.length > 0) {
            parts.push(t('importRooms.skippedCount', { count: res.skipped.length }))
          }
          toast.success(parts.join(' · '))
          setZones({})
        },
        onError: (err: unknown) =>
          toast.error(
            err instanceof ApiError ? err.message : t('common.somethingWentWrong'),
          ),
      },
    )
  }

  if (candidates.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">{t('floorMap.assign.noDirty')}</p>
    )
  }
  if (housekeepers.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        {t('importRooms.noHousekeepers')}
      </p>
    )
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="space-y-3">
        <FloorAssignCanvas
          floor={floor}
          zones={zones}
          colorIndexByHk={colorIndexByHk}
          interactive={activeHkId !== null}
          onRoomTap={toggleRoom}
          onLasso={assignMany}
        />
        <p className="text-muted-foreground text-xs">
          {activeHkId ? t('floorMap.assign.paintHint') : t('floorMap.assign.pickFirst')}
        </p>

        {unplacedCandidates.length > 0 && (
          <div className="space-y-1.5">
            <h4 className="text-sm font-medium">{t('floorMap.assign.unplacedHeading')}</h4>
            <p className="text-muted-foreground text-xs">
              {t('floorMap.assign.unplacedHint')}
            </p>
            <ul className="flex flex-wrap gap-1.5">
              {unplacedCandidates.map((room) => {
                const idx = zones[room.id] ? colorIndexByHk[zones[room.id]] : undefined
                return (
                  <li key={room.id}>
                    <button
                      type="button"
                      disabled={!activeHkId}
                      onClick={() => toggleRoom(room.id)}
                      className={cn(
                        'flex items-center gap-1.5 rounded-md border px-2 py-1 text-sm disabled:opacity-50',
                        idx === undefined && 'bg-muted/40',
                      )}
                    >
                      {idx !== undefined && (
                        <span className={cn('size-2.5 rounded-full', zoneColor(idx).swatch)} />
                      )}
                      {room.room_number}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>

      <aside className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-1.5">
              <Users className="size-4" />
              {t('floorMap.assign.housekeepers')}
            </Label>
            <Button type="button" variant="ghost" size="sm" onClick={autoAssign}>
              <Sparkles className="size-4" />
              {t('floorMap.assign.auto')}
            </Button>
          </div>
          <ul className="space-y-1">
            {housekeepers.map((hk, i) => {
              const active = hk.id === activeHkId
              return (
                <li key={hk.id}>
                  <button
                    type="button"
                    onClick={() => setActiveHkId(active ? null : hk.id)}
                    aria-pressed={active}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-sm',
                      active ? 'border-primary bg-accent' : 'hover:bg-accent',
                    )}
                  >
                    <span className={cn('size-3 rounded-full', zoneColor(i).swatch)} />
                    <span className="flex-1 text-left">{hk.name}</span>
                    <span className="text-muted-foreground tabular-nums text-xs">
                      {countByHk[hk.id] ?? 0}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>

        <div className="text-muted-foreground flex items-center justify-between text-xs">
          <span>{t('floorMap.assign.unassignedCount', { count: unassignedCount })}</span>
          {assignedCount > 0 && (
            <button
              type="button"
              onClick={() => setZones({})}
              className="hover:text-foreground flex items-center gap-1"
            >
              <X className="size-3" />
              {t('floorMap.assign.clear')}
            </button>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="assign-priority">{t('importRooms.priority')}</Label>
          <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
            <SelectTrigger id="assign-priority" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TASK_PRIORITIES.map((p) => (
                <SelectItem key={p} value={p}>
                  {t(`enums.priority.${p}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          type="button"
          className="w-full"
          disabled={assignedCount === 0 || importRooms.isPending}
          onClick={submit}
        >
          {importRooms.isPending
            ? t('importRooms.importing')
            : t('floorMap.assign.createTasks', { count: assignedCount })}
        </Button>
      </aside>
    </div>
  )
}
