import { zodResolver } from '@hookform/resolvers/zod'
import { Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'

import { ConfirmDialog } from '@/components/confirm-dialog'
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
import { fromDateInput, toDateInput } from '@/lib/format'
import { useRooms } from '@/lib/queries/rooms'
import { useStaff } from '@/lib/queries/staff'
import {
  useCreateTask,
  useDeleteTask,
  useTasks,
  useUpdateTask,
} from '@/lib/queries/tasks'

const UNASSIGNED = 'unassigned'

type FormValues = {
  room_id: string
  assigned_to: string
  status: 'pending' | 'assigned' | 'in_progress' | 'pending_approval' | 'completed'
  priority: 'low' | 'normal' | 'urgent'
  notes: string
  due_date: string
}

const EMPTY: FormValues = {
  room_id: '',
  assigned_to: UNASSIGNED,
  // New tasks default to "assigned" (managers usually assign on creation); if the
  // task is left unassigned, onSubmit downgrades it to "pending" (you can't be
  // assigned to nobody).
  status: 'assigned',
  priority: 'normal',
  notes: '',
  due_date: '',
}

/** Today as a YYYY-MM-DD value for <input type="date">. */
function todayInput(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function TaskFormModal() {
  const { t } = useTranslation()
  const { taskId } = useParams()
  const isEdit = Boolean(taskId)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const schema = useMemo(
    () =>
      z.object({
        room_id: z.string().min(1, t('taskForm.selectRoom')),
        assigned_to: z.string(),
        status: z.enum([
          'pending',
          'assigned',
          'in_progress',
          'pending_approval',
          'completed',
        ]),
        priority: z.enum(['low', 'normal', 'urgent']),
        notes: z.string(),
        due_date: z.string(),
      }),
    [t],
  )
  // Prefill the room when arriving from the "room became dirty" prompt.
  const presetRoomId = searchParams.get('room') ?? ''

  const { data: rooms } = useRooms()
  const { data: staff } = useStaff()
  // Unfiltered lookup so deep-linked edits resolve regardless of board filters.
  const { data: tasks } = useTasks()
  const task = taskId ? tasks?.find((t) => t.id === taskId) : undefined

  const createTask = useCreateTask()
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()
  const isPending = createTask.isPending || updateTask.isPending
  const [confirmDelete, setConfirmDelete] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    // New tasks prefill today's due date; editing overrides this from the task.
    defaultValues: { ...EMPTY, room_id: presetRoomId, due_date: todayInput() },
  })

  useEffect(() => {
    if (task) {
      form.reset({
        room_id: task.room_id,
        assigned_to: task.assigned_to ?? UNASSIGNED,
        status: task.status,
        priority: task.priority,
        notes: task.notes ?? '',
        due_date: toDateInput(task.due_date),
      })
    }
  }, [task, form])

  if (isEdit && tasks && !task) {
    return (
      <RouteModal title={t('taskForm.notFoundTitle')} backTo="/tasks">
        <p className="text-muted-foreground text-sm">
          {t('taskForm.notFoundBody')}
        </p>
      </RouteModal>
    )
  }

  function onSubmit(values: FormValues) {
    const assignedTo =
      values.assigned_to === UNASSIGNED ? null : values.assigned_to
    // A task can't be "assigned" to nobody — fall back to pending when the
    // default "assigned" status is left on an unassigned task.
    const status =
      assignedTo === null && values.status === 'assigned'
        ? 'pending'
        : values.status
    const body: TaskCreate | TaskUpdate = {
      room_id: values.room_id,
      assigned_to: assignedTo,
      status,
      priority: values.priority,
      notes: values.notes.trim() === '' ? null : values.notes,
      due_date: fromDateInput(values.due_date),
    }
    const handlers = {
      onSuccess: () => {
        toast.success(
          isEdit ? t('taskForm.taskUpdated') : t('taskForm.taskCreated'),
        )
        navigate('/tasks')
      },
      onError: (e: unknown) =>
        toast.error(
          e instanceof ApiError ? e.message : t('common.somethingWentWrong'),
        ),
    }
    if (isEdit && taskId) {
      updateTask.mutate({ taskId, body }, handlers)
    } else {
      createTask.mutate(body as TaskCreate, handlers)
    }
  }

  function onDelete() {
    if (!taskId) return
    deleteTask.mutate(taskId, {
      onSuccess: () => {
        toast.success(t('taskForm.taskDeleted'))
        navigate('/tasks')
      },
      onError: (e: unknown) => {
        setConfirmDelete(false)
        toast.error(
          e instanceof ApiError ? e.message : t('common.somethingWentWrong'),
        )
      },
    })
  }

  return (
    <RouteModal
      title={isEdit ? t('taskForm.editTitle') : t('taskForm.newTitle')}
      backTo="/tasks"
    >
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-4"
      >
        <Field
          label={t('taskForm.room')}
          error={form.formState.errors.room_id?.message}
        >
          <Controller
            control={form.control}
            name="room_id"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue placeholder={t('taskForm.selectRoom')} />
                </SelectTrigger>
                <SelectContent>
                  {rooms?.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {t('taskForm.roomOption', { number: r.room_number })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>

        <Field label={t('taskForm.assignee')}>
          <Controller
            control={form.control}
            name="assigned_to"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNASSIGNED}>
                    {t('common.unassigned')}
                  </SelectItem>
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
          <Field label={t('taskForm.status')}>
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
                        {t(`enums.taskStatus.${s}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field label={t('taskForm.priority')}>
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
                        {t(`enums.priority.${p}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
        </div>

        <Field label={t('taskForm.dueDate')} htmlFor="due_date">
          <Input id="due_date" type="date" {...form.register('due_date')} />
        </Field>

        <Field label={t('taskForm.notes')} htmlFor="notes">
          <Textarea id="notes" rows={3} {...form.register('notes')} />
        </Field>

        <div className="flex items-center justify-between gap-2 pt-2">
          {isEdit ? (
            <Button
              type="button"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => setConfirmDelete(true)}
              disabled={deleteTask.isPending}
            >
              <Trash2 className="size-4" />
              {t('taskForm.delete')}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/tasks')}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? t('common.saving') : t('common.save')}
            </Button>
          </div>
        </div>
      </form>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t('taskForm.deleteConfirmTitle')}
        description={t('taskForm.deleteConfirmBody')}
        confirmLabel={t('taskForm.delete')}
        destructive
        loading={deleteTask.isPending}
        onConfirm={onDelete}
      />
    </RouteModal>
  )
}
