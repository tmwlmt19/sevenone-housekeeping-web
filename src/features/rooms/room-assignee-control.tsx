import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { useAuth } from '@/auth/auth-context'
import { isHotelOps } from '@/auth/types'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Room, TaskUpdate } from '@/lib/api/types'
import { ApiError } from '@/lib/api/unwrap'
import { useStaff } from '@/lib/queries/staff'
import { useCreateTask, useTasks, useUpdateTask } from '@/lib/queries/tasks'
import { activeTaskForRoom } from '@/lib/tasks'
import { cn } from '@/lib/utils'

const UNASSIGNED = 'unassigned'

/**
 * A room's current assignee — the housekeeper who owns its live cleaning task.
 * Editable inline for hotel ops (manager/front-desk), a read-only name for
 * everyone else. It's backed by the room's active task: picking a housekeeper on
 * an already-tasked room reassigns that task; picking one on an untasked room
 * creates a task for them; clearing the assignee leaves the task unassigned.
 * Mirrors RoomStatusControl; shared by the floor map's status view.
 */
export function RoomAssigneeControl({
  room,
  triggerClassName,
}: {
  room: Room
  triggerClassName?: string
}) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { data: tasks } = useTasks()
  const { data: staff } = useStaff()
  const createTask = useCreateTask()
  const updateTask = useUpdateTask()

  const task = activeTaskForRoom(tasks, room.id)
  const housekeepers = (staff ?? []).filter((s) => s.role === 'housekeeper')
  const isPending = createTask.isPending || updateTask.isPending

  if (!isHotelOps(user?.role)) {
    // Look the name up in the full staff list so a task assigned to someone who
    // isn't a housekeeper still reads correctly.
    const name = staff?.find((s) => s.id === task?.assigned_to)?.name
    return (
      <p className="text-sm">
        {task?.assigned_to
          ? (name ?? t('common.unknown'))
          : t('common.unassigned')}
      </p>
    )
  }

  function onChange(value: string) {
    const assignedTo = value === UNASSIGNED ? null : value
    const onError = (e: unknown) =>
      toast.error(
        e instanceof ApiError ? e.message : t('roomAssignee.failedUpdate'),
      )

    if (task) {
      // Keep status in step with assignment, matching the task form: a plain
      // "assigned" status can't sit on an unassigned task, and assigning a
      // still-pending task moves it to "assigned".
      const body: TaskUpdate = { assigned_to: assignedTo }
      if (assignedTo === null && task.status === 'assigned') {
        body.status = 'pending'
      } else if (assignedTo !== null && task.status === 'pending') {
        body.status = 'assigned'
      }
      updateTask.mutate({ taskId: task.id, body }, { onError })
      return
    }

    // No live task yet: assigning a housekeeper creates one. Clearing an
    // already-empty assignee is a no-op.
    if (assignedTo === null) return
    createTask.mutate(
      {
        room_id: room.id,
        assigned_to: assignedTo,
        status: 'assigned',
        priority: 'normal',
      },
      { onError },
    )
  }

  return (
    <Select
      value={task?.assigned_to ?? UNASSIGNED}
      disabled={isPending}
      onValueChange={onChange}
    >
      <SelectTrigger
        className={cn('h-8 w-40', triggerClassName)}
        aria-label={t('roomAssignee.aria')}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={UNASSIGNED}>{t('common.unassigned')}</SelectItem>
        {housekeepers.map((h) => (
          <SelectItem key={h.id} value={h.id}>
            {h.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
