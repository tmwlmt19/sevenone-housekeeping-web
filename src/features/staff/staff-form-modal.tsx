import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useMemo } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'

import { useAuth } from '@/auth/auth-context'
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
import { USER_ROLES, type StaffCreate, type StaffUpdate } from '@/lib/api/types'
import { ApiError } from '@/lib/api/unwrap'
import { humanize } from '@/lib/format'
import { useCreateStaff, useStaff, useUpdateStaff } from '@/lib/queries/staff'

function makeSchema(isEdit: boolean) {
  return z.object({
    email: z.string().trim().email('Enter a valid email'),
    name: z.string().trim().min(1, 'Required').max(255, 'Max 255 characters'),
    role: z.enum(['admin', 'manager', 'housekeeper']),
    password: isEdit
      ? z
          .string()
          .refine(
            (v) => v === '' || v.length >= 8,
            'Min 8 characters (or leave blank)',
          )
      : z.string().min(8, 'Min 8 characters'),
  })
}

type FormValues = z.infer<ReturnType<typeof makeSchema>>

export function StaffFormModal() {
  const { userId } = useParams()
  const isEdit = Boolean(userId)
  const navigate = useNavigate()
  const { user } = useAuth()
  const isSelf = isEdit && userId === user?.id
  const { data: staff } = useStaff()
  const member = userId ? staff?.find((m) => m.id === userId) : undefined

  const createStaff = useCreateStaff()
  const updateStaff = useUpdateStaff()
  const isPending = createStaff.isPending || updateStaff.isPending

  const schema = useMemo(() => makeSchema(isEdit), [isEdit])
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', name: '', role: 'housekeeper', password: '' },
  })

  useEffect(() => {
    if (member) {
      form.reset({
        email: member.email,
        name: member.name,
        role: member.role,
        password: '',
      })
    }
  }, [member, form])

  if (isEdit && staff && !member) {
    return (
      <RouteModal title="Staff member not found" backTo="/staff">
        <p className="text-muted-foreground text-sm">
          This person no longer exists.
        </p>
      </RouteModal>
    )
  }

  function onSubmit(values: FormValues) {
    const handlers = {
      onSuccess: () => {
        toast.success(isEdit ? 'Staff updated' : 'Staff added')
        navigate('/staff')
      },
      onError: (e: unknown) => {
        if (e instanceof ApiError && e.status === 409) {
          form.setError('email', { message: e.message })
        } else {
          toast.error(
            e instanceof ApiError ? e.message : 'Something went wrong',
          )
        }
      },
    }

    if (isEdit && userId) {
      const body: StaffUpdate = {
        email: values.email,
        name: values.name,
        role: values.role,
      }
      if (values.password) body.password = values.password
      updateStaff.mutate({ userId, body }, handlers)
    } else {
      const body: StaffCreate = {
        email: values.email,
        name: values.name,
        role: values.role,
        password: values.password,
      }
      createStaff.mutate(body, handlers)
    }
  }

  return (
    <RouteModal
      title={isEdit ? 'Edit staff member' : 'Add staff member'}
      backTo="/staff"
    >
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
        <Field
          label="Email"
          htmlFor="email"
          error={form.formState.errors.email?.message}
        >
          <Input id="email" type="email" {...form.register('email')} />
        </Field>
        <Field label="Role" error={form.formState.errors.role?.message}>
          <Controller
            control={form.control}
            name="role"
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={field.onChange}
                disabled={isSelf}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {USER_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {humanize(r)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {isSelf && (
            <p className="text-muted-foreground text-sm">
              You can't change your own role.
            </p>
          )}
        </Field>
        <Field
          label={isEdit ? 'New password' : 'Password'}
          htmlFor="password"
          error={form.formState.errors.password?.message}
        >
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            placeholder={isEdit ? 'Leave blank to keep current' : undefined}
            {...form.register('password')}
          />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/staff')}
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
