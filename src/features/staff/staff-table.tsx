import { Info, UserMinus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useAuth } from '@/auth/auth-context'
import { RequestRemovalDialog } from '@/features/access-requests/request-removal-dialog'
import { StaffDetailsDialog } from '@/features/staff/staff-details-dialog'
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
import { usePendingRequests } from '@/lib/queries/access-requests'
import { useStaff } from '@/lib/queries/staff'

export function StaffTable() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const isManager = user?.role === 'manager'
  const { data: staff, isLoading, isError, error } = useStaff()
  // Pending requests shown inline (managers only — they file and track requests;
  // other roles can't list them). Adds become new rows; removes flag the row.
  const { data: pending } = usePendingRequests(isManager)
  const pendingStaff = pending?.staffAdds ?? []
  const removeIds = pending?.staffRemoveIds
  const [toRemove, setToRemove] = useState<Staff | null>(null)
  const [detail, setDetail] = useState<Staff | null>(null)

  // Everyone who can see this page gets an actions column: a read-only details
  // button for all, plus (managers only) removal requests.
  const colCount = 4

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('staffTable.name')}</TableHead>
              <TableHead>{t('staffTable.email')}</TableHead>
              <TableHead>{t('staffTable.role')}</TableHead>
              <TableHead className="w-24 text-right">
                {t('common.actions')}
              </TableHead>
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
                    : t('staffTable.failedToLoad')}
                </TableCell>
              </TableRow>
            )}

            {staff && staff.length === 0 && pendingStaff.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={colCount}
                  className="text-muted-foreground py-8 text-center"
                >
                  {t('staffTable.noStaff')}
                </TableCell>
              </TableRow>
            )}

            {staff?.map((member) => (
              <TableRow key={member.id}>
                <TableCell className="font-medium">{member.name}</TableCell>
                <TableCell>{member.email}</TableCell>
                <TableCell>
                  <Badge variant="secondary">
                    {t(`enums.role.${member.role}`)}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={t('common.viewDetails')}
                      onClick={() => setDetail(member)}
                    >
                      <Info className="size-4" />
                    </Button>
                    {isManager &&
                      (removeIds?.has(member.id) ? (
                        <Badge variant="outline">
                          {t('common.pendingRemoval')}
                        </Badge>
                      ) : (
                        member.id !== user?.id &&
                        member.role !== 'admin' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={t('staffTable.requestRemoval')}
                            onClick={() => setToRemove(member)}
                          >
                            <UserMinus className="size-4" />
                          </Button>
                        )
                      ))}
                  </div>
                </TableCell>
              </TableRow>
            ))}

            {/* Requested staff awaiting admin approval — read-only, flagged. */}
            {pendingStaff.map(({ id, payload }) => (
              <TableRow key={`pending-${id}`} className="text-muted-foreground">
                <TableCell className="font-medium">{payload.name}</TableCell>
                <TableCell>{payload.email}</TableCell>
                <TableCell>
                  <Badge variant="secondary">
                    {t(`enums.role.${payload.role}`)}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Badge variant="outline">
                    {t('enums.requestStatus.pending')}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <RequestRemovalDialog
        resource="staff"
        targetId={toRemove?.id ?? null}
        targetLabel={toRemove ? `${toRemove.name} (${toRemove.email})` : ''}
        onClose={() => setToRemove(null)}
      />

      <StaffDetailsDialog member={detail} onClose={() => setDetail(null)} />
    </>
  )
}
