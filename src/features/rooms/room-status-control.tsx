import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { useAuth } from '@/auth/auth-context'
import { isHotelOps } from '@/auth/types'
import { RoomStatusBadge } from '@/components/status-badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { ROOM_STATUSES, type Room, type RoomStatus } from '@/lib/api/types'
import { ApiError } from '@/lib/api/unwrap'
import { useUpdateRoomStatus } from '@/lib/queries/rooms'

/** A room's status: an inline editor for hotel ops — manager/front-desk — (with
 * a prompt to schedule cleaning when a room is marked dirty) or a read-only
 * badge for everyone else. Shared by the rooms table and the dashboard. */
export function RoomStatusControl({
  room,
  triggerClassName,
}: {
  room: Room
  triggerClassName?: string
}) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const updateStatus = useUpdateRoomStatus()
  const [promptOpen, setPromptOpen] = useState(false)

  if (!isHotelOps(user?.role)) {
    return <RoomStatusBadge status={room.status} />
  }

  return (
    <>
      <Select
        value={room.status}
        disabled={updateStatus.isPending}
        onValueChange={(status) =>
          updateStatus.mutate(
            { roomId: room.id, status: status as RoomStatus },
            {
              onSuccess: () => {
                // Nudge the manager to schedule cleaning so dirty rooms
                // don't get forgotten.
                if (status === 'dirty') setPromptOpen(true)
              },
              onError: (e) =>
                toast.error(
                  e instanceof ApiError
                    ? e.message
                    : t('roomsTable.failedUpdateStatus'),
                ),
            },
          )
        }
      >
        <SelectTrigger
          className={cn('h-8 w-40', triggerClassName)}
          aria-label={t('roomsTable.roomStatusAria')}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ROOM_STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              {t(`enums.roomStatus.${s}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <AlertDialog open={promptOpen} onOpenChange={setPromptOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('dirtyRoomPrompt.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('dirtyRoomPrompt.description', { number: room.room_number })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('dirtyRoomPrompt.dismiss')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setPromptOpen(false)
                navigate(`/tasks/new?room=${room.id}`)
              }}
            >
              {t('dirtyRoomPrompt.createTask')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
