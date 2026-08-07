import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api/client'
import { unwrap } from '@/lib/api/unwrap'

import { qk } from './keys'
import { useHotelId } from './use-hotel-id'

/** The housekeeper's currently open shift (or null). Backs the clock-in gate. */
export function useCurrentShift() {
  const hotelId = useHotelId()
  return useQuery({
    queryKey: qk.currentShift(hotelId),
    queryFn: async () =>
      unwrap(
        await api.GET('/api/v1/hotels/{hotel_id}/shifts/current', {
          params: { path: { hotel_id: hotelId } },
        }),
      ),
  })
}

export function useClockIn() {
  const hotelId = useHotelId()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () =>
      unwrap(
        await api.POST('/api/v1/hotels/{hotel_id}/shifts/clock-in', {
          params: { path: { hotel_id: hotelId } },
        }),
      ),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: qk.currentShift(hotelId) }),
  })
}

export function useClockOut() {
  const hotelId = useHotelId()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () =>
      unwrap(
        await api.POST('/api/v1/hotels/{hotel_id}/shifts/clock-out', {
          params: { path: { hotel_id: hotelId } },
        }),
      ),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: qk.currentShift(hotelId) }),
  })
}
