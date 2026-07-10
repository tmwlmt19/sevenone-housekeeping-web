import { createBrowserRouter } from 'react-router-dom'

import { AppShell } from '@/components/layout/app-shell'
import { MobileShell } from '@/components/layout/mobile-shell'
import { RoomRequestModal } from '@/features/rooms/room-request-modal'
import { StaffRequestModal } from '@/features/staff/staff-request-modal'
import { TaskFormModal } from '@/features/tasks/task-form-modal'
import { AccountPage } from '@/pages/account'
import { DashboardPage } from '@/pages/dashboard'
import { HotelSettingsPage } from '@/pages/hotel-settings'
import { MyTasksPage } from '@/pages/my-tasks'
import { NotFoundPage } from '@/pages/not-found'
import { RequestsPage } from '@/pages/requests'
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
                  // Managers change room status inline and can request an add;
                  // approving the add is a platform-admin action in the console.
                  {
                    element: <RequireRole allow={['manager']} />,
                    children: [
                      { path: 'request', element: <RoomRequestModal /> },
                    ],
                  },
                ],
              },
              {
                path: 'staff',
                element: <StaffPage />,
                children: [
                  // Managers can request a staff add; approving it is a
                  // platform-admin action in the console.
                  {
                    element: <RequireRole allow={['manager']} />,
                    children: [
                      { path: 'request', element: <StaffRequestModal /> },
                    ],
                  },
                ],
              },
              // A manager's own filed requests and their status.
              {
                element: <RequireRole allow={['manager']} />,
                children: [{ path: 'requests', element: <RequestsPage /> }],
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
