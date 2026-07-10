import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'

import { Field } from '@/components/form/field'
import { RouteModal } from '@/components/route-modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ApiError } from '@/lib/api/unwrap'
import { useFileRequest } from '@/lib/queries/access-requests'

// Managers can't add rooms directly; they file a request for a platform admin
// to approve.
const schema = z.object({
  room_number: z.string().trim().min(1, 'Required').max(50, 'Max 50 characters'),
  floor: z
    .string()
    .trim()
    .refine((v) => v === '' || /^-?\d+$/.test(v), 'Whole number'),
  room_type: z.string().trim().max(20, 'Max 20 characters'),
  note: z.string().trim().max(1000, 'Max 1000 characters'),
})

type FormValues = z.infer<typeof schema>

export function RoomRequestModal() {
  const navigate = useNavigate()
  const fileRequest = useFileRequest()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { room_number: '', floor: '', room_type: '', note: '' },
  })

  function onSubmit(values: FormValues) {
    fileRequest.mutate(
      {
        resource: 'room',
        kind: 'add',
        payload: {
          room_number: values.room_number,
          floor: values.floor === '' ? null : Number(values.floor),
          room_type: values.room_type === '' ? null : values.room_type,
          status: 'clean',
        },
        note: values.note || null,
      },
      {
        onSuccess: () => {
          toast.success('Request submitted for approval')
          navigate('/rooms')
        },
        onError: (e: unknown) => {
          if (e instanceof ApiError && e.status === 409) {
            form.setError('room_number', { message: e.message })
          } else {
            toast.error(
              e instanceof ApiError ? e.message : 'Something went wrong',
            )
          }
        },
      },
    )
  }

  return (
    <RouteModal title="Request new room" backTo="/rooms">
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-4"
      >
        <Field
          label="Room number"
          htmlFor="room_number"
          error={form.formState.errors.room_number?.message}
        >
          <Input id="room_number" {...form.register('room_number')} />
        </Field>
        <Field
          label="Floor"
          htmlFor="floor"
          error={form.formState.errors.floor?.message}
        >
          <Input
            id="floor"
            inputMode="numeric"
            placeholder="Optional"
            {...form.register('floor')}
          />
        </Field>
        <Field
          label="Room type"
          htmlFor="room_type"
          error={form.formState.errors.room_type?.message}
        >
          <Input
            id="room_type"
            placeholder="Optional (e.g. STD, DLX)"
            {...form.register('room_type')}
          />
        </Field>
        <Field
          label="Note (optional)"
          htmlFor="note"
          error={form.formState.errors.note?.message}
        >
          <Textarea
            id="note"
            placeholder="Context for the admin"
            {...form.register('note')}
          />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/rooms')}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={fileRequest.isPending}>
            {fileRequest.isPending ? 'Submitting…' : 'Submit request'}
          </Button>
        </div>
      </form>
    </RouteModal>
  )
}
