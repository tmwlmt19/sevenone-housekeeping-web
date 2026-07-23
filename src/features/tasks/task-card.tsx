import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { PriorityBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import type { Task } from '@/lib/api/types'
import { formatDate } from '@/lib/format'
import { effectivePriority, isOverdue } from '@/lib/tasks'
import { cn } from '@/lib/utils'

interface TaskCardProps {
  task: Task
  roomLabel: string
  assigneeName: string | null
  /** Approve / send-back handlers, shown on pending-approval cards. */
  onApprove?: (taskId: string) => void
  onReject?: (taskId: string) => void
  actionsDisabled?: boolean
}

export function TaskCard({
  task,
  roomLabel,
  assigneeName,
  onApprove,
  onReject,
  actionsDisabled,
}: TaskCardProps) {
  const { t } = useTranslation()
  const showApproval =
    task.status === 'pending_approval' && onApprove && onReject
  return (
    <div className="bg-card rounded-md border">
      <Link
        to={`/tasks/${task.id}`}
        className="hover:bg-accent/50 block rounded-md p-3 transition-colors"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium">
            {t('taskCard.room', { label: roomLabel })}
          </span>
          <PriorityBadge priority={effectivePriority(task)} />
        </div>
        <p className="text-muted-foreground mt-1 text-sm">
          {assigneeName ?? t('common.unassigned')}
        </p>
        {task.notes && <p className="mt-1 line-clamp-2 text-sm">{task.notes}</p>}
        {task.due_date && (
          <p
            className={cn(
              'mt-2 text-xs',
              isOverdue(task)
                ? 'text-destructive font-medium'
                : 'text-muted-foreground',
            )}
          >
            {t('taskCard.due', { date: formatDate(task.due_date) })}
            {isOverdue(task) && ` · ${t('common.overdue')}`}
          </p>
        )}
      </Link>
      {showApproval && (
        <div className="flex gap-2 border-t p-3">
          <Button
            size="sm"
            className="flex-1"
            disabled={actionsDisabled}
            onClick={() => onApprove(task.id)}
          >
            {t('taskCard.approve')}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            disabled={actionsDisabled}
            onClick={() => onReject(task.id)}
          >
            {t('taskCard.sendBack')}
          </Button>
        </div>
      )}
    </div>
  )
}
