import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api/client'
import type { HotelUpdate } from '@/lib/api/types'
import { unwrap } from '@/lib/api/unwrap'

import { qk } from './keys'
import { useHotelId } from './use-hotel-id'

export function useHotel() {
  const hotelId = useHotelId()
  return useQuery({
    queryKey: qk.hotel(hotelId),
    queryFn: async () =>
      unwrap(
        await api.GET('/api/v1/hotels/{hotel_id}', {
          params: { path: { hotel_id: hotelId } },
        }),
      ),
  })
}

export function useUpdateHotel() {
  const hotelId = useHotelId()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: HotelUpdate) =>
      unwrap(
        await api.PUT('/api/v1/hotels/{hotel_id}', {
          params: { path: { hotel_id: hotelId } },
          body,
        }),
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.hotel(hotelId) }),
  })
}

/** Toggle whether completing a task auto-approves (skips manager sign-off).
 * Available to hotel ops (manager/front-desk), not just admins. */
export function useSetAutoApprove() {
  const hotelId = useHotelId()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (autoApprove: boolean) =>
      unwrap(
        await api.PATCH('/api/v1/hotels/{hotel_id}/task-approval', {
          params: { path: { hotel_id: hotelId } },
          body: { auto_approve_tasks: autoApprove },
        }),
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.hotel(hotelId) }),
  })
}
