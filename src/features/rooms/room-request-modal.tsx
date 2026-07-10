import { zodResolver } from '@hookform/resolvers/zod'
import { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
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

type FormValues = {
  room_number: string
  floor: string
  room_type: string
  note: string
}

export function RoomRequestModal() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const fileRequest = useFileRequest()

  // Managers can't add rooms directly; they file a request for a platform admin
  // to approve.
  const schema = useMemo(
    () =>
      z.object({
        room_number: z
          .string()
          .trim()
          .min(1, t('roomRequest.validation.required'))
          .max(50, t('roomRequest.validation.max50')),
        floor: z
          .string()
          .trim()
          .refine(
            (v) => v === '' || /^-?\d+$/.test(v),
            t('roomRequest.validation.wholeNumber'),
          ),
        room_type: z.string().trim().max(20, t('roomRequest.validation.max20')),
        note: z.string().trim().max(1000, t('roomRequest.validation.max1000')),
      }),
    [t],
  )

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
          toast.success(t('roomRequest.requestSubmitted'))
          navigate('/rooms')
        },
        onError: (e: unknown) => {
          if (e instanceof ApiError && e.status === 409) {
            form.setError('room_number', { message: e.message })
          } else {
            toast.error(
              e instanceof ApiError
                ? e.message
                : t('common.somethingWentWrong'),
            )
          }
        },
      },
    )
  }

  return (
    <RouteModal title={t('roomRequest.title')} backTo="/rooms">
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-4"
      >
        <Field
          label={t('roomRequest.roomNumber')}
          htmlFor="room_number"
          error={form.formState.errors.room_number?.message}
        >
          <Input id="room_number" {...form.register('room_number')} />
        </Field>
        <Field
          label={t('roomRequest.floor')}
          htmlFor="floor"
          error={form.formState.errors.floor?.message}
        >
          <Input
            id="floor"
            inputMode="numeric"
            placeholder={t('roomRequest.floorPlaceholder')}
            {...form.register('floor')}
          />
        </Field>
        <Field
          label={t('roomRequest.roomType')}
          htmlFor="room_type"
          error={form.formState.errors.room_type?.message}
        >
          <Input
            id="room_type"
            placeholder={t('roomRequest.roomTypePlaceholder')}
            {...form.register('room_type')}
          />
        </Field>
        <Field
          label={t('roomRequest.note')}
          htmlFor="note"
          error={form.formState.errors.note?.message}
        >
          <Textarea
            id="note"
            placeholder={t('roomRequest.notePlaceholder')}
            {...form.register('note')}
          />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/rooms')}
          >
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={fileRequest.isPending}>
            {fileRequest.isPending
              ? t('common.submitting')
              : t('common.submitRequest')}
          </Button>
        </div>
      </form>
    </RouteModal>
  )
}
