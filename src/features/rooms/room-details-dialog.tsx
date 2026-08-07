import { useTranslation } from 'react-i18next'

import { DetailRow } from '@/components/detail-row'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { Room } from '@/lib/api/types'
import { formatDate } from '@/lib/format'
import { useStaff } from '@/lib/queries/staff'

/**
 * Read-only room details for managers/front desk — surfaces the fields the
 * table doesn't show, notably "last cleaned by" (stored as a user id, resolved
 * to a name here). Controlled: open whenever `room` is non-null.
 */
export function RoomDetailsDialog({
  room,
  onClose,
}: {
  room: Room | null
  onClose: () => void
}) {
  const { t } = useTranslation()
  const { data: staff } = useStaff()

  // last_cleaned_by is a user id; resolve to a name (may be gone if the staff
  // member was since removed).
  const lastCleanedBy = room?.last_cleaned_by
    ? (staff?.find((s) => s.id === room.last_cleaned_by)?.name ??
      t('common.unknown'))
    : null

  return (
    <Dialog
      open={room !== null}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogContent>
        {room && (
          <>
            <DialogHeader>
              <DialogTitle>
                {t('roomDetails.title', { number: room.room_number })}
              </DialogTitle>
              <DialogDescription>{t('roomDetails.subtitle')}</DialogDescription>
            </DialogHeader>
            <dl className="mt-2">
              <DetailRow label={t('roomsTable.floor')}>
                {room.floor ?? '—'}
              </DetailRow>
              <DetailRow label={t('roomsTable.type')}>
                {room.room_type ?? '—'}
              </DetailRow>
              <DetailRow label={t('roomsTable.status')}>
                <Badge variant="secondary">
                  {t(`enums.roomStatus.${room.status}`)}
                </Badge>
              </DetailRow>
              <DetailRow label={t('roomDetails.lastCleanedBy')}>
                {lastCleanedBy ?? t('roomDetails.notCleanedYet')}
              </DetailRow>
              <DetailRow label={t('roomDetails.added')}>
                {formatDate(room.created_at)}
              </DetailRow>
            </dl>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
