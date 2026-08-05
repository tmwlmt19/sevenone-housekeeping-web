import {
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Sparkles,
  Users,
  X,
} from 'lucide-react'
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
  // Rooms picked before a housekeeper is chosen (the "select rooms, then pick a
  // housekeeper" direction). Kept across floor switches, like the zone plan.
  const [selectedRoomIds, setSelectedRoomIds] = useState<Set<string>>(new Set())
  const [priority, setPriority] = useState<TaskPriority>('normal')
  // Which housekeepers have their assigned-room list expanded in the palette.
  const [expandedHks, setExpandedHks] = useState<Set<string>>(new Set())

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

  // --- Direction A: a housekeeper is active, so taps/lassoes paint their zone.
  function paintRoom(roomId: string) {
    if (!activeHkId) return
    setZones((prev) => {
      const next = { ...prev }
      if (next[roomId] === activeHkId) delete next[roomId]
      else next[roomId] = activeHkId // reassigns away from any other housekeeper
      return next
    })
  }

  function paintMany(roomIds: string[]) {
    if (!activeHkId) return
    setZones((prev) => {
      const next = { ...prev }
      for (const id of roomIds) next[id] = activeHkId
      return next
    })
  }

  // --- Direction B: no housekeeper active, so taps/lassoes build a selection
  // that a later housekeeper click assigns in one go.
  function toggleSelected(roomId: string) {
    setSelectedRoomIds((prev) => {
      const next = new Set(prev)
      if (next.has(roomId)) next.delete(roomId)
      else next.add(roomId)
      return next
    })
  }

  function selectMany(roomIds: string[]) {
    setSelectedRoomIds((prev) => {
      const next = new Set(prev)
      for (const id of roomIds) next.add(id)
      return next
    })
  }

  // Map/tray interactions route by mode: paint when a housekeeper is active,
  // otherwise stage a selection.
  function handleRoomTap(roomId: string) {
    if (activeHkId) paintRoom(roomId)
    else toggleSelected(roomId)
  }

  function handleLasso(roomIds: string[]) {
    if (activeHkId) paintMany(roomIds)
    else selectMany(roomIds)
  }

  // Clicking a housekeeper either assigns the pending selection to them (and
  // clears it, staying in select mode for the next batch), or — with nothing
  // selected — toggles them as the active painter.
  function handleHkClick(hkId: string) {
    if (selectedRoomIds.size > 0) {
      setZones((prev) => {
        const next = { ...prev }
        for (const id of selectedRoomIds) next[id] = hkId
        return next
      })
      setSelectedRoomIds(new Set())
      return
    }
    setActiveHkId(activeHkId === hkId ? null : hkId)
  }

  function removeRoom(roomId: string) {
    setZones((prev) => {
      const next = { ...prev }
      delete next[roomId]
      return next
    })
  }

  function toggleExpanded(hkId: string) {
    setExpandedHks((prev) => {
      const next = new Set(prev)
      if (next.has(hkId)) next.delete(hkId)
      else next.add(hkId)
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

  const hasSelection = selectedRoomIds.size > 0
  // Expand-all covers only housekeepers that actually have rooms to show.
  const hksWithRooms = housekeepers.filter((h) => (byHk[h.id]?.length ?? 0) > 0)
  const allExpanded =
    hksWithRooms.length > 0 && hksWithRooms.every((h) => expandedHks.has(h.id))
  function toggleExpandAll() {
    setExpandedHks(
      allExpanded ? new Set() : new Set(hksWithRooms.map((h) => h.id)),
    )
  }

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
          setSelectedRoomIds(new Set())
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
            selectedRoomIds={selectedRoomIds}
            interactive
            onRoomTap={handleRoomTap}
            onLasso={handleLasso}
          />
          {hasSelection ? (
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-foreground font-medium">
                {t('floorMap.assign.selectedCount', {
                  count: selectedRoomIds.size,
                })}
              </span>
              <button
                type="button"
                onClick={() => setSelectedRoomIds(new Set())}
                className="text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                <X className="size-3" />
                {t('floorMap.assign.clearSelection')}
              </button>
            </div>
          ) : (
            <p className="text-muted-foreground text-xs">
              {activeHkId
                ? t('floorMap.assign.paintHint')
                : t('floorMap.assign.pickFirst')}
            </p>
          )}

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
                  const selected = selectedRoomIds.has(room.id)
                  return (
                    <li key={room.id}>
                      <button
                        type="button"
                        onClick={() => handleRoomTap(room.id)}
                        className={cn(
                          'flex items-center gap-1.5 rounded-md border px-2 py-1 text-sm',
                          idx === undefined && !selected && 'bg-muted/40',
                          selected && 'border-primary ring-primary/40 ring-1',
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

            {hksWithRooms.length > 0 && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={toggleExpandAll}
                  className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs"
                >
                  {allExpanded ? (
                    <ChevronsDownUp className="size-3.5" />
                  ) : (
                    <ChevronsUpDown className="size-3.5" />
                  )}
                  {allExpanded
                    ? t('floorMap.assign.collapseAll')
                    : t('floorMap.assign.expandAll')}
                </button>
              </div>
            )}

            <ul className="space-y-1">
              {housekeepers.map((hk, i) => {
                const active = hk.id === activeHkId
                const rooms = byHk[hk.id] ?? []
                const expanded = expandedHks.has(hk.id)
                return (
                  <li
                    key={hk.id}
                    className={cn(
                      'rounded-md border',
                      // When rooms are staged, every housekeeper is an assign
                      // target — flag them so the click is discoverable.
                      hasSelection && 'border-primary/60 ring-primary/30 ring-1',
                    )}
                  >
                    <div
                      className={cn(
                        'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm',
                        active && 'bg-accent',
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => handleHkClick(hk.id)}
                        aria-pressed={active}
                        title={
                          hasSelection
                            ? t('floorMap.assign.assignSelectedTo', {
                                name: hk.name,
                              })
                            : undefined
                        }
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
                        onClick={() => toggleExpanded(hk.id)}
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
