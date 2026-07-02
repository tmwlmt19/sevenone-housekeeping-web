import { Link } from 'react-router-dom'

import { PageHeader } from '@/components/page-header'
import {
  PriorityBadge,
  RoomStatusBadge,
  TaskStatusBadge,
} from '@/components/status-badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { Task, TaskPriority } from '@/lib/api/types'
import { formatDate } from '@/lib/format'
import { useRooms } from '@/lib/queries/rooms'
import { useStaff } from '@/lib/queries/staff'
import { useTasks } from '@/lib/queries/tasks'

const PRIORITY_RANK: Record<TaskPriority, number> = {
  urgent: 0,
  normal: 1,
  low: 2,
}

export function DashboardPage() {
  const { data: rooms, isLoading: roomsLoading } = useRooms()
  const { data: tasks, isLoading: tasksLoading } = useTasks()
  const { data: staff } = useStaff()

  const assigneeName = (userId: string | null) =>
    userId ? (staff?.find((s) => s.id === userId)?.name ?? null) : null

  const sortedRooms = [...(rooms ?? [])].sort((a, b) =>
    a.room_number.localeCompare(b.room_number, undefined, { numeric: true }),
  )

  const openTasks = (tasks ?? [])
    .filter((t) => t.status !== 'completed')
    .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority])

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Dashboard" description="Today at a glance." />

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">
            Rooms{' '}
            {rooms && (
              <span className="text-muted-foreground">({rooms.length})</span>
            )}
          </h2>
          <Link to="/rooms" className="text-muted-foreground text-sm underline">
            Manage rooms
          </Link>
        </div>

        {roomsLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : sortedRooms.length === 0 ? (
          <Card>
            <CardContent className="text-muted-foreground py-8 text-center text-sm">
              No rooms yet.{' '}
              <Link to="/rooms/new" className="underline">
                Add your first room
              </Link>
              .
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {sortedRooms.map((room) => (
              <Link
                key={room.id}
                to={`/rooms/${room.id}`}
                className="hover:bg-accent/50 flex flex-col gap-2 rounded-lg border p-3 transition-colors"
              >
                <div className="flex items-baseline justify-between gap-1">
                  <span className="text-lg font-semibold">
                    {room.room_number}
                  </span>
                  {room.floor != null && (
                    <span className="text-muted-foreground text-xs">
                      Fl {room.floor}
                    </span>
                  )}
                </div>
                <RoomStatusBadge status={room.status} />
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">
            Open tasks{' '}
            {tasks && (
              <span className="text-muted-foreground">
                ({openTasks.length})
              </span>
            )}
          </h2>
          <Link to="/tasks" className="text-muted-foreground text-sm underline">
            View board
          </Link>
        </div>

        {tasksLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <Card>
            <CardContent className="p-0">
              {openTasks.length === 0 ? (
                <p className="text-muted-foreground py-8 text-center text-sm">
                  No open tasks. Everything's handled.
                </p>
              ) : (
                <ul className="divide-y">
                  {openTasks.map((task) => (
                    <OpenTaskRow
                      key={task.id}
                      task={task}
                      roomLabel={
                        rooms?.find((r) => r.id === task.room_id)
                          ?.room_number ?? '—'
                      }
                      assignee={assigneeName(task.assigned_to)}
                    />
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  )
}

function OpenTaskRow({
  task,
  roomLabel,
  assignee,
}: {
  task: Task
  roomLabel: string
  assignee: string | null
}) {
  return (
    <li>
      <Link
        to={`/tasks/${task.id}`}
        className="hover:bg-accent/50 flex items-center justify-between gap-3 px-4 py-3"
      >
        <div className="flex min-w-0 flex-col">
          <span className="font-medium">Room {roomLabel}</span>
          <span className="text-muted-foreground truncate text-sm">
            {assignee ?? 'Unassigned'}
            {task.due_date && ` · Due ${formatDate(task.due_date)}`}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <PriorityBadge priority={task.priority} />
          <TaskStatusBadge status={task.status} />
        </div>
      </Link>
    </li>
  )
}
