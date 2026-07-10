import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { useAuth } from '@/auth/auth-context'
import { RequestRemovalDialog } from '@/features/access-requests/request-removal-dialog'
import { RoomStatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ROOM_STATUSES, type Room, type RoomStatus } from '@/lib/api/types'
import { ApiError } from '@/lib/api/unwrap'
import { useRooms, useUpdateRoomStatus } from '@/lib/queries/rooms'

function RoomStatusSelect({ room }: { room: Room }) {
  const { t } = useTranslation()
  const updateStatus = useUpdateRoomStatus()
  return (
    <Select
      value={room.status}
      disabled={updateStatus.isPending}
      onValueChange={(status) =>
        updateStatus.mutate(
          { roomId: room.id, status: status as RoomStatus },
          {
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
        className="h-8 w-40"
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
  )
}

export function RoomsTable() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const isManager = user?.role === 'manager'
  const isAdmin = user?.role === 'admin'
  const { data: rooms, isLoading, isError, error } = useRooms()
  const [toRemove, setToRemove] = useState<Room | null>(null)

  // Managers change status inline and can request removals; admins (rarely here)
  // just view. Only managers get the actions column.
  const colCount = isManager ? 5 : 4

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('roomsTable.room')}</TableHead>
              <TableHead>{t('roomsTable.floor')}</TableHead>
              <TableHead>{t('roomsTable.type')}</TableHead>
              <TableHead>{t('roomsTable.status')}</TableHead>
              {isManager && (
                <TableHead className="w-24 text-right">
                  {t('common.actions')}
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={colCount}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))}

            {isError && (
              <TableRow>
                <TableCell colSpan={colCount} className="text-destructive">
                  {error instanceof ApiError
                    ? error.message
                    : t('roomsTable.failedToLoad')}
                </TableCell>
              </TableRow>
            )}

            {rooms && rooms.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={colCount}
                  className="text-muted-foreground py-8 text-center"
                >
                  {t('roomsTable.noRooms')}
                </TableCell>
              </TableRow>
            )}

            {rooms?.map((room) => (
              <TableRow key={room.id}>
                <TableCell className="font-medium">
                  {room.room_number}
                </TableCell>
                <TableCell>{room.floor ?? '—'}</TableCell>
                <TableCell>{room.room_type ?? '—'}</TableCell>
                <TableCell>
                  {isAdmin ? (
                    <RoomStatusBadge status={room.status} />
                  ) : (
                    <RoomStatusSelect room={room} />
                  )}
                </TableCell>
                {isManager && (
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={t('roomsTable.requestRemoval')}
                      onClick={() => setToRemove(room)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <RequestRemovalDialog
        resource="room"
        targetId={toRemove?.id ?? null}
        targetLabel={
          toRemove
            ? t('removalDialog.targetRoom', { number: toRemove.room_number })
            : ''
        }
        onClose={() => setToRemove(null)}
      />
    </>
  )
}
