import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useAuth } from '@/auth/auth-context'
import { RequestRemovalDialog } from '@/features/access-requests/request-removal-dialog'
import { RoomStatusControl } from '@/features/rooms/room-status-control'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { type Room } from '@/lib/api/types'
import { ApiError } from '@/lib/api/unwrap'
import { usePendingRequests } from '@/lib/queries/access-requests'
import { useRooms } from '@/lib/queries/rooms'

export function RoomsTable() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const isManager = user?.role === 'manager'
  const { data: rooms, isLoading, isError, error } = useRooms()
  // Pending requests shown inline (managers only — they file and track requests;
  // other roles can't list them). Adds become new rows; removes flag the row.
  const { data: pending } = usePendingRequests(isManager)
  const pendingRooms = pending?.roomAdds ?? []
  const removeIds = pending?.roomRemoveIds
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

            {rooms && rooms.length === 0 && pendingRooms.length === 0 && (
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
                  <RoomStatusControl room={room} />
                </TableCell>
                {isManager && (
                  <TableCell className="text-right">
                    {removeIds?.has(room.id) ? (
                      <Badge variant="outline">
                        {t('common.pendingRemoval')}
                      </Badge>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t('roomsTable.requestRemoval')}
                        onClick={() => setToRemove(room)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}

            {/* Requested rooms awaiting admin approval — read-only, flagged. */}
            {pendingRooms.map(({ id, payload }) => (
              <TableRow key={`pending-${id}`} className="text-muted-foreground">
                <TableCell className="font-medium">
                  {payload.room_number}
                </TableCell>
                <TableCell>{payload.floor ?? '—'}</TableCell>
                <TableCell>{payload.room_type ?? '—'}</TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {t('enums.requestStatus.pending')}
                  </Badge>
                </TableCell>
                {isManager && <TableCell />}
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
