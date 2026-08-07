import { useQuery } from '@tanstack/react-query'

import { api } from '@/lib/api/client'
import { unwrap } from '@/lib/api/unwrap'

import { qk, type StatRange } from './keys'
import { useHotelId } from './use-hotel-id'

// The backend defaults the window when from/to are omitted; we always pass the
// range the dashboard has selected. Empty strings are dropped so "no bound"
// falls back to the server default.
function query(range: StatRange) {
  return {
    from: range.from || undefined,
    to: range.to || undefined,
  }
}

export function useCleanTimes(range: StatRange = {}) {
  const hotelId = useHotelId()
  return useQuery({
    queryKey: qk.statsCleanTimes(hotelId, range),
    queryFn: async () =>
      unwrap(
        await api.GET('/api/v1/hotels/{hotel_id}/stats/clean-times', {
          params: { path: { hotel_id: hotelId }, query: query(range) },
        }),
      ),
  })
}

export function useEfficiency(range: StatRange = {}) {
  const hotelId = useHotelId()
  return useQuery({
    queryKey: qk.statsEfficiency(hotelId, range),
    queryFn: async () =>
      unwrap(
        await api.GET('/api/v1/hotels/{hotel_id}/stats/efficiency', {
          params: { path: { hotel_id: hotelId }, query: query(range) },
        }),
      ),
  })
}

export function useTaskLoad(range: StatRange = {}) {
  const hotelId = useHotelId()
  return useQuery({
    queryKey: qk.statsTaskLoad(hotelId, range),
    queryFn: async () =>
      unwrap(
        await api.GET('/api/v1/hotels/{hotel_id}/stats/task-load', {
          params: { path: { hotel_id: hotelId }, query: query(range) },
        }),
      ),
  })
}
