import { LayoutGrid, Users } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useAuth } from '@/auth/auth-context'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { FloorAssignView } from '@/features/floor-map/floor-assign-view'
import { FloorMapView } from '@/features/floor-map/floor-map-view'
import { MinWidthGate } from '@/features/floor-map/min-width-gate'

// The floor map is a tablet/desktop tool; below this width phones get a notice
// instead (see MinWidthGate). Matches Tailwind's `md` breakpoint.
const MIN_WIDTH = 768

export function FloorMapPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const isManager = user?.role === 'manager'
  // Managers switch between laying out the floor and assigning cleaning zones;
  // front desk only ever sees the read-only layout (no toggle).
  const [mode, setMode] = useState<'layout' | 'assign'>('layout')

  return (
    <div>
      <PageHeader
        title={t('floorMap.title')}
        description={t('floorMap.subtitle')}
      />
      <MinWidthGate minWidth={MIN_WIDTH}>
        {isManager && (
          <div className="mb-4 flex gap-1.5">
            <Button
              variant={mode === 'layout' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode('layout')}
            >
              <LayoutGrid className="size-4" />
              {t('floorMap.layoutMode')}
            </Button>
            <Button
              variant={mode === 'assign' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode('assign')}
            >
              <Users className="size-4" />
              {t('floorMap.assignMode')}
            </Button>
          </div>
        )}
        {isManager && mode === 'assign' ? <FloorAssignView /> : <FloorMapView />}
      </MinWidthGate>
    </div>
  )
}
