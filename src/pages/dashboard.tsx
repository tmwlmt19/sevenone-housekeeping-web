import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { RoomStatusControl } from '@/features/rooms/room-status-control'
import { ImportDirtyRoomsButton } from '@/features/tasks/import-dirty-rooms-modal'
import { PageHeader } from '@/components/page-header'
import {
  PriorityBadge,
  TaskStatusBadge,
} from '@/components/status-badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { Task } from '@/lib/api/types'
import { formatDate } from '@/lib/format'
import { compareTasks, effectivePriority, isOverdue } from '@/lib/tasks'
import { cn } from '@/lib/utils'
import { useRooms } from '@/lib/queries/rooms'
import { useStaff } from '@/lib/queries/staff'
import { useTasks } from '@/lib/queries/tasks'

export function DashboardPage() {
  const { t } = useTranslation()
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
    .sort(compareTasks)

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={t('dashboard.title')}
        description={t('dashboard.subtitle')}
        action={<ImportDirtyRoomsButton />}
      />

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">
            {t('dashboard.rooms')}{' '}
            {rooms && (
              <span className="text-muted-foreground">({rooms.length})</span>
            )}
          </h2>
          <Link to="/rooms" className="text-muted-foreground text-sm underline">
            {t('dashboard.manageRooms')}
          </Link>
        </div>

        {roomsLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : sortedRooms.length === 0 ? (
          <Card>
            <CardContent className="text-muted-foreground py-8 text-center text-sm">
              {t('dashboard.noRooms')}{' '}
              <Link to="/rooms/new" className="underline">
                {t('dashboard.addFirstRoom')}
              </Link>
              .
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {sortedRooms.map((room) => (
              <div
                key={room.id}
                className="flex flex-col gap-2 rounded-lg border p-3"
              >
                <div className="flex items-baseline justify-between gap-1">
                  <span className="text-lg font-semibold">
                    {room.room_number}
                  </span>
                  {room.floor != null && (
                    <span className="text-muted-foreground text-xs">
                      {t('dashboard.floorShort', { n: String(room.floor) })}
                    </span>
                  )}
                </div>
                <RoomStatusControl room={room} triggerClassName="w-full" />
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">
            {t('dashboard.openTasks')}{' '}
            {tasks && (
              <span className="text-muted-foreground">
                ({openTasks.length})
              </span>
            )}
          </h2>
          <Link to="/tasks" className="text-muted-foreground text-sm underline">
            {t('dashboard.viewBoard')}
          </Link>
        </div>

        {tasksLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <Card>
            <CardContent className="p-0">
              {openTasks.length === 0 ? (
                <p className="text-muted-foreground py-8 text-center text-sm">
                  {t('dashboard.allHandled')}
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
  const { t } = useTranslation()
  return (
    <li>
      <Link
        to={`/tasks/${task.id}`}
        className="hover:bg-accent/50 flex items-center justify-between gap-3 px-4 py-3"
      >
        <div className="flex min-w-0 flex-col">
          <span className="font-medium">
            {t('dashboard.room', { label: roomLabel })}
          </span>
          <span
            className={cn(
              'truncate text-sm',
              isOverdue(task) ? 'text-destructive' : 'text-muted-foreground',
            )}
          >
            {assignee ?? t('common.unassigned')}
            {task.due_date &&
              ` · ${t('dashboard.due', { date: formatDate(task.due_date) })}`}
            {isOverdue(task) && ` · ${t('common.overdue')}`}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <PriorityBadge priority={effectivePriority(task)} />
          <TaskStatusBadge status={task.status} />
        </div>
      </Link>
    </li>
  )
}
