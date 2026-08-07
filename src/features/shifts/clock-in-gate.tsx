import type { ReactNode } from 'react'
import { Clock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ApiError } from '@/lib/api/unwrap'
import { useClockIn, useCurrentShift } from '@/lib/queries/shifts'

/** Housekeeper clock-in gate: blocks work until the housekeeper starts a shift.
 * Clock-out is logout (handled server-side), so there's no clock-out button. */
export function ClockInGate({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const { data, isLoading } = useCurrentShift()
  const clockIn = useClockIn()

  if (isLoading) {
    return <Skeleton className="h-48 w-full" />
  }

  if (data?.shift) {
    return <>{children}</>
  }

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center">
      <div className="flex flex-col items-center gap-3">
        <div className="bg-muted text-muted-foreground flex size-14 items-center justify-center rounded-full">
          <Clock className="size-7" />
        </div>
        <h2 className="text-lg font-semibold">{t('clock.gateTitle')}</h2>
        <p className="text-muted-foreground max-w-xs text-sm">
          {t('clock.gateBody')}
        </p>
      </div>
      <Button
        size="lg"
        disabled={clockIn.isPending}
        onClick={() =>
          clockIn.mutate(undefined, {
            onSuccess: () => toast.success(t('clock.clockedIn')),
            onError: (e) =>
              toast.error(
                e instanceof ApiError
                  ? e.message
                  : t('common.somethingWentWrong'),
              ),
          })
        }
      >
        {clockIn.isPending ? t('clock.clockingIn') : t('clock.clockIn')}
      </Button>
    </div>
  )
}

function shiftStartTime(startedAt: string): string {
  return new Date(startedAt).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** Inline "on shift" indicator, shown in the header on tablet/desktop widths
 * where there's room beside the wordmark. Phones use {@link OnShiftBanner}. */
export function OnShiftIndicator() {
  const { t } = useTranslation()
  const { data } = useCurrentShift()
  if (!data?.shift) return null
  return (
    <span className="text-muted-foreground hidden items-center gap-1.5 text-xs sm:flex">
      <span className="size-2 rounded-full bg-emerald-500" aria-hidden />
      {t('clock.onShiftSince', { time: shiftStartTime(data.shift.started_at) })}
    </span>
  )
}

/** Full-width "active since" strip under the header on phones — the same
 * on-shift info as {@link OnShiftIndicator} in a distinct, roomier mobile
 * display, since the inline version would crowd the narrow header. */
export function OnShiftBanner() {
  const { t } = useTranslation()
  const { data } = useCurrentShift()
  if (!data?.shift) return null
  return (
    <div className="bg-muted/50 text-muted-foreground flex items-center gap-2 border-b px-4 py-1.5 text-xs sm:hidden">
      <span className="size-2 rounded-full bg-emerald-500" aria-hidden />
      {t('clock.activeSince', { time: shiftStartTime(data.shift.started_at) })}
    </div>
  )
}
