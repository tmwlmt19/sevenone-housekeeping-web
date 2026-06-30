// Convenience aliases over the generated OpenAPI component schemas, so feature
// code imports `Room` instead of `components['schemas']['RoomRead']`.
import type { components } from './schema'

type Schemas = components['schemas']

export type Hotel = Schemas['HotelRead']
export type HotelUpdate = Schemas['HotelUpdate']

export type Room = Schemas['RoomRead']
export type RoomCreate = Schemas['RoomCreate']
export type RoomUpdate = Schemas['RoomUpdate']
export type RoomStatus = Schemas['RoomStatus']

export type Staff = Schemas['UserRead']
export type StaffCreate = Schemas['UserCreate']
export type StaffUpdate = Schemas['UserUpdate']
export type UserRole = Schemas['UserRole']

export type Task = Schemas['TaskRead']
export type TaskCreate = Schemas['TaskCreate']
export type TaskUpdate = Schemas['TaskUpdate']
export type TaskStatus = Schemas['TaskStatus']
export type TaskPriority = Schemas['TaskPriority']

export const ROOM_STATUSES: RoomStatus[] = [
  'clean',
  'dirty',
  'in_progress',
  'out_of_service',
]

export const TASK_STATUSES: TaskStatus[] = [
  'pending',
  'assigned',
  'in_progress',
  'completed',
]

export const TASK_PRIORITIES: TaskPriority[] = ['low', 'normal', 'urgent']

export const USER_ROLES: UserRole[] = ['admin', 'manager', 'housekeeper']
