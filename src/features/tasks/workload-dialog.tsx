import { ChevronDown, Users } from 'lucide-react'
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
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { useRedistributeWorkload } from '@/lib/queries/tasks'
import { useStaff } from '@/lib/queries/staff'

/**
 * Move a housekeeper's open tasks when they call in or don't show. Pick who's
 * out ("From"), then pick who covers ("To"): choose one housekeeper to hand it
 * all to, several to spread it across, or none to split it evenly across
 * everyone else. Available to hotel ops.
 */
export function WorkloadDialog() {
  const { t } = useTranslation()
  const { data: staff } = useStaff()
  const redistribute = useRedistributeWorkload()

  const [open, setOpen] = useState(false)
  const [from, setFrom] = useState('')
  // Chosen covering housekeepers. Empty = spread across everyone else.
  const [to, setTo] = useState<string[]>([])

  const housekeepers = useMemo(
    () => (staff ?? []).filter((s) => s.role === 'housekeeper'),
    [staff],
  )
  // Can't hand tasks back to the person who's out.
  const targets = housekeepers.filter((h) => h.id !== from)
  const pending = redistribute.isPending

  const reset = () => {
    setFrom('')
    setTo([])
  }

  const toggleTarget = (id: string) =>
    setTo((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )

  // Trigger label: the chosen names, or the "everyone else" default when empty.
  const toLabel = useMemo(() => {
    if (to.length === 0) return t('workload.everyoneElse')
    const byId = new Map(housekeepers.map((h) => [h.id, h.name]))
    return to.map((id) => byId.get(id) ?? '').join(', ')
  }, [to, housekeepers, t])

  const onDone = (result: WorkloadMoveResponse) => {
    toast.success(t('workload.moved', { count: result.tasks_moved }))
    setOpen(false)
    reset()
  }
  const onError = (e: unknown) =>
    toast.error(e instanceof ApiError ? e.message : t('workload.failed'))

  const submit = () => {
    if (!from) return
    redistribute.mutate(
      {
        from_housekeeper_id: from,
        // Omit when empty so the backend spreads across everyone else.
        to_housekeeper_ids: to.length > 0 ? to : undefined,
      },
      { onSuccess: onDone, onError },
    )
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
      <DialogContent
        // Lock the modal to the X button / Cancel only. Reassigning a workload
        // is a multi-step selection; clicking away to dismiss the From/To
        // dropdowns (or hitting Escape) used to close the whole dialog and lose
        // the in-progress picks.
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
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
                  // Keep targets valid: drop the newly-out person if selected.
                  setTo((prev) => prev.filter((id) => id !== v))
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild disabled={!from}>
                  <Button
                    variant="outline"
                    className="w-full justify-between font-normal"
                  >
                    <span className="truncate">{toLabel}</span>
                    <ChevronDown className="size-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="w-[var(--radix-dropdown-menu-trigger-width)]"
                >
                  {targets.map((h) => (
                    <DropdownMenuCheckboxItem
                      key={h.id}
                      checked={to.includes(h.id)}
                      // Keep the menu open while picking several.
                      onSelect={(e) => e.preventDefault()}
                      onCheckedChange={() => toggleTarget(h.id)}
                    >
                      {h.name}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <p className="text-muted-foreground text-xs">
                {t('workload.toHint')}
              </p>
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
