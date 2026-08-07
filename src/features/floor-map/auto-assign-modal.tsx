import { Sparkles, TriangleAlert } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import type { FloorMap, Staff } from '@/lib/api/types'
import { cn } from '@/lib/utils'

import type { ZoneMap } from './assign'
import { autoAssignOptimized } from './auto-assign'
import { DEFAULT_ROOM_MINUTES, ROOM_TYPE_MINUTES } from './room-durations'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** All floors (the whole-hotel map) — the optimizer plans across every floor. */
  floors: FloorMap[]
  /** Housekeepers eligible to work (already filtered by role in the parent). */
  housekeepers: Staff[]
  /** Merge the computed zones into the running plan. */
  onApply: (zones: ZoneMap) => void
}

const DEFAULT_SHIFT_HOURS = 8

function fmt(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = Math.round(mins % 60)
  return `${h}h ${String(m).padStart(2, '0')}m`
}

function clampInt(value: string, min: number, max: number): number {
  const n = Math.round(Number(value))
  if (!Number.isFinite(n)) return min
  return Math.max(min, Math.min(max, n))
}

/**
 * Optimized auto-assign (floor-map use case #2). The manager sets who's working
 * today and each person's shift length, tweaks the per-room-type cleaning times
 * if needed (seeded from the room-durations "properties" file, edits are for this
 * run only), and previews the split live. Applying merges the resulting zones
 * into the running plan — the same `ZoneMap` shape as manual painting.
 */
export function AutoAssignModal({ open, onOpenChange, floors, housekeepers, onApply }: Props) {
  const { t } = useTranslation()

  // Roster: everyone included by default; per-person shift as hours + minutes.
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [hours, setHours] = useState<Record<string, number>>({})
  const [minutes, setMinutes] = useState<Record<string, number>>({})
  // Per-type cleaning minutes; empty until the manager overrides a value.
  const [byType, setByType] = useState<Record<string, number>>({})
  const [defaultMin, setDefaultMin] = useState<number>(DEFAULT_ROOM_MINUTES)

  const hrs = (id: string) => hours[id] ?? DEFAULT_SHIFT_HOURS
  const mns = (id: string) => minutes[id] ?? 0
  const included = (id: string) => !excluded.has(id)

  // Every room type present in the hotel, plus the file's known types.
  const typeRows = useMemo(() => {
    const present = new Set<string>(Object.keys(ROOM_TYPE_MINUTES))
    for (const f of floors) for (const r of f.rooms) if (r.room_type) present.add(r.room_type)
    return [...present].sort()
  }, [floors])

  const durationOf = (type: string) => byType[type] ?? ROOM_TYPE_MINUTES[type] ?? defaultMin

  const roster = useMemo(
    () =>
      housekeepers
        .filter((h) => included(h.id))
        .map((h) => ({ id: h.id, shiftMinutes: hrs(h.id) * 60 + mns(h.id) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [housekeepers, excluded, hours, minutes],
  )

  const result = useMemo(() => {
    const effective: Record<string, number> = {}
    for (const type of typeRows) effective[type] = durationOf(type)
    return autoAssignOptimized(floors, roster, { byType: effective, default: defaultMin })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [floors, roster, typeRows, byType, defaultMin])

  const assignedCount = Object.keys(result.zones).length
  const loadFor = (id: string) => result.load[id] ?? 0
  const roomsFor = (id: string) =>
    Object.values(result.zones).filter((hk) => hk === id).length

  function toggle(id: string) {
    setExcluded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function apply() {
    onApply(result.zones)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4" />
            {t('floorMap.autoAssign.title')}
          </DialogTitle>
          <DialogDescription>{t('floorMap.autoAssign.description')}</DialogDescription>
        </DialogHeader>

        {housekeepers.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t('importRooms.noHousekeepers')}</p>
        ) : (
          <div className="space-y-5">
            {/* Roster + shifts */}
            <section className="space-y-2">
              <h3 className="text-sm font-medium">{t('floorMap.autoAssign.workingToday')}</h3>
              <ul className="space-y-1.5">
                {housekeepers.map((h) => (
                  <li
                    key={h.id}
                    className={cn(
                      'flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm',
                      !included(h.id) && 'opacity-50',
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={included(h.id)}
                      onChange={() => toggle(h.id)}
                      aria-label={t('floorMap.autoAssign.includeName', { name: h.name })}
                      className="size-4"
                    />
                    <span className="flex-1 truncate">{h.name}</span>
                    <Input
                      type="number"
                      min={0}
                      max={24}
                      value={hrs(h.id)}
                      disabled={!included(h.id)}
                      onChange={(e) =>
                        setHours((p) => ({ ...p, [h.id]: clampInt(e.target.value, 0, 24) }))
                      }
                      aria-label={t('floorMap.autoAssign.shiftHours', { name: h.name })}
                      className="h-8 w-16"
                    />
                    <span className="text-muted-foreground text-xs">{t('floorMap.autoAssign.hoursShort')}</span>
                    <Input
                      type="number"
                      min={0}
                      max={59}
                      value={mns(h.id)}
                      disabled={!included(h.id)}
                      onChange={(e) =>
                        setMinutes((p) => ({ ...p, [h.id]: clampInt(e.target.value, 0, 59) }))
                      }
                      aria-label={t('floorMap.autoAssign.shiftMinutes', { name: h.name })}
                      className="h-8 w-16"
                    />
                    <span className="text-muted-foreground text-xs">{t('floorMap.autoAssign.minutesShort')}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* Cleaning times */}
            <section className="space-y-2">
              <h3 className="text-sm font-medium">{t('floorMap.autoAssign.cleaningTimes')}</h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {typeRows.map((type) => (
                  <label key={type} className="flex items-center gap-2 text-sm">
                    <span className="flex-1 truncate font-mono text-xs">{type}</span>
                    <Input
                      type="number"
                      min={1}
                      value={durationOf(type)}
                      onChange={(e) =>
                        setByType((p) => ({ ...p, [type]: clampInt(e.target.value, 1, 600) }))
                      }
                      className="h-8 w-16"
                    />
                  </label>
                ))}
                <label className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground flex-1 truncate text-xs">
                    {t('floorMap.autoAssign.defaultType')}
                  </span>
                  <Input
                    type="number"
                    min={1}
                    value={defaultMin}
                    onChange={(e) => setDefaultMin(clampInt(e.target.value, 1, 600))}
                    className="h-8 w-16"
                  />
                </label>
              </div>
            </section>

            {/* Preview */}
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">{t('floorMap.autoAssign.preview')}</h3>
                <span className="text-muted-foreground text-xs">
                  {t('floorMap.autoAssign.workVsShift', {
                    work: fmt(result.totalWorkMinutes),
                    shift: fmt(result.totalShiftMinutes),
                  })}
                </span>
              </div>
              <ul className="space-y-1">
                {housekeepers.filter((h) => included(h.id)).map((h) => (
                  <li key={h.id} className="flex items-center justify-between text-sm">
                    <span className="truncate">{h.name}</span>
                    <span className="text-muted-foreground tabular-nums text-xs">
                      {t('floorMap.autoAssign.perHk', {
                        count: roomsFor(h.id),
                        time: fmt(loadFor(h.id)),
                      })}
                    </span>
                  </li>
                ))}
              </ul>
              {result.overflow.length > 0 && (
                <p className="text-destructive flex items-center gap-1.5 text-xs">
                  <TriangleAlert className="size-3.5 shrink-0" />
                  {t('floorMap.autoAssign.overflow', { count: result.overflow.length })}
                </p>
              )}
            </section>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="button" disabled={assignedCount === 0} onClick={apply}>
            {t('floorMap.autoAssign.apply', { count: assignedCount })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
