import { Eraser } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api/unwrap'
import { useClearCompleted } from '@/lib/queries/tasks'

/**
 * Clear completed tasks off the board. Confirmed (it's bulk) and soft — the
 * backend archives rather than deletes, so history survives. Hotel ops only.
 */
export function ClearCompletedButton() {
  const { t } = useTranslation()
  const clear = useClearCompleted()

  const onConfirm = () =>
    clear.mutate(undefined, {
      onSuccess: ({ cleared }) => {
        toast.success(
          cleared > 0
            ? t('clearCompleted.cleared', { count: cleared })
            : t('clearCompleted.none'),
        )
      },
      onError: (e) =>
        toast.error(
          e instanceof ApiError ? e.message : t('clearCompleted.failed'),
        ),
    })

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" disabled={clear.isPending}>
          <Eraser className="size-4" />
          {t('clearCompleted.trigger')}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('clearCompleted.title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('clearCompleted.description')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            {t('clearCompleted.confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
