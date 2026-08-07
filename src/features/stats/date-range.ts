import type { StatRange } from '@/lib/queries/keys'

export type RangePreset = 'today' | '7d' | '30d' | 'custom'

export const RANGE_PRESETS: Exclude<RangePreset, 'custom'>[] = [
  'today',
  '7d',
  '30d',
]

export const DEFAULT_PRESET: RangePreset = '7d'

function ymd(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Resolve a preset to an inclusive {from, to} window of local calendar dates
 * (YYYY-MM-DD). `today` is injectable for tests. 'custom' yields an empty range
 * — the caller supplies the dates. */
export function presetRange(preset: RangePreset, today: Date = new Date()): StatRange {
  const to = ymd(today)
  if (preset === 'custom') return {}
  if (preset === 'today') return { from: to, to }
  const days = preset === '7d' ? 6 : 29
  const from = new Date(today)
  from.setDate(from.getDate() - days)
  return { from: ymd(from), to }
}
