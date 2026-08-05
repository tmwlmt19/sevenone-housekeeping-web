import { ChevronDown, ChevronRight, Sparkles, Users, X } from 'lucide-react'
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
import type { MapRoom, Staff, TaskPriority } from '@/lib/api/types'
import { TASK_PRIORITIES } from '@/lib/api/types'
import { useHotelMap } from '@/lib/queries/floor-map'
import { useStaff } from '@/lib/queries/staff'
import { useImportDirtyRooms } from '@/lib/queries/tasks'
import { cn } from '@/lib/utils'

import { autoClusterRooms, zonesToAssignments, type ZoneMap } from './assign'
import { FloorAssignCanvas, isCandidate } from './floor-assign-canvas'
import { FloorSelector } from './map-chrome'
import { zoneColor } from './zone-colors'

interface CandidateEntry {
  room: MapRoom
  floor: number
}

/**
 * Manual-zone assignment (floor-map use case #2). Dirty rooms without a live task
 * are cleaning candidates; the manager paints them into per-housekeeper zones —
 * tap or lasso on the map, or one-click Auto-assign (proximity split). The zone
 * map is kept across floors as one running plan, shown per housekeeper in the
 * side palette, and turned into tasks in a single POST /tasks/import. A room can
 * only sit in one housekeeper's plan. Manager-only; front desk never gets here.
 */
export function FloorAssignView() {
  const { t } = useTranslation()
  const { data: map, isLoading, isError } = useHotelMap()
  const { data: staff } = useStaff()
  const importRooms = useImportDirtyRooms()

  const [floor, setFloor] = useState<number>()
  // Zone plan (roomId → housekeeperId), kept across floor switches.
  const [zones, setZones] = useState<ZoneMap>({})
  const [activeHkId, setActiveHkId] = useState<string | null>(null)
  const [priority, setPriority] = useState<TaskPriority>('normal')
  const [expandedHk, setExpandedHk] = useState<string | null>(null)

  useEffect(() => {
    if (!map || floor !== undefined) return
    const floors = map.floors.map((f) => f.floor)
    if (floors.length === 0) return
    setFloor(floors.includes(1) ? 1 : floors[0])
  }, [map, floor])

  const housekeepers = useMemo<Staff[]>(
    () => (staff ?? []).filter((s) => s.role === 'housekeeper'),
    [staff],
  )
  const colorIndexByHk = useMemo(() => {
    const m: Record<string, number> = {}
    housekeepers.forEach((h, i) => (m[h.id] = i))
    return m
  }, [housekeepers])

  // Every candidate across all floors (dirty, no live task), with its floor.
  const candidates = useMemo<CandidateEntry[]>(
    () =>
      (map?.floors ?? []).flatMap((f) =>
        f.rooms.filter(isCandidate).map((room) => ({ room, floor: f.floor })),
      ),
    [map],
  )
  // Assigned candidates grouped by housekeeper (auto-prunes stale zone entries —
  // e.g. a room that got tasked elsewhere is no longer a candidate). Ordered by
  // floor then room number for a readable dropdown.
  const byHk = useMemo(() => {
    const m: Record<string, CandidateEntry[]> = {}
    for (const c of candidates) {
      const hk = zones[c.room.id]
      if (hk) (m[hk] ??= []).push(c)
    }
    for (const list of Object.values(m)) {
      list.sort(
        (a, b) =>
          a.floor - b.floor || a.room.room_number.localeCompare(b.room.room_number),
      )
    }
    return m
  }, [candidates, zones])

  const totalAssigned = Object.values(byHk).reduce((n, l) => n + l.length, 0)
  const totalUnassigned = candidates.length - totalAssigned

  function toggleRoom(roomId: string) {
    if (!activeHkId) return
    setZones((prev) => {
      const next = { ...prev }
      if (next[roomId] === activeHkId) delete next[roomId]
      else next[roomId] = activeHkId // reassigns away from any other housekeeper
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

  function removeRoom(roomId: string) {
    setZones((prev) => {
      const next = { ...prev }
      delete next[roomId]
      return next
    })
  }

  if (isLoading) return <Skeleton className="h-[60vh] w-full" />
  if (isError || !map) {
    return <p className="text-destructive text-sm">{t('floorMap.loadError')}</p>
  }
  if (map.floors.length === 0) {
    return <p className="text-muted-foreground text-sm">{t('floorMap.noRooms')}</p>
  }

  const current = map.floors.find((f) => f.floor === floor) ?? map.floors[0]
  const currentPlacedCandidates = current.rooms.filter(
    (r) => isCandidate(r) && r.placement,
  )
  const currentUnplaced = current.rooms.filter(
    (r) => isCandidate(r) && !r.placement,
  )

  function autoAssign() {
    if (housekeepers.length === 0) return
    // Cluster this floor's placed candidates and merge into the running plan,
    // leaving other floors' assignments untouched.
    const clustered = autoClusterRooms(
      currentPlacedCandidates,
      housekeepers.map((h) => h.id),
    )
    setZones((prev) => ({ ...prev, ...clustered }))
  }

  function submit() {
    const assignments = zonesToAssignments(
      zones,
      candidates.map((c) => c.room),
    )
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

  if (candidates.length === 0 && totalAssigned === 0) {
    return (
      <div className="space-y-4">
        <FloorSelector floors={map.floors} current={current.floor} onSelect={setFloor} />
        <p className="text-muted-foreground text-sm">{t('floorMap.assign.noDirty')}</p>
      </div>
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
    <div className="space-y-4">
      <FloorSelector floors={map.floors} current={current.floor} onSelect={setFloor} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-3">
          <FloorAssignCanvas
            floor={current}
            zones={zones}
            colorIndexByHk={colorIndexByHk}
            interactive={activeHkId !== null}
            onRoomTap={toggleRoom}
            onLasso={assignMany}
          />
          <p className="text-muted-foreground text-xs">
            {activeHkId
              ? t('floorMap.assign.paintHint')
              : t('floorMap.assign.pickFirst')}
          </p>

          {currentUnplaced.length > 0 && (
            <div className="space-y-1.5">
              <h4 className="text-sm font-medium">
                {t('floorMap.assign.unplacedHeading')}
              </h4>
              <p className="text-muted-foreground text-xs">
                {t('floorMap.assign.unplacedHint')}
              </p>
              <ul className="flex flex-wrap gap-1.5">
                {currentUnplaced.map((room) => {
                  const idx = zones[room.id]
                    ? colorIndexByHk[zones[room.id]]
                    : undefined
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
                          <span
                            className={cn(
                              'size-2.5 rounded-full',
                              zoneColor(idx).swatch,
                            )}
                          />
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
                const rooms = byHk[hk.id] ?? []
                const expanded = expandedHk === hk.id
                return (
                  <li key={hk.id} className="rounded-md border">
                    <div
                      className={cn(
                        'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm',
                        active && 'bg-accent',
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => setActiveHkId(active ? null : hk.id)}
                        aria-pressed={active}
                        className="flex flex-1 items-center gap-2 text-left"
                      >
                        <span
                          className={cn('size-3 rounded-full', zoneColor(i).swatch)}
                        />
                        <span className="flex-1">{hk.name}</span>
                        <span className="text-muted-foreground tabular-nums text-xs">
                          {rooms.length}
                        </span>
                      </button>
                      <button
                        type="button"
                        disabled={rooms.length === 0}
                        onClick={() => setExpandedHk(expanded ? null : hk.id)}
                        aria-label={t('floorMap.assign.toggleList')}
                        className="text-muted-foreground disabled:opacity-30"
                      >
                        {expanded ? (
                          <ChevronDown className="size-4" />
                        ) : (
                          <ChevronRight className="size-4" />
                        )}
                      </button>
                    </div>

                    {expanded && rooms.length > 0 && (
                      <ul className="space-y-0.5 border-t px-2 py-1.5">
                        {rooms.map(({ room, floor: rf }) => (
                          <li
                            key={room.id}
                            className="flex items-center gap-2 text-sm"
                          >
                            <button
                              type="button"
                              onClick={() => setFloor(rf)}
                              className="hover:text-foreground text-muted-foreground flex-1 text-left"
                            >
                              {t('floorMap.assign.roomOnFloor', {
                                room: room.room_number,
                                floor: rf,
                              })}
                            </button>
                            <button
                              type="button"
                              onClick={() => removeRoom(room.id)}
                              aria-label={t('floorMap.assign.removeRoom', {
                                room: room.room_number,
                              })}
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <X className="size-3.5" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>

          <div className="text-muted-foreground flex items-center justify-between text-xs">
            <span>
              {t('floorMap.assign.unassignedCount', { count: totalUnassigned })}
            </span>
            {totalAssigned > 0 && (
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
            <Select
              value={priority}
              onValueChange={(v) => setPriority(v as TaskPriority)}
            >
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
            disabled={totalAssigned === 0 || importRooms.isPending}
            onClick={submit}
          >
            {importRooms.isPending
              ? t('importRooms.importing')
              : t('floorMap.assign.createTasks', { count: totalAssigned })}
          </Button>
        </aside>
      </div>
    </div>
  )
}
