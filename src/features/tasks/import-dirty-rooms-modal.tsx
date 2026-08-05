import { Download, Map, Upload, Users } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ApiError } from '@/lib/api/unwrap'
import type { TaskPriority } from '@/lib/api/types'
import { TASK_PRIORITIES } from '@/lib/api/types'
import {
  DIRTY_ROOMS_TEMPLATE,
  downloadText,
  evenSplit,
  parseDirtyRoomsCsv,
} from '@/lib/csv/dirty-rooms'
import { cn } from '@/lib/utils'
import { useRooms } from '@/lib/queries/rooms'
import { useStaff } from '@/lib/queries/staff'
import { useImportDirtyRooms } from '@/lib/queries/tasks'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

// How the uploaded rooms become work: split evenly across housekeepers now, or
// mark them dirty and hand-assign them on the floor map.
type Method = 'auto' | 'map'

export function ImportDirtyRoomsModal({ open, onOpenChange }: Props) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { data: rooms } = useRooms()
  const { data: staff } = useStaff()
  const importRooms = useImportDirtyRooms()

  const [fileName, setFileName] = useState('')
  const [roomNumbers, setRoomNumbers] = useState<string[]>([])
  const [method, setMethod] = useState<Method>('auto')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [priority, setPriority] = useState<TaskPriority>('normal')

  const housekeepers = useMemo(
    () => (staff ?? []).filter((s) => s.role === 'housekeeper'),
    [staff],
  )

  // Validate parsed numbers against the hotel's rooms (server stays authoritative).
  const { known, unknown } = useMemo(() => {
    const roomSet = new Set((rooms ?? []).map((r) => r.room_number))
    const known: string[] = []
    const unknown: string[] = []
    for (const n of roomNumbers) (roomSet.has(n) ? known : unknown).push(n)
    return { known, unknown }
  }, [roomNumbers, rooms])

  const splitPreview = useMemo(() => {
    if (selected.size === 0) return null
    return evenSplit(known.length, selected.size)
  }, [known.length, selected.size])

  function reset() {
    setFileName('')
    setRoomNumbers([])
    setMethod('auto')
    setSelected(new Set())
    setPriority('normal')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleClose(next: boolean) {
    if (!next) reset()
    onOpenChange(next)
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    try {
      setRoomNumbers(await parseDirtyRoomsCsv(file))
    } catch {
      toast.error(t('importRooms.parseError'))
      setRoomNumbers([])
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function onError(err: unknown) {
    toast.error(
      err instanceof ApiError ? err.message : t('common.somethingWentWrong'),
    )
  }

  // Auto-assign: create tasks now, split evenly across the chosen housekeepers.
  function handleAutoSubmit() {
    importRooms.mutate(
      { rooms: known, housekeeper_ids: [...selected], priority },
      {
        onSuccess: (res) => {
          const parts = [
            t('importRooms.createdCount', { count: res.tasks_created }),
          ]
          if (res.skipped.length > 0) {
            parts.push(
              t('importRooms.skippedCount', { count: res.skipped.length }),
            )
          }
          toast.success(parts.join(' · '))
          handleClose(false)
        },
        onError,
      },
    )
  }

  // Assign on the map: mark the rooms dirty (no tasks yet), then jump to the
  // floor map's assign view to group and assign them there.
  function handleMapSubmit() {
    importRooms.mutate(
      { rooms: known, create_tasks: false },
      {
        onSuccess: (res) => {
          toast.success(
            t('importRooms.markedDirtyCount', { count: res.rooms_set_dirty }),
          )
          handleClose(false)
          navigate('/rooms?view=map&mode=assign')
        },
        onError,
      },
    )
  }

  const hasUnknown = unknown.length > 0
  const canSubmit = known.length > 0 && !hasUnknown && !importRooms.isPending
  const hasRooms = roomNumbers.length > 0

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('importRooms.title')}</DialogTitle>
          <DialogDescription>{t('importRooms.subtitle')}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Upload + template */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="size-4" />
              {t('importRooms.chooseFile')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                downloadText('dirty-rooms-template.csv', DIRTY_ROOMS_TEMPLATE)
              }
            >
              <Download className="size-4" />
              {t('importRooms.downloadTemplate')}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={handleFile}
            />
          </div>
          {fileName && (
            <p className="text-muted-foreground text-sm">
              {t('importRooms.parsedSummary', {
                file: fileName,
                count: roomNumbers.length,
              })}
            </p>
          )}

          {hasUnknown && (
            <p className="text-destructive text-sm" role="alert">
              {t('importRooms.unknownRooms', {
                count: unknown.length,
                rooms: unknown.slice(0, 8).join(', '),
              })}
            </p>
          )}

          {/* Assignment method */}
          {hasRooms && (
            <div className="flex flex-col gap-2">
              <Label>{t('importRooms.method')}</Label>
              <div className="grid grid-cols-2 gap-2">
                <MethodCard
                  icon={Users}
                  title={t('importRooms.methodAuto')}
                  hint={t('importRooms.methodAutoHint')}
                  active={method === 'auto'}
                  onClick={() => setMethod('auto')}
                />
                <MethodCard
                  icon={Map}
                  title={t('importRooms.methodMap')}
                  hint={t('importRooms.methodMapHint')}
                  active={method === 'map'}
                  onClick={() => setMethod('map')}
                />
              </div>
            </div>
          )}

          {/* Auto: housekeepers + priority */}
          {hasRooms && method === 'auto' && (
            <>
              <div className="flex flex-col gap-2">
                <Label>{t('importRooms.assignTo')}</Label>
                <p className="text-muted-foreground text-xs">
                  {t('importRooms.assignHint')}
                </p>
                <div className="flex max-h-48 flex-col gap-1 overflow-y-auto rounded-md border p-2">
                  {housekeepers.length === 0 && (
                    <p className="text-muted-foreground p-1 text-sm">
                      {t('importRooms.noHousekeepers')}
                    </p>
                  )}
                  {housekeepers.map((h) => (
                    <label
                      key={h.id}
                      className="hover:bg-accent flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(h.id)}
                        onChange={() => toggle(h.id)}
                      />
                      {h.name}
                    </label>
                  ))}
                </div>
                {splitPreview && known.length > 0 && (
                  <p className="text-muted-foreground text-xs">
                    {t('importRooms.splitPreview', {
                      min: splitPreview[splitPreview.length - 1],
                      max: splitPreview[0],
                      people: selected.size,
                    })}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3">
                <Label htmlFor="import-priority">
                  {t('importRooms.priority')}
                </Label>
                <Select
                  value={priority}
                  onValueChange={(v) => setPriority(v as TaskPriority)}
                >
                  <SelectTrigger id="import-priority" className="w-40">
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
            </>
          )}

          {/* Map: brief explanation of what happens next */}
          {hasRooms && method === 'map' && (
            <p className="text-muted-foreground rounded-md border bg-muted/30 p-3 text-sm">
              {t('importRooms.mapExplainer', { count: known.length })}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleClose(false)}
          >
            {t('common.cancel')}
          </Button>
          {method === 'auto' ? (
            <Button type="button" disabled={!canSubmit} onClick={handleAutoSubmit}>
              {importRooms.isPending
                ? t('importRooms.importing')
                : t('importRooms.createTasks', { count: known.length })}
            </Button>
          ) : (
            <Button type="button" disabled={!canSubmit} onClick={handleMapSubmit}>
              {importRooms.isPending
                ? t('importRooms.importing')
                : t('importRooms.markDirtyAndAssign')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function MethodCard({
  icon: Icon,
  title,
  hint,
  active,
  onClick,
}: {
  icon: typeof Users
  title: string
  hint: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex flex-col gap-1 rounded-md border p-3 text-left',
        active ? 'border-primary bg-accent' : 'hover:bg-accent',
      )}
    >
      <span className="flex items-center gap-1.5 text-sm font-medium">
        <Icon className="size-4" />
        {title}
      </span>
      <span className="text-muted-foreground text-xs">{hint}</span>
    </button>
  )
}

/** A button that opens the dirty-room CSV import modal. Drop it on any
 * manager/admin page (dashboard, tasks). */
export function ImportDirtyRoomsButton() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Upload className="size-4" />
        {t('importRooms.trigger')}
      </Button>
      <ImportDirtyRoomsModal open={open} onOpenChange={setOpen} />
    </>
  )
}
