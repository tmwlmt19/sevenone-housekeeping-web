import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Outlet } from 'react-router-dom'

import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TasksBoard } from '@/features/tasks/tasks-board'
import { useStaff } from '@/lib/queries/staff'

const ALL = 'all'

export function TasksPage() {
  const { t } = useTranslation()
  const { data: staff } = useStaff()
  const [assignee, setAssignee] = useState(ALL)

  return (
    <div>
      <PageHeader
        title={t('tasksPage.title')}
        description={t('tasksPage.subtitle')}
        action={
          <Button asChild>
            <Link to="/tasks/new">
              <Plus className="size-4" />
              {t('tasksPage.newTask')}
            </Link>
          </Button>
        }
      />

      <div className="mb-4 flex items-center gap-2">
        <span className="text-muted-foreground text-sm">
          {t('tasksPage.assignee')}
        </span>
        <Select value={assignee} onValueChange={setAssignee}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t('tasksPage.everyone')}</SelectItem>
            {staff?.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <TasksBoard assignedTo={assignee === ALL ? undefined : assignee} />
      <Outlet />
    </div>
  )
}
