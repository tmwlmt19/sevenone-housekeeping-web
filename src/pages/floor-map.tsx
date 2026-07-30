import { useTranslation } from 'react-i18next'

import { PageHeader } from '@/components/page-header'
import { FloorMapView } from '@/features/floor-map/floor-map-view'
import { MinWidthGate } from '@/features/floor-map/min-width-gate'

// The floor map is a tablet/desktop tool; below this width phones get a notice
// instead (see MinWidthGate). Matches Tailwind's `md` breakpoint.
const MIN_WIDTH = 768

export function FloorMapPage() {
  const { t } = useTranslation()
  return (
    <div>
      <PageHeader
        title={t('floorMap.title')}
        description={t('floorMap.subtitle')}
      />
      <MinWidthGate minWidth={MIN_WIDTH}>
        <FloorMapView />
      </MinWidthGate>
    </div>
  )
}
