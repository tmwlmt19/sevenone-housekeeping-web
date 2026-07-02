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
import { useRooms } from '@/lib/queries/rooms'
import { useTasks, useUpdateTaskStatus } from '@/lib/queries/tasks'

const STATUS_ORDER: Record<TaskStatus, number> = {
  in_progress: 0,
  assigned: 1,
  pending: 2,
  completed: 3,
}

export function MyTasksPage() {
  const { user } = useAuth()
  const { data: tasks, isLoading } = useTasks({ assignedTo: user?.id })
  const { data: rooms } = useRooms()
  const updateStatus = useUpdateTaskStatus()

  const roomLabel = (roomId: string) =>
    rooms?.find((r) => r.id === roomId)?.room_number ?? '—'

  function changeStatus(task: Task, status: TaskStatus, message: string) {
    updateStatus.mutate(
      { taskId: task.id, status },
      {
        onSuccess: () => toast.success(message),
        onError: (e) =>
          toast.error(e instanceof ApiError ? e.message : 'Update failed'),
      },
    )
  }

  const sorted = [...(tasks ?? [])].sort(
    (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status],
  )

  return (
    <div>
      <PageHeader title="My Tasks" />

      {isLoading && <Skeleton className="h-40 w-full" />}

      {!isLoading && sorted.length === 0 && (
        <p className="text-muted-foreground py-12 text-center text-sm">
          No tasks assigned to you right now.
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
                    Room {roomLabel(task.room_id)}
                  </span>
                  <PriorityBadge priority={task.priority} />
                </div>
                <div className="flex items-center gap-2">
                  <TaskStatusBadge status={task.status} />
                  {task.due_date && (
                    <span className="text-muted-foreground text-xs">
                      Due {formatDate(task.due_date)}
                    </span>
                  )}
                </div>
                {task.notes && <p className="text-sm">{task.notes}</p>}

                {task.status !== 'completed' && (
                  <div className="flex gap-2">
                    {task.status === 'in_progress' ? (
                      <Button
                        className="flex-1"
                        disabled={isUpdating}
                        onClick={() =>
                          changeStatus(task, 'completed', 'Task completed')
                        }
                      >
                        Mark complete
                      </Button>
                    ) : (
                      <Button
                        className="flex-1"
                        disabled={isUpdating}
                        onClick={() =>
                          changeStatus(task, 'in_progress', 'Started')
                        }
                      >
                        Start
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
