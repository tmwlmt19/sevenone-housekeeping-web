import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
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

const schema = z.object({
  name: z.string().trim().min(1, 'Required').max(255, 'Max 255 characters'),
  address: z.string(),
})

type FormValues = z.infer<typeof schema>

export function HotelSettingsPage() {
  const { data: hotel, isLoading } = useHotel()
  const updateHotel = useUpdateHotel()

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
        onSuccess: () => toast.success('Hotel updated'),
        onError: (e) =>
          toast.error(e instanceof ApiError ? e.message : 'Update failed'),
      },
    )
  }

  return (
    <div className="max-w-xl">
      <PageHeader
        title="Hotel settings"
        description="Edit your hotel details."
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
                label="Name"
                htmlFor="name"
                error={form.formState.errors.name?.message}
              >
                <Input id="name" {...form.register('name')} />
              </Field>
              <Field label="Address" htmlFor="address">
                <Input id="address" {...form.register('address')} />
              </Field>
              <div className="flex justify-end">
                <Button type="submit" disabled={updateHotel.isPending}>
                  {updateHotel.isPending ? 'Saving…' : 'Save changes'}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
