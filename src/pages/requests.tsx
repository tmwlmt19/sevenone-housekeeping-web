import { useTranslation } from 'react-i18next'

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
  const { t } = useTranslation()
  const { data: requests, isLoading } = useMyRequests()
  const { data: staff } = useStaff()
  const { data: rooms } = useRooms()

  function summarize(req: AccessRequest): string {
    if (req.kind === 'add') {
      if (req.resource === 'staff') {
        const p = req.payload as unknown as StaffAddPayload | null
        return p
          ? `${p.name} · ${p.email} · ${t(`enums.role.${p.role}`)}`
          : t('requests.newStaff')
      }
      const p = req.payload as unknown as RoomAddPayload | null
      return p
        ? `${t('requests.room', { number: p.room_number })}${p.room_type ? ` · ${p.room_type}` : ''}`
        : t('requests.newRoom')
    }
    // remove — resolve the target's current label if we still have it
    if (req.resource === 'staff') {
      const member = staff?.find((s) => s.id === req.target_id)
      return member
        ? `${member.name} · ${member.email}`
        : t('requests.staffMember')
    }
    const room = rooms?.find((r) => r.id === req.target_id)
    return room
      ? t('requests.room', { number: room.room_number })
      : t('requests.roomWord')
  }

  return (
    <div>
      <PageHeader
        title={t('requests.title')}
        description={t('requests.subtitle')}
      />
      {isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('requests.request')}</TableHead>
                <TableHead>{t('requests.details')}</TableHead>
                <TableHead>{t('requests.status')}</TableHead>
                <TableHead>{t('requests.adminNote')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests && requests.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-muted-foreground py-8 text-center"
                  >
                    {t('requests.empty')}
                  </TableCell>
                </TableRow>
              )}
              {requests?.map((req) => (
                <TableRow key={req.id}>
                  <TableCell className="font-medium">
                    {t('requests.kindResource', {
                      kind: t(`enums.requestKind.${req.kind}`),
                      resource: t(`enums.resource.${req.resource}`),
                    })}
                  </TableCell>
                  <TableCell>{summarize(req)}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[req.status]}>
                      {t(`enums.requestStatus.${req.status}`)}
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
