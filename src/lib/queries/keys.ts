// Tenant-scoped TanStack Query keys. See docs/site-map.md "Shared query keys".

export interface TaskFilters {
  status?: string
  assignedTo?: string
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
}
