import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api/client'
import type { RoomStatus } from '@/lib/api/types'
import { unwrap } from '@/lib/api/unwrap'

import { qk } from './keys'
import { useHotelId } from './use-hotel-id'

// Managers view rooms and change their status here. Adding/removing rooms goes
// through the request queue (see access-requests.ts); a room's full-edit
// (rename/floor/type) is a platform-admin action in the console.
export function useRooms() {
  const hotelId = useHotelId()
  return useQuery({
    queryKey: qk.rooms(hotelId),
    queryFn: async () =>
      unwrap(
        await api.GET('/api/v1/hotels/{hotel_id}/rooms', {
          params: { path: { hotel_id: hotelId } },
        }),
      ),
  })
}

export function useUpdateRoomStatus() {
  const hotelId = useHotelId()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      roomId,
      status,
    }: {
      roomId: string
      status: RoomStatus
    }) =>
      unwrap(
        await api.PATCH('/api/v1/hotels/{hotel_id}/rooms/{room_id}/status', {
          params: { path: { hotel_id: hotelId, room_id: roomId } },
          body: { status },
        }),
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.rooms(hotelId) }),
  })
}
