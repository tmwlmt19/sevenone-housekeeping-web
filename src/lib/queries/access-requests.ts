import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api/client'
import type { AccessRequestCreate, RequestStatus } from '@/lib/api/types'
import { unwrap } from '@/lib/api/unwrap'

import { qk } from './keys'
import { useHotelId } from './use-hotel-id'

/** This hotel's requests (a manager's own filed add/remove requests). */
export function useMyRequests(status?: RequestStatus) {
  const hotelId = useHotelId()
  return useQuery({
    queryKey: qk.accessRequests(hotelId, status),
    queryFn: async () =>
      unwrap(
        await api.GET('/api/v1/hotels/{hotel_id}/access-requests', {
          params: {
            path: { hotel_id: hotelId },
            query: status ? { status } : {},
          },
        }),
      ),
  })
}

export function useFileRequest() {
  const hotelId = useHotelId()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: AccessRequestCreate) =>
      unwrap(
        await api.POST('/api/v1/hotels/{hotel_id}/access-requests', {
          params: { path: { hotel_id: hotelId } },
          body,
        }),
      ),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['access-requests', hotelId] }),
  })
}
