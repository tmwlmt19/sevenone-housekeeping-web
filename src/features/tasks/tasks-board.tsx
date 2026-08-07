import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Skeleton } from '@/components/ui/skeleton'
import { TASK_STATUSES } from '@/lib/api/types'
import { ApiError } from '@/lib/api/unwrap'
import { compareByUrgency } from '@/lib/tasks'
import { useRooms } from '@/lib/queries/rooms'
import { useStaff } from '@/lib/queries/staff'
import { useTasks, useUpdateTaskStatus } from '@/lib/queries/tasks'

import { TaskCard } from './task-card'

interface TasksBoardProps {
  assignedTo?: string
}

export function TasksBoard({ assignedTo }: TasksBoardProps) {
  const { t } = useTranslation()
  const { data: tasks, isLoading, isError, error } = useTasks({ assignedTo })
  const { data: rooms } = useRooms()
  const { data: staff } = useStaff()
  const updateStatus = useUpdateTaskStatus()

  const roomLabel = (roomId: string) =>
    rooms?.find((r) => r.id === roomId)?.room_number ?? '—'
  const assigneeName = (userId: string | null) =>
    userId ? (staff?.find((s) => s.id === userId)?.name ?? null) : null

  // Approve = complete the task; send back = re-queue it for the housekeeper.
  const decide = (taskId: string, status: 'completed' | 'assigned') => {
    updateStatus.mutate(
      { taskId, status },
      {
        onSuccess: () =>
          toast.success(
            status === 'completed'
              ? t('tasksBoard.approved')
              : t('tasksBoard.sentBack'),
          ),
        onError: (e) =>
          toast.error(
            e instanceof ApiError ? e.message : t('common.updateFailed'),
          ),
      },
    )
  }

  if (isError) {
    return (
      <p className="text-destructive">
        {error instanceof ApiError
          ? error.message
          : t('tasksBoard.failedToLoad')}
      </p>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {TASK_STATUSES.map((status) => {
        // Columns are the statuses; within a column, order by urgency
        // (overdue tasks count as urgent).
        const column = (tasks?.filter((t) => t.status === status) ?? [])
          .slice()
          .sort(compareByUrgency)
        return (
          <div key={status} className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">
                {t(`enums.taskStatus.${status}`)}
              </h2>
              {!isLoading && (
                <span className="text-muted-foreground text-xs">
                  {column.length}
                </span>
              )}
            </div>

            {isLoading && <Skeleton className="h-20 w-full" />}

            {!isLoading && column.length === 0 && (
              <p className="text-muted-foreground rounded-md border border-dashed p-3 text-center text-xs">
                {t('tasksBoard.none')}
              </p>
            )}

            {column.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                roomLabel={roomLabel(task.room_id)}
                assigneeName={assigneeName(task.assigned_to)}
                onApprove={(id) => decide(id, 'completed')}
                onReject={(id) => decide(id, 'assigned')}
                actionsDisabled={updateStatus.isPending}
              />
            ))}
          </div>
        )
      })}
    </div>
  )
}
