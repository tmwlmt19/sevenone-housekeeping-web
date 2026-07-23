import { Download, Upload } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
import { useRooms } from '@/lib/queries/rooms'
import { useStaff } from '@/lib/queries/staff'
import { useImportDirtyRooms } from '@/lib/queries/tasks'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ImportDirtyRoomsModal({ open, onOpenChange }: Props) {
  const { t } = useTranslation()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { data: rooms } = useRooms()
  const { data: staff } = useStaff()
  const importRooms = useImportDirtyRooms()

  const [fileName, setFileName] = useState('')
  const [roomNumbers, setRoomNumbers] = useState<string[]>([])
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

  function handleSubmit() {
    importRooms.mutate(
      {
        rooms: known,
        housekeeper_ids: [...selected],
        priority,
      },
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
        onError: (err: unknown) =>
          toast.error(
            err instanceof ApiError
              ? err.message
              : t('common.somethingWentWrong'),
          ),
      },
    )
  }

  const hasUnknown = unknown.length > 0
  const canSubmit =
    known.length > 0 && !hasUnknown && !importRooms.isPending

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

          {/* Housekeepers */}
          {roomNumbers.length > 0 && (
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
          )}

          {/* Priority */}
          {roomNumbers.length > 0 && (
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
          <Button type="button" disabled={!canSubmit} onClick={handleSubmit}>
            {importRooms.isPending
              ? t('importRooms.importing')
              : t('importRooms.createTasks', { count: known.length })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
