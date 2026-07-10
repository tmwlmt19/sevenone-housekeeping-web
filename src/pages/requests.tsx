import { PageHeader } from '@/components/page-header'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type {
  AccessRequest,
  RequestStatus,
  RoomAddPayload,
  StaffAddPayload,
} from '@/lib/api/types'
import { humanize } from '@/lib/format'
import { useMyRequests } from '@/lib/queries/access-requests'
import { useRooms } from '@/lib/queries/rooms'
import { useStaff } from '@/lib/queries/staff'

const STATUS_VARIANT: Record<
  RequestStatus,
  'secondary' | 'default' | 'destructive'
> = {
  pending: 'secondary',
  approved: 'default',
  rejected: 'destructive',
}

export function RequestsPage() {
  const { data: requests, isLoading } = useMyRequests()
  const { data: staff } = useStaff()
  const { data: rooms } = useRooms()

  function summarize(req: AccessRequest): string {
    if (req.kind === 'add') {
      if (req.resource === 'staff') {
        const p = req.payload as unknown as StaffAddPayload | null
        return p ? `${p.name} · ${p.email} · ${humanize(p.role)}` : 'New staff'
      }
      const p = req.payload as unknown as RoomAddPayload | null
      return p
        ? `Room ${p.room_number}${p.room_type ? ` · ${p.room_type}` : ''}`
        : 'New room'
    }
    // remove — resolve the target's current label if we still have it
    if (req.resource === 'staff') {
      const t = staff?.find((s) => s.id === req.target_id)
      return t ? `${t.name} · ${t.email}` : 'Staff member'
    }
    const t = rooms?.find((r) => r.id === req.target_id)
    return t ? `Room ${t.room_number}` : 'Room'
  }

  return (
    <div>
      <PageHeader
        title="My requests"
        description="Staff and room changes you've asked an admin to approve."
      />
      {isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Request</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Admin note</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests && requests.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-muted-foreground py-8 text-center"
                  >
                    You haven't made any requests yet.
                  </TableCell>
                </TableRow>
              )}
              {requests?.map((req) => (
                <TableRow key={req.id}>
                  <TableCell className="font-medium capitalize">
                    {humanize(req.kind)} {req.resource}
                  </TableCell>
                  <TableCell>{summarize(req)}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[req.status]}>
                      {humanize(req.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {req.decision_note ?? '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
