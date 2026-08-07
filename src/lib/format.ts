// Human-friendly labels and formatting for API enum values and dates.

/** "in_progress" -> "In progress" */
export function humanize(value: string): string {
  const spaced = value.replace(/_/g, ' ')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

export function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/** For <input type="date"> value (YYYY-MM-DD, local). */
export function toDateInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** date-input string (YYYY-MM-DD) -> ISO for the API, or null if empty. */
export function fromDateInput(value: string): string | null {
  if (!value) return null
  const d = new Date(`${value}T00:00:00`)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

/** Seconds of clean time -> compact label: 45 -> "45s", 1530 -> "26m",
 * 5400 -> "1h 30m". Null (no data) -> "—". */
export function formatDuration(seconds: number | null): string {
  if (seconds == null) return '—'
  const total = Math.round(seconds)
  if (total < 60) return `${total}s`
  const mins = Math.round(total / 60)
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

/** Seconds -> minutes as a number rounded to one decimal (for chart axes). */
export function secondsToMinutes(seconds: number): number {
  return Math.round((seconds / 60) * 10) / 10
}

/** A 0..100 percentage (or null) -> "38%" / "—", rounded to a whole number. */
export function formatPercent(pct: number | null): string {
  if (pct == null) return '—'
  return `${Math.round(pct)}%`
}
