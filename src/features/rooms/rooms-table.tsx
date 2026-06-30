import { Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { RoomStatusBadge } from '@/components/status-badge'
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
import type { Room } from '@/lib/api/types'
import { ApiError } from '@/lib/api/unwrap'
import { useDeleteRoom, useRooms } from '@/lib/queries/rooms'

export function RoomsTable() {
  const { data: rooms, isLoading, isError, error } = useRooms()
  const deleteRoom = useDeleteRoom()
  const [toDelete, setToDelete] = useState<Room | null>(null)

  function handleDelete() {
    if (!toDelete) return
    deleteRoom.mutate(toDelete.id, {
      onSuccess: () => {
        toast.success(`Room ${toDelete.room_number} deleted`)
        setToDelete(null)
      },
      onError: (e) =>
        toast.error(
          e instanceof ApiError ? e.message : 'Failed to delete room',
        ),
    })
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Room</TableHead>
              <TableHead>Floor</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={5}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))}

            {isError && (
              <TableRow>
                <TableCell colSpan={5} className="text-destructive">
                  {error instanceof ApiError
                    ? error.message
                    : 'Failed to load rooms'}
                </TableCell>
              </TableRow>
            )}

            {rooms && rooms.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-muted-foreground py-8 text-center"
                >
                  No rooms yet. Add your first room to get started.
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
                  <RoomStatusBadge status={room.status} />
                </TableCell>
                <TableCell className="text-right">
                  <Button asChild variant="ghost" size="icon" aria-label="Edit">
                    <Link to={`/rooms/${room.id}`}>
                      <Pencil className="size-4" />
                    </Link>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Delete"
                    onClick={() => setToDelete(room)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Delete room?"
        description={
          toDelete
            ? `Room ${toDelete.room_number} will be permanently removed.`
            : ''
        }
        confirmLabel="Delete"
        destructive
        loading={deleteRoom.isPending}
        onConfirm={handleDelete}
      />
    </>
  )
}
