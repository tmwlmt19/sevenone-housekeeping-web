import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'

import { Field } from '@/components/form/field'
import { RouteModal } from '@/components/route-modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  type TaskCreate,
  type TaskUpdate,
} from '@/lib/api/types'
import { ApiError } from '@/lib/api/unwrap'
import { fromDateTimeLocal, humanize, toDateTimeLocal } from '@/lib/format'
import { useRooms } from '@/lib/queries/rooms'
import { useStaff } from '@/lib/queries/staff'
import { useCreateTask, useTasks, useUpdateTask } from '@/lib/queries/tasks'

const UNASSIGNED = 'unassigned'

const schema = z.object({
  room_id: z.string().min(1, 'Select a room'),
  assigned_to: z.string(),
  status: z.enum(['pending', 'assigned', 'in_progress', 'completed']),
  priority: z.enum(['low', 'normal', 'urgent']),
  notes: z.string(),
  due_date: z.string(),
})

type FormValues = z.infer<typeof schema>

const EMPTY: FormValues = {
  room_id: '',
  assigned_to: UNASSIGNED,
  status: 'pending',
  priority: 'normal',
  notes: '',
  due_date: '',
}

export function TaskFormModal() {
  const { taskId } = useParams()
  const isEdit = Boolean(taskId)
  const navigate = useNavigate()

  const { data: rooms } = useRooms()
  const { data: staff } = useStaff()
  // Unfiltered lookup so deep-linked edits resolve regardless of board filters.
  const { data: tasks } = useTasks()
  const task = taskId ? tasks?.find((t) => t.id === taskId) : undefined

  const createTask = useCreateTask()
  const updateTask = useUpdateTask()
  const isPending = createTask.isPending || updateTask.isPending

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY,
  })

  useEffect(() => {
    if (task) {
      form.reset({
        room_id: task.room_id,
        assigned_to: task.assigned_to ?? UNASSIGNED,
        status: task.status,
        priority: task.priority,
        notes: task.notes ?? '',
        due_date: toDateTimeLocal(task.due_date),
      })
    }
  }, [task, form])

  if (isEdit && tasks && !task) {
    return (
      <RouteModal title="Task not found" backTo="/tasks">
        <p className="text-muted-foreground text-sm">
          This task no longer exists.
        </p>
      </RouteModal>
    )
  }

  function onSubmit(values: FormValues) {
    const body: TaskCreate | TaskUpdate = {
      room_id: values.room_id,
      assigned_to:
        values.assigned_to === UNASSIGNED ? null : values.assigned_to,
      status: values.status,
      priority: values.priority,
      notes: values.notes.trim() === '' ? null : values.notes,
      due_date: fromDateTimeLocal(values.due_date),
    }
    const handlers = {
      onSuccess: () => {
        toast.success(isEdit ? 'Task updated' : 'Task created')
        navigate('/tasks')
      },
      onError: (e: unknown) =>
        toast.error(e instanceof ApiError ? e.message : 'Something went wrong'),
    }
    if (isEdit && taskId) {
      updateTask.mutate({ taskId, body }, handlers)
    } else {
      createTask.mutate(body as TaskCreate, handlers)
    }
  }

  return (
    <RouteModal title={isEdit ? 'Edit task' : 'New task'} backTo="/tasks">
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-4"
      >
        <Field label="Room" error={form.formState.errors.room_id?.message}>
          <Controller
            control={form.control}
            name="room_id"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a room" />
                </SelectTrigger>
                <SelectContent>
                  {rooms?.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      Room {r.room_number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>

        <Field label="Assignee">
          <Controller
            control={form.control}
            name="assigned_to"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                  {staff?.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Status">
            <Controller
              control={form.control}
              name="status"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {humanize(s)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field label="Priority">
            <Controller
              control={form.control}
              name="priority"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {humanize(p)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
        </div>

        <Field label="Due date" htmlFor="due_date">
          <Input
            id="due_date"
            type="datetime-local"
            {...form.register('due_date')}
          />
        </Field>

        <Field label="Notes" htmlFor="notes">
          <Textarea id="notes" rows={3} {...form.register('notes')} />
        </Field>

        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/tasks')}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </form>
    </RouteModal>
  )
}
