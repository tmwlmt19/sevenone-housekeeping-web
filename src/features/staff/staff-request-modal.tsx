import { zodResolver } from '@hookform/resolvers/zod'
import { useMemo } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
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
import type { UserRole } from '@/lib/api/types'
import { ApiError } from '@/lib/api/unwrap'
import { useFileRequest } from '@/lib/queries/access-requests'

// Managers can't add staff directly; they file a request for a platform admin
// to approve. No password here — it's generated when the admin approves.
const HOTEL_ROLES: UserRole[] = ['manager', 'front_desk', 'housekeeper']

type FormValues = {
  email: string
  name: string
  role: 'manager' | 'front_desk' | 'housekeeper'
  note: string
}

export function StaffRequestModal() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const fileRequest = useFileRequest()

  const schema = useMemo(
    () =>
      z.object({
        email: z.string().trim().email(t('staffRequest.validation.validEmail')),
        name: z
          .string()
          .trim()
          .min(1, t('staffRequest.validation.required'))
          .max(255, t('staffRequest.validation.max255')),
        role: z.enum(['manager', 'front_desk', 'housekeeper']),
        note: z.string().trim().max(1000, t('staffRequest.validation.max1000')),
      }),
    [t],
  )

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', name: '', role: 'housekeeper', note: '' },
  })

  function onSubmit(values: FormValues) {
    fileRequest.mutate(
      {
        resource: 'staff',
        kind: 'add',
        payload: {
          email: values.email,
          name: values.name,
          role: values.role,
        },
        note: values.note || null,
      },
      {
        onSuccess: () => {
          toast.success(t('staffRequest.requestSubmitted'))
          navigate('/staff')
        },
        onError: (e: unknown) => {
          if (e instanceof ApiError && e.status === 409) {
            form.setError('email', { message: e.message })
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
    <RouteModal title={t('staffRequest.title')} backTo="/staff">
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-4"
      >
        <Field
          label={t('staffRequest.name')}
          htmlFor="name"
          error={form.formState.errors.name?.message}
        >
          <Input id="name" {...form.register('name')} />
        </Field>
        <Field
          label={t('staffRequest.email')}
          htmlFor="email"
          error={form.formState.errors.email?.message}
        >
          <Input id="email" type="email" {...form.register('email')} />
        </Field>
        <Field
          label={t('staffRequest.role')}
          error={form.formState.errors.role?.message}
        >
          <Controller
            control={form.control}
            name="role"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HOTEL_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {t(`enums.role.${r}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
        <Field
          label={t('staffRequest.note')}
          htmlFor="note"
          error={form.formState.errors.note?.message}
        >
          <Textarea
            id="note"
            placeholder={t('staffRequest.notePlaceholder')}
            {...form.register('note')}
          />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/staff')}
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
