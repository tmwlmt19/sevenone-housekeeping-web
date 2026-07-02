import { Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { useAuth } from '@/auth/auth-context'
import { ConfirmDialog } from '@/components/confirm-dialog'
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
import type { Staff } from '@/lib/api/types'
import { ApiError } from '@/lib/api/unwrap'
import { humanize } from '@/lib/format'
import { useDeleteStaff, useStaff } from '@/lib/queries/staff'

export function StaffTable() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const { data: staff, isLoading, isError, error } = useStaff()
  const deleteStaff = useDeleteStaff()
  const [toDelete, setToDelete] = useState<Staff | null>(null)

  const colCount = isAdmin ? 4 : 3

  function handleDelete() {
    if (!toDelete) return
    deleteStaff.mutate(toDelete.id, {
      onSuccess: () => {
        toast.success(`${toDelete.name} removed`)
        setToDelete(null)
      },
      onError: (e) =>
        toast.error(e instanceof ApiError ? e.message : 'Failed to remove'),
    })
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              {isAdmin && (
                <TableHead className="w-24 text-right">Actions</TableHead>
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
                    : 'Failed to load staff'}
                </TableCell>
              </TableRow>
            )}

            {staff && staff.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={colCount}
                  className="text-muted-foreground py-8 text-center"
                >
                  No staff yet.
                </TableCell>
              </TableRow>
            )}

            {staff?.map((member) => (
              <TableRow key={member.id}>
                <TableCell className="font-medium">{member.name}</TableCell>
                <TableCell>{member.email}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{humanize(member.role)}</Badge>
                </TableCell>
                {isAdmin && (
                  <TableCell className="text-right">
                    <Button
                      asChild
                      variant="ghost"
                      size="icon"
                      aria-label="Edit"
                    >
                      <Link to={`/staff/${member.id}`}>
                        <Pencil className="size-4" />
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Delete"
                      onClick={() => setToDelete(member)}
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

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Remove staff member?"
        description={
          toDelete ? `${toDelete.name} will lose access to this hotel.` : ''
        }
        confirmLabel="Remove"
        destructive
        loading={deleteStaff.isPending}
        onConfirm={handleDelete}
      />
    </>
  )
}
