import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { StatRange } from '@/lib/queries/keys'
import { useTaskLoad } from '@/lib/queries/stats'
import { formatPercent } from '@/lib/format'

import {
  CategoryPieChart,
  ChartEmpty,
  SeriesBarChart,
} from './charts'
import { chartColor, foldToOther, type Slice } from './palette'

type ChartType = 'bar' | 'pie'

export function TaskLoadCard({ range }: { range: StatRange }) {
  const { t } = useTranslation()
  const [chartType, setChartType] = useState<ChartType>('bar')
  const { data, isLoading } = useTaskLoad(range)

  const load = data?.by_housekeeper ?? []
  const count = (v: number) => String(v)

  function MetricChart({ slices, label }: { slices: Slice[]; label: string }) {
    if (!slices.some((s) => s.value > 0)) {
      return <ChartEmpty message={t('stats.noData')} className="h-[240px]" />
    }
    if (chartType === 'pie') {
      const pie = foldToOther(slices, t('stats.other'))
      return (
        <CategoryPieChart
          data={pie}
          colors={pie.map((_, i) => chartColor(i))}
          valueFormatter={count}
          height={240}
        />
      )
    }
    return (
      <SeriesBarChart
        data={slices.map((s) => ({ label: s.name, value: s.value }))}
        categoryKey="label"
        series={[{ key: 'value', name: label, color: chartColor(0) }]}
        valueFormatter={count}
        showValueLabels
        height={240}
      />
    )
  }

  const openTasks: Slice[] = load.map((h) => ({
    name: h.name,
    value: h.open_tasks,
  }))
  const completed: Slice[] = load.map((h) => ({
    name: h.name,
    value: h.tasks_completed,
  }))
  const utilRows = load
    .filter((h) => h.shift_seconds_total > 0)
    .map((h) => ({
      label: h.name,
      value: Math.round(h.utilization_pct ?? 0),
    }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('stats.taskLoad.title')}</CardTitle>
        <CardDescription>{t('stats.taskLoad.subtitle')}</CardDescription>
        <CardAction>
          <div className="bg-muted inline-flex rounded-lg p-1">
            {(['bar', 'pie'] as const).map((type) => (
              <Button
                key={type}
                type="button"
                size="sm"
                variant={chartType === type ? 'default' : 'ghost'}
                className="h-7"
                onClick={() => setChartType(type)}
              >
                {t(`stats.taskLoad.${type}`)}
              </Button>
            ))}
          </div>
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-col gap-8">
        {isLoading ? (
          <Skeleton className="h-[240px] w-full" />
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-medium">
                {t('stats.taskLoad.open')}
              </h3>
              <MetricChart
                slices={openTasks}
                label={t('stats.taskLoad.open')}
              />
            </div>
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-medium">
                {t('stats.taskLoad.completed')}
              </h3>
              <MetricChart
                slices={completed}
                label={t('stats.taskLoad.completed')}
              />
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3 border-t pt-6">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-semibold tabular-nums">
                {isLoading
                  ? '—'
                  : formatPercent(data?.hotel_utilization_pct ?? null)}
              </span>
              <span className="text-muted-foreground text-sm">
                {t('stats.taskLoad.hotelUtilization')}
              </span>
            </div>
            <p className="text-muted-foreground mt-1 text-xs">
              {t('stats.taskLoad.utilizationHint')}
            </p>
          </div>

          {!isLoading &&
            (utilRows.length === 0 ? (
              <ChartEmpty
                message={t('stats.noShiftData')}
                className="h-[200px]"
              />
            ) : (
              <SeriesBarChart
                data={utilRows}
                categoryKey="label"
                series={[
                  {
                    key: 'value',
                    name: t('stats.taskLoad.utilization'),
                    color: chartColor(1),
                  },
                ]}
                unit="%"
                valueFormatter={(v) => `${v}%`}
                showValueLabels
                height={200}
              />
            ))}
        </div>
      </CardContent>
    </Card>
  )
}
