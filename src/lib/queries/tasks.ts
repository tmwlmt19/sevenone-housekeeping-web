import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api/client'
import type {
  DirtyRoomImportRequest,
  TaskCreate,
  TaskStatus,
  TaskUpdate,
} from '@/lib/api/types'
import { unwrap } from '@/lib/api/unwrap'

import { qk, type TaskFilters } from './keys'
import { useHotelId } from './use-hotel-id'

export function useTasks(filters: TaskFilters = {}) {
  const hotelId = useHotelId()
  return useQuery({
    queryKey: qk.tasks(hotelId, filters),
    queryFn: async () =>
      unwrap(
        await api.GET('/api/v1/hotels/{hotel_id}/tasks', {
          params: {
            path: { hotel_id: hotelId },
            query: {
              status: filters.status as TaskStatus | undefined,
              assigned_to: filters.assignedTo,
            },
          },
        }),
      ),
  })
}

/** Invalidate everything a task mutation can affect (incl. rooms — completing a
 * task flips its room to clean on the backend). */
function useInvalidateTaskData() {
  const hotelId = useHotelId()
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: ['tasks', hotelId] })
    qc.invalidateQueries({ queryKey: qk.rooms(hotelId) })
  }
}

export function useCreateTask() {
  const hotelId = useHotelId()
  const invalidate = useInvalidateTaskData()
  return useMutation({
    mutationFn: async (body: TaskCreate) =>
      unwrap(
        await api.POST('/api/v1/hotels/{hotel_id}/tasks', {
          params: { path: { hotel_id: hotelId } },
          body,
        }),
      ),
    onSuccess: invalidate,
  })
}

/** Bulk-import dirty rooms: set them dirty, create a task each, and optionally
 * split the new tasks evenly across the chosen housekeepers. */
export function useImportDirtyRooms() {
  const hotelId = useHotelId()
  const invalidate = useInvalidateTaskData()
  return useMutation({
    mutationFn: async (body: DirtyRoomImportRequest) =>
      unwrap(
        await api.POST('/api/v1/hotels/{hotel_id}/tasks/import', {
          params: { path: { hotel_id: hotelId } },
          body,
        }),
      ),
    onSuccess: invalidate,
  })
}

export function useUpdateTask() {
  const hotelId = useHotelId()
  const invalidate = useInvalidateTaskData()
  return useMutation({
    mutationFn: async ({
      taskId,
      body,
    }: {
      taskId: string
      body: TaskUpdate
    }) =>
      unwrap(
        await api.PUT('/api/v1/hotels/{hotel_id}/tasks/{task_id}', {
          params: { path: { hotel_id: hotelId, task_id: taskId } },
          body,
        }),
      ),
    onSuccess: invalidate,
  })
}

export function useUpdateTaskStatus() {
  const hotelId = useHotelId()
  const invalidate = useInvalidateTaskData()
  return useMutation({
    mutationFn: async ({
      taskId,
      status,
    }: {
      taskId: string
      status: TaskStatus
    }) =>
      unwrap(
        await api.PATCH('/api/v1/hotels/{hotel_id}/tasks/{task_id}/status', {
          params: { path: { hotel_id: hotelId, task_id: taskId } },
          body: { status },
        }),
      ),
    onSuccess: invalidate,
  })
}
