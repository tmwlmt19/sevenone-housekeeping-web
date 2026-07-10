import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'

import { Field } from '@/components/form/field'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { ApiError } from '@/lib/api/unwrap'
import { useHotel, useUpdateHotel } from '@/lib/queries/hotel'

type FormValues = { name: string; address: string }

export function HotelSettingsPage() {
  const { t } = useTranslation()
  const { data: hotel, isLoading } = useHotel()
  const updateHotel = useUpdateHotel()

  const schema = useMemo(
    () =>
      z.object({
        name: z
          .string()
          .trim()
          .min(1, t('hotelSettings.validation.required'))
          .max(255, t('hotelSettings.validation.max255')),
        address: z.string(),
      }),
    [t],
  )

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', address: '' },
  })

  useEffect(() => {
    if (hotel) {
      form.reset({ name: hotel.name, address: hotel.address ?? '' })
    }
  }, [hotel, form])

  function onSubmit(values: FormValues) {
    updateHotel.mutate(
      {
        name: values.name,
        address: values.address.trim() === '' ? null : values.address,
      },
      {
        onSuccess: () => toast.success(t('hotelSettings.hotelUpdated')),
        onError: (e) =>
          toast.error(
            e instanceof ApiError ? e.message : t('common.updateFailed'),
          ),
      },
    )
  }

  return (
    <div className="max-w-xl">
      <PageHeader
        title={t('hotelSettings.title')}
        description={t('hotelSettings.subtitle')}
      />
      <Card>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="flex flex-col gap-4"
            >
              <Field
                label={t('hotelSettings.name')}
                htmlFor="name"
                error={form.formState.errors.name?.message}
              >
                <Input id="name" {...form.register('name')} />
              </Field>
              <Field label={t('hotelSettings.address')} htmlFor="address">
                <Input id="address" {...form.register('address')} />
              </Field>
              <div className="flex justify-end">
                <Button type="submit" disabled={updateHotel.isPending}>
                  {updateHotel.isPending
                    ? t('common.saving')
                    : t('hotelSettings.saveChanges')}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
