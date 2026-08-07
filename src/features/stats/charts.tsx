import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { cn } from '@/lib/utils'

import type { Slice } from './palette'

export interface BarSeries {
  key: string
  name: string
  color: string
}

interface TooltipEntry {
  name?: string
  value?: number
  dataKey?: string | number
  color?: string
}

interface ChartTooltipProps {
  active?: boolean
  payload?: TooltipEntry[]
  label?: string | number
  valueFormatter?: (value: number) => string
}

/** Themed tooltip (Recharts' default is a hard-coded white box). Identity is
 * carried by the swatch + name; the value wears the foreground ink token. */
function ChartTooltip({
  active,
  payload,
  label,
  valueFormatter,
}: ChartTooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-popover rounded-md border px-3 py-2 text-xs shadow-md">
      {label != null && (
        <p className="text-popover-foreground mb-1 font-medium">{label}</p>
      )}
      {payload.map((entry) => (
        <div
          key={String(entry.dataKey ?? entry.name)}
          className="text-muted-foreground flex items-center gap-2"
        >
          <span
            className="size-2 rounded-[2px]"
            style={{ background: entry.color }}
            aria-hidden
          />
          <span>{entry.name}</span>
          <span className="text-foreground ml-auto pl-3 font-medium tabular-nums">
            {valueFormatter && entry.value != null
              ? valueFormatter(entry.value)
              : entry.value}
          </span>
        </div>
      ))}
    </div>
  )
}

const legendFormatter = (value: string) => (
  <span className="text-muted-foreground text-xs">{value}</span>
)

const AXIS_TICK = { fill: 'var(--muted-foreground)', fontSize: 12 }

export interface SeriesBarChartProps {
  data: Array<Record<string, string | number>>
  categoryKey: string
  series: BarSeries[]
  /** Axis-tick suffix, e.g. "m" or "%". */
  unit?: string
  valueFormatter?: (value: number) => string
  /** Show the value on top of each bar (single-series charts). */
  showValueLabels?: boolean
  height?: number
}

export function SeriesBarChart({
  data,
  categoryKey,
  series,
  unit,
  valueFormatter,
  showValueLabels = false,
  height = 280,
}: SeriesBarChartProps) {
  const showLegend = series.length > 1
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 16, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey={categoryKey}
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={{ stroke: 'var(--border)' }}
          interval={0}
        />
        <YAxis
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          width={44}
          tickFormatter={(v: number) => `${v}${unit ?? ''}`}
        />
        <Tooltip
          cursor={{ fill: 'var(--muted)', opacity: 0.4 }}
          content={<ChartTooltip valueFormatter={valueFormatter} />}
        />
        {showLegend && (
          <Legend formatter={legendFormatter} iconType="circle" iconSize={8} />
        )}
        {series.map((s) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.name}
            fill={s.color}
            radius={[4, 4, 0, 0]}
            maxBarSize={56}
          >
            {showValueLabels && (
              <LabelList
                dataKey={s.key}
                position="top"
                className="fill-muted-foreground"
                fontSize={11}
                formatter={(value) =>
                  valueFormatter ? valueFormatter(Number(value)) : String(value)
                }
              />
            )}
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

export interface CategoryPieChartProps {
  data: Slice[]
  colors: string[]
  valueFormatter?: (value: number) => string
  height?: number
}

export function CategoryPieChart({
  data,
  colors,
  valueFormatter,
  height = 280,
}: CategoryPieChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius="55%"
          outerRadius="85%"
          paddingAngle={2}
          stroke="var(--card)"
          strokeWidth={2}
        >
          {data.map((slice, i) => (
            <Cell key={slice.name} fill={colors[i % colors.length]} />
          ))}
        </Pie>
        <Tooltip content={<ChartTooltip valueFormatter={valueFormatter} />} />
        <Legend formatter={legendFormatter} iconType="circle" iconSize={8} />
      </PieChart>
    </ResponsiveContainer>
  )
}

export function ChartEmpty({
  message,
  className,
}: {
  message: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'text-muted-foreground flex h-[280px] items-center justify-center text-center text-sm',
        className,
      )}
    >
      {message}
    </div>
  )
}
