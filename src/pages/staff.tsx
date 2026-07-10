import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, Outlet } from 'react-router-dom'

import { useAuth } from '@/auth/auth-context'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { StaffTable } from '@/features/staff/staff-table'

export function StaffPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const isManager = user?.role === 'manager'

  return (
    <div>
      <PageHeader
        title={t('staffPage.title')}
        description={t('staffPage.subtitle')}
        action={
          isManager ? (
            <Button asChild>
              <Link to="/staff/request">
                <Plus className="size-4" />
                {t('staffPage.requestStaff')}
              </Link>
            </Button>
          ) : undefined
        }
      />
      <StaffTable />
      <Outlet />
    </div>
  )
}
