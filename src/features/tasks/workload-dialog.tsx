import { Users } from 'lucide-react'
import { useMemo, useState } from 'react'
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
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { WorkloadMoveResponse } from '@/lib/api/types'
import { ApiError } from '@/lib/api/unwrap'
import {
  useReassignWorkload,
  useRedistributeWorkload,
} from '@/lib/queries/tasks'
import { useStaff } from '@/lib/queries/staff'

/** "Everyone else (split evenly)" sentinel for the To select. */
const SPLIT = '__split__'

/**
 * Move a housekeeper's open tasks when they call in or don't show. Pick who's
 * out ("From"); "To" is either a single covering housekeeper (reassign) or
 * everyone else, split evenly (redistribute). Available to hotel ops.
 */
export function WorkloadDialog() {
  const { t } = useTranslation()
  const { data: staff } = useStaff()
  const reassign = useReassignWorkload()
  const redistribute = useRedistributeWorkload()

  const [open, setOpen] = useState(false)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState(SPLIT)

  const housekeepers = useMemo(
    () => (staff ?? []).filter((s) => s.role === 'housekeeper'),
    [staff],
  )
  // Can't reassign onto the person who's out.
  const targets = housekeepers.filter((h) => h.id !== from)
  const pending = reassign.isPending || redistribute.isPending

  const reset = () => {
    setFrom('')
    setTo(SPLIT)
  }

  const onDone = (result: WorkloadMoveResponse) => {
    toast.success(t('workload.moved', { count: result.tasks_moved }))
    setOpen(false)
    reset()
  }
  const onError = (e: unknown) =>
    toast.error(e instanceof ApiError ? e.message : t('workload.failed'))

  const submit = () => {
    if (!from) return
    if (to === SPLIT) {
      redistribute.mutate(
        { from_housekeeper_id: from },
        { onSuccess: onDone, onError },
      )
    } else {
      reassign.mutate(
        { from_housekeeper_id: from, to_housekeeper_id: to },
        { onSuccess: onDone, onError },
      )
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) reset()
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <Users className="size-4" />
          {t('workload.trigger')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('workload.title')}</DialogTitle>
          <DialogDescription>{t('workload.description')}</DialogDescription>
        </DialogHeader>

        {housekeepers.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {t('workload.noHousekeepers')}
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label>{t('workload.from')}</Label>
              <Select
                value={from}
                onValueChange={(v) => {
                  setFrom(v)
                  // Keep To valid if it now points at the person who's out.
                  if (v === to) setTo(SPLIT)
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('workload.fromPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {housekeepers.map((h) => (
                    <SelectItem key={h.id} value={h.id}>
                      {h.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label>{t('workload.to')}</Label>
              <Select value={to} onValueChange={setTo} disabled={!from}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SPLIT}>
                    {t('workload.everyoneElse')}
                  </SelectItem>
                  {targets.map((h) => (
                    <SelectItem key={h.id} value={h.id}>
                      {h.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            {t('common.cancel')}
          </Button>
          <Button
            onClick={submit}
            disabled={!from || pending || housekeepers.length === 0}
          >
            {pending ? t('workload.moving') : t('workload.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
