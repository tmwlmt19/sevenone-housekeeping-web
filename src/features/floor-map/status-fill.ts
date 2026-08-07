import type { RoomStatus } from '@/lib/api/types'

// SVG fill classes per room status, mirroring the status-badge color families so
// the map and the badges read as one system. Theme-aware (light + dark).
export const STATUS_FILL: Record<RoomStatus, string> = {
  clean: 'fill-green-200 dark:fill-green-900/50',
  dirty: 'fill-amber-200 dark:fill-amber-900/50',
  in_progress: 'fill-blue-200 dark:fill-blue-900/50',
  out_of_service: 'fill-zinc-300 dark:fill-zinc-700',
}

export const STATUS_STROKE: Record<RoomStatus, string> = {
  clean: 'stroke-green-500 dark:stroke-green-500/70',
  dirty: 'stroke-amber-500 dark:stroke-amber-500/70',
  in_progress: 'stroke-blue-500 dark:stroke-blue-500/70',
  out_of_service: 'stroke-zinc-500 dark:stroke-zinc-500/70',
}
