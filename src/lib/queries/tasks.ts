import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api/client'
import type { TaskCreate, TaskStatus, TaskUpdate } from '@/lib/api/types'
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

/** Call-in: move all of one housekeeper's open tasks to a single other one. */
export function useReassignWorkload() {
  const hotelId = useHotelId()
  const invalidate = useInvalidateTaskData()
  return useMutation({
    mutationFn: async (body: {
      from_housekeeper_id: string
      to_housekeeper_id: string
    }) =>
      unwrap(
        await api.POST('/api/v1/hotels/{hotel_id}/tasks/reassign', {
          params: { path: { hotel_id: hotelId } },
          body,
        }),
      ),
    onSuccess: invalidate,
  })
}

/** No-show: split one housekeeper's open tasks evenly across the others. */
export function useRedistributeWorkload() {
  const hotelId = useHotelId()
  const invalidate = useInvalidateTaskData()
  return useMutation({
    mutationFn: async (body: { from_housekeeper_id: string }) =>
      unwrap(
        await api.POST('/api/v1/hotels/{hotel_id}/tasks/redistribute', {
          params: { path: { hotel_id: hotelId } },
          body,
        }),
      ),
    onSuccess: invalidate,
  })
}

/** Clear (soft-archive) all completed tasks off the board. */
export function useClearCompleted() {
  const hotelId = useHotelId()
  const invalidate = useInvalidateTaskData()
  return useMutation({
    mutationFn: async () =>
      unwrap(
        await api.POST('/api/v1/hotels/{hotel_id}/tasks/clear-completed', {
          params: { path: { hotel_id: hotelId } },
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
