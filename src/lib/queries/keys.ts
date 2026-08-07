// Tenant-scoped TanStack Query keys. See docs/site-map.md "Shared query keys".

export interface TaskFilters {
  status?: string
  assignedTo?: string
}

/** Inclusive [from, to] date window (YYYY-MM-DD) for the stats endpoints. */
export interface StatRange {
  from?: string
  to?: string
}

export const qk = {
  hotel: (hotelId: string) => ['hotel', hotelId] as const,
  rooms: (hotelId: string) => ['rooms', hotelId] as const,
  room: (hotelId: string, roomId: string) => ['room', hotelId, roomId] as const,
  staff: (hotelId: string) => ['staff', hotelId] as const,
  staffMember: (hotelId: string, userId: string) =>
    ['user', hotelId, userId] as const,
  tasks: (hotelId: string, filters: TaskFilters = {}) =>
    ['tasks', hotelId, filters] as const,
  task: (hotelId: string, taskId: string) => ['task', hotelId, taskId] as const,
  accessRequests: (hotelId: string, status?: string) =>
    ['access-requests', hotelId, status ?? 'all'] as const,
  map: (hotelId: string) => ['map', hotelId] as const,
  statsCleanTimes: (hotelId: string, range: StatRange = {}) =>
    ['stats', 'clean-times', hotelId, range] as const,
  statsEfficiency: (hotelId: string, range: StatRange = {}) =>
    ['stats', 'efficiency', hotelId, range] as const,
  statsTaskLoad: (hotelId: string, range: StatRange = {}) =>
    ['stats', 'task-load', hotelId, range] as const,
  currentShift: (hotelId: string) => ['shift', 'current', hotelId] as const,
}
