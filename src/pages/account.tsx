import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft } from 'lucide-react'
import { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'

import { useAuth } from '@/auth/auth-context'
import { Field } from '@/components/form/field'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ApiError } from '@/lib/api/unwrap'
import { useChangePassword } from '@/lib/queries/account'
import { homePathFor } from '@/routes/guards'

type FormValues = {
  current_password: string
  new_password: string
  confirm_password: string
}

export function AccountPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const changePassword = useChangePassword()

  const schema = useMemo(
    () =>
      z
        .object({
          current_password: z.string().min(1, t('account.validation.required')),
          new_password: z.string().min(8, t('account.validation.min8')),
          confirm_password: z.string().min(1, t('account.validation.required')),
        })
        .refine((v) => v.new_password === v.confirm_password, {
          path: ['confirm_password'],
          message: t('account.validation.passwordsNoMatch'),
        }),
    [t],
  )

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      current_password: '',
      new_password: '',
      confirm_password: '',
    },
  })

  function onSubmit(values: FormValues) {
    changePassword.mutate(
      {
        current_password: values.current_password,
        new_password: values.new_password,
      },
      {
        onSuccess: () => {
          toast.success(t('account.passwordChanged'))
          form.reset()
        },
        onError: (e) => {
          if (e instanceof ApiError && e.status === 400) {
            form.setError('current_password', { message: e.message })
          } else {
            toast.error(
              e instanceof ApiError ? e.message : t('common.updateFailed'),
            )
          }
        },
      },
    )
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-4 p-4">
      <Link
        to={user ? homePathFor(user.role) : '/'}
        className="text-muted-foreground inline-flex items-center gap-1 text-sm hover:underline"
      >
        <ArrowLeft className="size-4" />
        {t('common.back')}
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>{t('account.title')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {user && (
            <dl className="text-sm">
              <div className="flex justify-between py-1">
                <dt className="text-muted-foreground">{t('account.role')}</dt>
                <dd>{t(`enums.role.${user.role}`)}</dd>
              </div>
            </dl>
          )}

          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
          >
            <h2 className="text-sm font-semibold">
              {t('account.changePassword')}
            </h2>
            <Field
              label={t('account.currentPassword')}
              htmlFor="current_password"
              error={form.formState.errors.current_password?.message}
            >
              <Input
                id="current_password"
                type="password"
                autoComplete="current-password"
                {...form.register('current_password')}
              />
            </Field>
            <Field
              label={t('account.newPassword')}
              htmlFor="new_password"
              error={form.formState.errors.new_password?.message}
            >
              <Input
                id="new_password"
                type="password"
                autoComplete="new-password"
                {...form.register('new_password')}
              />
            </Field>
            <Field
              label={t('account.confirmPassword')}
              htmlFor="confirm_password"
              error={form.formState.errors.confirm_password?.message}
            >
              <Input
                id="confirm_password"
                type="password"
                autoComplete="new-password"
                {...form.register('confirm_password')}
              />
            </Field>
            <div className="flex justify-end">
              <Button type="submit" disabled={changePassword.isPending}>
                {changePassword.isPending
                  ? t('common.saving')
                  : t('account.changePassword')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
