import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, Outlet } from 'react-router-dom'

import { useAuth } from '@/auth/auth-context'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { RoomsTable } from '@/features/rooms/rooms-table'

export function RoomsPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const isManager = user?.role === 'manager'

  return (
    <div>
      <PageHeader
        title={t('roomsPage.title')}
        description={t('roomsPage.subtitle')}
        action={
          isManager ? (
            <Button asChild>
              <Link to="/rooms/request">
                <Plus className="size-4" />
                {t('roomsPage.requestRoom')}
              </Link>
            </Button>
          ) : undefined
        }
      />
      <RoomsTable />
      {/* Route-aware request modal renders here over the list. */}
      <Outlet />
    </div>
  )
}
