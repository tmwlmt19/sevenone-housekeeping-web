import { Badge } from '@/components/ui/badge'
import type { RoomStatus, TaskPriority, TaskStatus } from '@/lib/api/types'
import { humanize } from '@/lib/format'
import { cn } from '@/lib/utils'

const ROOM_STATUS_CLASS: Record<RoomStatus, string> = {
  clean: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  dirty: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  in_progress:
    'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  out_of_service:
    'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
}

const TASK_STATUS_CLASS: Record<TaskStatus, string> = {
  pending: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  assigned:
    'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300',
  in_progress:
    'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  completed:
    'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
}

const PRIORITY_CLASS: Record<TaskPriority, string> = {
  low: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  normal: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  urgent: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
}

function StatusBadge({
  label,
  className,
}: {
  label: string
  className: string
}) {
  return (
    <Badge variant="secondary" className={cn('border-transparent', className)}>
      {label}
    </Badge>
  )
}

export function RoomStatusBadge({ status }: { status: RoomStatus }) {
  return (
    <StatusBadge
      label={humanize(status)}
      className={ROOM_STATUS_CLASS[status]}
    />
  )
}

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return (
    <StatusBadge
      label={humanize(status)}
      className={TASK_STATUS_CLASS[status]}
    />
  )
}

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  return (
    <StatusBadge
      label={humanize(priority)}
      className={PRIORITY_CLASS[priority]}
    />
  )
}
