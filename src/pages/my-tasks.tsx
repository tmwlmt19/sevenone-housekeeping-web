import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { useAuth } from '@/auth/auth-context'
import { PageHeader } from '@/components/page-header'
import { PriorityBadge, TaskStatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { Task, TaskStatus } from '@/lib/api/types'
import { ApiError } from '@/lib/api/unwrap'
import { formatDate } from '@/lib/format'
import { compareTasks, effectivePriority, isOverdue } from '@/lib/tasks'
import { cn } from '@/lib/utils'
import { useRooms } from '@/lib/queries/rooms'
import { useTasks, useUpdateTaskStatus } from '@/lib/queries/tasks'

export function MyTasksPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { data: tasks, isLoading } = useTasks({ assignedTo: user?.id })
  const { data: rooms } = useRooms()
  const updateStatus = useUpdateTaskStatus()

  const roomLabel = (roomId: string) =>
    rooms?.find((r) => r.id === roomId)?.room_number ?? '—'

  function changeStatus(task: Task, status: TaskStatus) {
    updateStatus.mutate(
      { taskId: task.id, status },
      {
        onSuccess: (updated) => {
          // Completing can route to pending_approval (unless the hotel
          // auto-approves), so message off the actual resulting status.
          const message =
            updated.status === 'pending_approval'
              ? t('myTasks.submittedForApproval')
              : updated.status === 'in_progress'
                ? t('myTasks.started')
                : t('myTasks.taskCompleted')
          toast.success(message)
        },
        onError: (e) =>
          toast.error(
            e instanceof ApiError ? e.message : t('common.updateFailed'),
          ),
      },
    )
  }

  // Status first, then urgency within the status (overdue counts as urgent).
  const sorted = [...(tasks ?? [])].sort(compareTasks)

  return (
    <div>
      <PageHeader title={t('myTasks.title')} />

      {isLoading && <Skeleton className="h-40 w-full" />}

      {!isLoading && sorted.length === 0 && (
        <p className="text-muted-foreground py-12 text-center text-sm">
          {t('myTasks.none')}
        </p>
      )}

      <div className="flex flex-col gap-3">
        {sorted.map((task) => {
          const isUpdating =
            updateStatus.isPending && updateStatus.variables?.taskId === task.id
          return (
            <Card key={task.id}>
              <CardContent className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-lg font-semibold">
                    {t('myTasks.room', { label: roomLabel(task.room_id) })}
                  </span>
                  <PriorityBadge priority={effectivePriority(task)} />
                </div>
                <div className="flex items-center gap-2">
                  <TaskStatusBadge status={task.status} />
                  {task.due_date && (
                    <span
                      className={cn(
                        'text-xs',
                        isOverdue(task)
                          ? 'text-destructive font-medium'
                          : 'text-muted-foreground',
                      )}
                    >
                      {t('myTasks.due', { date: formatDate(task.due_date) })}
                      {isOverdue(task) && ` · ${t('common.overdue')}`}
                    </span>
                  )}
                </div>
                {task.notes && <p className="text-sm">{task.notes}</p>}

                {task.status === 'pending_approval' && (
                  <p className="text-muted-foreground text-sm">
                    {t('myTasks.awaitingApproval')}
                  </p>
                )}
                {(task.status === 'pending' ||
                  task.status === 'assigned' ||
                  task.status === 'in_progress') && (
                  <div className="flex gap-2">
                    {task.status === 'in_progress' ? (
                      <Button
                        className="flex-1"
                        disabled={isUpdating}
                        onClick={() => changeStatus(task, 'completed')}
                      >
                        {t('myTasks.markComplete')}
                      </Button>
                    ) : (
                      <Button
                        className="flex-1"
                        disabled={isUpdating}
                        onClick={() => changeStatus(task, 'in_progress')}
                      >
                        {t('myTasks.start')}
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
