import { createBrowserRouter } from 'react-router-dom'

import { AppShell } from '@/components/layout/app-shell'
import { MobileShell } from '@/components/layout/mobile-shell'
import { RoomFormModal } from '@/features/rooms/room-form-modal'
import { StaffFormModal } from '@/features/staff/staff-form-modal'
import { TaskFormModal } from '@/features/tasks/task-form-modal'
import { AccountPage } from '@/pages/account'
import { DashboardPage } from '@/pages/dashboard'
import { HotelSettingsPage } from '@/pages/hotel-settings'
import { MyTasksPage } from '@/pages/my-tasks'
import { NotFoundPage } from '@/pages/not-found'
import { RoomsPage } from '@/pages/rooms'
import { StaffPage } from '@/pages/staff'
import { TasksPage } from '@/pages/tasks'

import { RequireAuth, RequireRole, RootRedirect } from './guards'

export const router = createBrowserRouter([
  {
    element: <RequireAuth />,
    children: [
      { index: true, element: <RootRedirect /> },
      // Self-service account page — any authenticated role.
      { path: 'account', element: <AccountPage /> },
      // Manager / admin — desktop AppShell.
      {
        element: <RequireRole allow={['admin', 'manager']} />,
        children: [
          {
            element: <AppShell />,
            children: [
              { path: 'dashboard', element: <DashboardPage /> },
              {
                path: 'rooms',
                element: <RoomsPage />,
                children: [
                  // Adding/editing/removing rooms is admin-only; managers
                  // change room status inline from the table.
                  {
                    element: <RequireRole allow={['admin']} />,
                    children: [
                      { path: 'new', element: <RoomFormModal /> },
                      { path: ':roomId', element: <RoomFormModal /> },
                    ],
                  },
                ],
              },
              {
                path: 'staff',
                element: <StaffPage />,
                children: [
                  // Creating/editing staff is admin-only.
                  {
                    element: <RequireRole allow={['admin']} />,
                    children: [
                      { path: 'new', element: <StaffFormModal /> },
                      { path: ':userId', element: <StaffFormModal /> },
                    ],
                  },
                ],
              },
              {
                path: 'tasks',
                element: <TasksPage />,
                children: [
                  { path: 'new', element: <TaskFormModal /> },
                  { path: ':taskId', element: <TaskFormModal /> },
                ],
              },
            ],
          },
        ],
      },
      // Admin only — hotel settings, still in the AppShell.
      {
        element: <RequireRole allow={['admin']} />,
        children: [
          {
            element: <AppShell />,
            children: [
              { path: 'settings/hotel', element: <HotelSettingsPage /> },
            ],
          },
        ],
      },
      // Housekeeper — mobile-first shell.
      {
        element: <RequireRole allow={['housekeeper']} />,
        children: [
          {
            element: <MobileShell />,
            children: [{ path: 'my-tasks', element: <MyTasksPage /> }],
          },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])
