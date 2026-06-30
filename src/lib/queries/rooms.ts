import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api/client'
import type { RoomCreate, RoomUpdate } from '@/lib/api/types'
import { ensureOk, unwrap } from '@/lib/api/unwrap'

import { qk } from './keys'
import { useHotelId } from './use-hotel-id'

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

export function useCreateRoom() {
  const hotelId = useHotelId()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: RoomCreate) =>
      unwrap(
        await api.POST('/api/v1/hotels/{hotel_id}/rooms', {
          params: { path: { hotel_id: hotelId } },
          body,
        }),
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.rooms(hotelId) }),
  })
}

export function useUpdateRoom() {
  const hotelId = useHotelId()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      roomId,
      body,
    }: {
      roomId: string
      body: RoomUpdate
    }) =>
      unwrap(
        await api.PUT('/api/v1/hotels/{hotel_id}/rooms/{room_id}', {
          params: { path: { hotel_id: hotelId, room_id: roomId } },
          body,
        }),
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.rooms(hotelId) }),
  })
}

export function useDeleteRoom() {
  const hotelId = useHotelId()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (roomId: string) =>
      ensureOk(
        await api.DELETE('/api/v1/hotels/{hotel_id}/rooms/{room_id}', {
          params: { path: { hotel_id: hotelId, room_id: roomId } },
        }),
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.rooms(hotelId) }),
  })
}
