import { MonitorSmartphone } from 'lucide-react'
import { useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'

import { Card, CardContent } from '@/components/ui/card'

/** Reactively track a `(min-width: Npx)` media query. */
function useMinWidth(px: number): boolean {
  const query = `(min-width: ${px}px)`
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
    () => true,
  )
}

/**
 * The floor map is optimized for tablets and computers; a phone screen is too
 * small to work it. Below `minWidth`, show a friendly notice instead of the
 * editor (view + edit are both gated for v1).
 */
export function MinWidthGate({
  minWidth,
  children,
}: {
  minWidth: number
  children: React.ReactNode
}) {
  const { t } = useTranslation()
  const wideEnough = useMinWidth(minWidth)

  if (wideEnough) return <>{children}</>

  return (
    <Card className="mx-auto max-w-md">
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <MonitorSmartphone className="text-muted-foreground size-10" />
        <h2 className="text-lg font-semibold">
          {t('floorMap.smallScreenTitle')}
        </h2>
        <p className="text-muted-foreground text-sm">
          {t('floorMap.smallScreenBody')}
        </p>
      </CardContent>
    </Card>
  )
}
