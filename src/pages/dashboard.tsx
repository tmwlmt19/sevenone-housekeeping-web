import { Link } from 'react-router-dom'

import { PageHeader } from '@/components/page-header'
import { RoomStatusBadge, TaskStatusBadge } from '@/components/status-badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ROOM_STATUSES, type RoomStatus } from '@/lib/api/types'
import { useRooms } from '@/lib/queries/rooms'
import { useTasks } from '@/lib/queries/tasks'

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-muted-foreground text-sm font-medium">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  )
}

export function DashboardPage() {
  const { data: rooms, isLoading: roomsLoading } = useRooms()
  const { data: tasks, isLoading: tasksLoading } = useTasks()

  const roomCounts = (status: RoomStatus) =>
    rooms?.filter((r) => r.status === status).length ?? 0

  const openTasks = tasks?.filter((t) => t.status !== 'completed') ?? []
  const unassigned = openTasks.filter((t) => t.assigned_to === null)
  const urgent = openTasks.filter((t) => t.priority === 'urgent')
  const completed = tasks?.filter((t) => t.status === 'completed') ?? []

  const loading = roomsLoading || tasksLoading

  if (loading) {
    return (
      <div>
        <PageHeader title="Dashboard" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Dashboard" description="Today at a glance." />

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">Rooms</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {ROOM_STATUSES.map((status) => (
            <Card key={status}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  <RoomStatusBadge status={status} />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold">{roomCounts(status)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">Tasks</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Open" value={openTasks.length} />
          <StatCard label="Unassigned" value={unassigned.length} />
          <StatCard label="Urgent" value={urgent.length} />
          <StatCard label="Completed" value={completed.length} />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Needs attention</h2>
          <Link to="/tasks" className="text-muted-foreground text-sm underline">
            View all tasks
          </Link>
        </div>
        <Card>
          <CardContent className="p-0">
            {urgent.length === 0 && unassigned.length === 0 ? (
              <p className="text-muted-foreground p-6 text-center text-sm">
                Nothing urgent or unassigned. Nice and tidy.
              </p>
            ) : (
              <ul className="divide-y">
                {[
                  ...urgent,
                  ...unassigned.filter((t) => t.priority !== 'urgent'),
                ]
                  .slice(0, 8)
                  .map((task) => {
                    const room = rooms?.find((r) => r.id === task.room_id)
                    return (
                      <li key={task.id}>
                        <Link
                          to={`/tasks/${task.id}`}
                          className="hover:bg-accent/50 flex items-center justify-between gap-2 px-4 py-3 text-sm"
                        >
                          <span className="font-medium">
                            Room {room?.room_number ?? '—'}
                          </span>
                          <span className="flex items-center gap-2">
                            {task.assigned_to === null && (
                              <span className="text-muted-foreground text-xs">
                                Unassigned
                              </span>
                            )}
                            <TaskStatusBadge status={task.status} />
                          </span>
                        </Link>
                      </li>
                    )
                  })}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
