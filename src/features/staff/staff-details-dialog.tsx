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
import type { Staff } from '@/lib/api/types'
import { formatDate } from '@/lib/format'

/**
 * Read-only staff details for managers/front desk. Controlled: open whenever
 * `member` is non-null.
 */
export function StaffDetailsDialog({
  member,
  onClose,
}: {
  member: Staff | null
  onClose: () => void
}) {
  const { t } = useTranslation()

  return (
    <Dialog
      open={member !== null}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogContent>
        {member && (
          <>
            <DialogHeader>
              <DialogTitle>{member.name}</DialogTitle>
              <DialogDescription>{t('staffDetails.subtitle')}</DialogDescription>
            </DialogHeader>
            <dl className="mt-2">
              <DetailRow label={t('staffTable.email')}>
                {member.email}
              </DetailRow>
              <DetailRow label={t('staffTable.role')}>
                <Badge variant="secondary">
                  {t(`enums.role.${member.role}`)}
                </Badge>
              </DetailRow>
              <DetailRow label={t('staffDetails.accountStatus')}>
                {member.must_change_password
                  ? t('staffDetails.awaitingFirstSignIn')
                  : t('staffDetails.active')}
              </DetailRow>
              <DetailRow label={t('staffDetails.added')}>
                {formatDate(member.created_at)}
              </DetailRow>
            </dl>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
