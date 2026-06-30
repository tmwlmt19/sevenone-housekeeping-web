import { Link } from 'react-router-dom'

import { PriorityBadge } from '@/components/status-badge'
import type { Task } from '@/lib/api/types'
import { formatDateTime } from '@/lib/format'

interface TaskCardProps {
  task: Task
  roomLabel: string
  assigneeName: string | null
}

export function TaskCard({ task, roomLabel, assigneeName }: TaskCardProps) {
  return (
    <Link
      to={`/tasks/${task.id}`}
      className="bg-card hover:bg-accent/50 block rounded-md border p-3 transition-colors"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">Room {roomLabel}</span>
        <PriorityBadge priority={task.priority} />
      </div>
      <p className="text-muted-foreground mt-1 text-sm">
        {assigneeName ?? 'Unassigned'}
      </p>
      {task.notes && <p className="mt-1 line-clamp-2 text-sm">{task.notes}</p>}
      {task.due_date && (
        <p className="text-muted-foreground mt-2 text-xs">
          Due {formatDateTime(task.due_date)}
        </p>
      )}
    </Link>
  )
}
