import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api/client'
import type { StaffCreate, StaffUpdate } from '@/lib/api/types'
import { ensureOk, unwrap } from '@/lib/api/unwrap'

import { qk } from './keys'
import { useHotelId } from './use-hotel-id'

export function useStaff() {
  const hotelId = useHotelId()
  return useQuery({
    queryKey: qk.staff(hotelId),
    queryFn: async () =>
      unwrap(
        await api.GET('/api/v1/hotels/{hotel_id}/users', {
          params: { path: { hotel_id: hotelId } },
        }),
      ),
  })
}

export function useCreateStaff() {
  const hotelId = useHotelId()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: StaffCreate) =>
      unwrap(
        await api.POST('/api/v1/hotels/{hotel_id}/users', {
          params: { path: { hotel_id: hotelId } },
          body,
        }),
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.staff(hotelId) }),
  })
}

export function useUpdateStaff() {
  const hotelId = useHotelId()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      userId,
      body,
    }: {
      userId: string
      body: StaffUpdate
    }) =>
      unwrap(
        await api.PUT('/api/v1/hotels/{hotel_id}/users/{user_id}', {
          params: { path: { hotel_id: hotelId, user_id: userId } },
          body,
        }),
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.staff(hotelId) }),
  })
}

export function useDeleteStaff() {
  const hotelId = useHotelId()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (userId: string) =>
      ensureOk(
        await api.DELETE('/api/v1/hotels/{hotel_id}/users/{user_id}', {
          params: { path: { hotel_id: hotelId, user_id: userId } },
        }),
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.staff(hotelId) }),
  })
}
