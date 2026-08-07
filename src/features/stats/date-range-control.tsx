import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { StatRange } from '@/lib/queries/keys'

import { RANGE_PRESETS, type RangePreset } from './date-range'

interface DateRangeControlProps {
  preset: RangePreset
  customRange: StatRange
  onPresetChange: (preset: RangePreset) => void
  onCustomChange: (range: StatRange) => void
}

export function DateRangeControl({
  preset,
  customRange,
  onPresetChange,
  onCustomChange,
}: DateRangeControlProps) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap gap-1">
        {RANGE_PRESETS.map((p) => (
          <Button
            key={p}
            type="button"
            size="sm"
            variant={preset === p ? 'default' : 'outline'}
            onClick={() => onPresetChange(p)}
          >
            {t(`stats.range.${p}`)}
          </Button>
        ))}
        <Button
          type="button"
          size="sm"
          variant={preset === 'custom' ? 'default' : 'outline'}
          onClick={() => onPresetChange('custom')}
        >
          {t('stats.range.custom')}
        </Button>
      </div>

      {preset === 'custom' && (
        <div className="flex items-center gap-2">
          <Input
            type="date"
            aria-label={t('stats.range.from')}
            value={customRange.from ?? ''}
            max={customRange.to || undefined}
            className="h-9 w-auto"
            onChange={(e) =>
              onCustomChange({ ...customRange, from: e.target.value })
            }
          />
          <span className="text-muted-foreground text-sm">–</span>
          <Input
            type="date"
            aria-label={t('stats.range.to')}
            value={customRange.to ?? ''}
            min={customRange.from || undefined}
            className="h-9 w-auto"
            onChange={(e) =>
              onCustomChange({ ...customRange, to: e.target.value })
            }
          />
        </div>
      )}
    </div>
  )
}
