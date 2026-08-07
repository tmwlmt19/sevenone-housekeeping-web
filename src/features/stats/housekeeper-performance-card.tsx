import { useTranslation } from 'react-i18next'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { StatRange } from '@/lib/queries/keys'
import { useCleanTimes, useEfficiency } from '@/lib/queries/stats'
import { secondsToMinutes } from '@/lib/format'

import { ChartEmpty, SeriesBarChart, type BarSeries } from './charts'
import { chartColor } from './palette'

export function HousekeeperPerformanceCard({ range }: { range: StatRange }) {
  const { t } = useTranslation()
  const { data: cleanTimes, isLoading: cleanLoading } = useCleanTimes(range)
  const { data: efficiency, isLoading: effLoading } = useEfficiency(range)

  const minutes = (v: number) => `${v} m`
  const percent = (v: number) => `${Math.round(v)}%`

  // Tab A: avg clean time by room type, grouped per housekeeper.
  const perHk = cleanTimes?.by_housekeeper ?? []
  const roomTypes = Array.from(
    new Set(perHk.flatMap((h) => h.by_room_type.map((r) => r.room_type))),
  ).sort()
  const byHkRows = perHk
    .filter((h) => h.by_room_type.length > 0)
    .map((h) => {
      const row: Record<string, string | number> = { label: h.name }
      for (const r of h.by_room_type) {
        row[r.room_type] = secondsToMinutes(r.avg_seconds ?? 0)
      }
      return row
    })
  const byHkSeries: BarSeries[] = roomTypes.map((rt, i) => ({
    key: rt,
    name: rt,
    color: chartColor(i),
  }))

  // Tab B: efficiency % per housekeeper (only those who worked a shift).
  const effRows = (efficiency?.by_housekeeper ?? [])
    .filter((h) => h.shifts_worked > 0)
    .map((h) => ({ label: h.name, value: Math.round(h.efficiency_pct ?? 0) }))

  // Tab C: avg clean time by room type, hotel-wide.
  const byTypeRows = (cleanTimes?.hotel_by_room_type ?? [])
    .filter((r) => r.clean_count > 0)
    .map((r) => ({
      label: r.room_type,
      value: secondsToMinutes(r.avg_seconds ?? 0),
    }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('stats.performance.title')}</CardTitle>
        <CardDescription>{t('stats.performance.subtitle')}</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="byHousekeeper">
          <TabsList>
            <TabsTrigger value="byHousekeeper">
              {t('stats.performance.byHousekeeper')}
            </TabsTrigger>
            <TabsTrigger value="efficiency">
              {t('stats.performance.efficiency')}
            </TabsTrigger>
            <TabsTrigger value="byRoomType">
              {t('stats.performance.byRoomType')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="byHousekeeper">
            {cleanLoading ? (
              <Skeleton className="h-[280px] w-full" />
            ) : byHkRows.length === 0 ? (
              <ChartEmpty message={t('stats.noData')} />
            ) : (
              <SeriesBarChart
                data={byHkRows}
                categoryKey="label"
                series={byHkSeries}
                unit="m"
                valueFormatter={minutes}
              />
            )}
          </TabsContent>

          <TabsContent value="efficiency">
            {effLoading ? (
              <Skeleton className="h-[280px] w-full" />
            ) : effRows.length === 0 ? (
              <ChartEmpty message={t('stats.noShiftData')} />
            ) : (
              <SeriesBarChart
                data={effRows}
                categoryKey="label"
                series={[
                  {
                    key: 'value',
                    name: t('stats.performance.efficiency'),
                    color: chartColor(0),
                  },
                ]}
                unit="%"
                valueFormatter={percent}
                showValueLabels
              />
            )}
          </TabsContent>

          <TabsContent value="byRoomType">
            {cleanLoading ? (
              <Skeleton className="h-[280px] w-full" />
            ) : byTypeRows.length === 0 ? (
              <ChartEmpty message={t('stats.noData')} />
            ) : (
              <SeriesBarChart
                data={byTypeRows}
                categoryKey="label"
                series={[
                  {
                    key: 'value',
                    name: t('stats.performance.avgCleanTime'),
                    color: chartColor(0),
                  },
                ]}
                unit="m"
                valueFormatter={minutes}
                showValueLabels
              />
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
