import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { PageHeader } from '@/components/page-header'
import { DateRangeControl } from '@/features/stats/date-range-control'
import {
  DEFAULT_PRESET,
  presetRange,
  type RangePreset,
} from '@/features/stats/date-range'
import { HousekeeperPerformanceCard } from '@/features/stats/housekeeper-performance-card'
import { TaskLoadCard } from '@/features/stats/task-load-card'
import type { StatRange } from '@/lib/queries/keys'

export function DashboardPage() {
  const { t } = useTranslation()
  const [preset, setPreset] = useState<RangePreset>(DEFAULT_PRESET)
  const [customRange, setCustomRange] = useState<StatRange>({})
  // presetRange builds a fresh object each render, but TanStack hashes query
  // keys by value, so identical windows don't refetch.
  const range = preset === 'custom' ? customRange : presetRange(preset)

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={t('stats.title')}
        description={t('stats.subtitle')}
        action={
          <DateRangeControl
            preset={preset}
            customRange={customRange}
            onPresetChange={setPreset}
            onCustomChange={setCustomRange}
          />
        }
      />
      <HousekeeperPerformanceCard range={range} />
      <TaskLoadCard range={range} />
    </div>
  )
}
