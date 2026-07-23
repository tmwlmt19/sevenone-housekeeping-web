import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api/client'
import type {
  AccessRequestCreate,
  RequestStatus,
  RoomAddPayload,
  StaffAddPayload,
} from '@/lib/api/types'
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

export interface PendingStaffAdd {
  id: string
  payload: StaffAddPayload
}
export interface PendingRoomAdd {
  id: string
  payload: RoomAddPayload
}
export interface PendingRequests {
  /** Requested-but-unapproved staff/rooms, shown as new inline rows. */
  staffAdds: PendingStaffAdd[]
  roomAdds: PendingRoomAdd[]
  /** IDs of existing staff/rooms with a pending removal, to flag their row. */
  staffRemoveIds: Set<string>
  roomRemoveIds: Set<string>
}

/** Pending requests for this hotel, grouped so the staff and rooms pages can
 * reflect them inline: adds become new "pending" rows, removes flag the existing
 * row. Only the requester roles (manager/admin) may list requests, so callers
 * pass `enabled=false` for others (front desk) to skip the call rather than 403. */
export function usePendingRequests(enabled: boolean) {
  const hotelId = useHotelId()
  return useQuery({
    queryKey: qk.accessRequests(hotelId, 'pending'),
    enabled,
    queryFn: async () =>
      unwrap(
        await api.GET('/api/v1/hotels/{hotel_id}/access-requests', {
          params: {
            path: { hotel_id: hotelId },
            query: { status: 'pending' },
          },
        }),
      ),
    select: (rows): PendingRequests => {
      const staffAdds: PendingStaffAdd[] = []
      const roomAdds: PendingRoomAdd[] = []
      const staffRemoveIds = new Set<string>()
      const roomRemoveIds = new Set<string>()
      for (const r of rows) {
        if (r.kind === 'add') {
          if (r.payload == null) continue
          if (r.resource === 'staff') {
            staffAdds.push({
              id: r.id,
              payload: r.payload as unknown as StaffAddPayload,
            })
          } else if (r.resource === 'room') {
            roomAdds.push({
              id: r.id,
              payload: r.payload as unknown as RoomAddPayload,
            })
          }
        } else if (r.kind === 'remove' && r.target_id) {
          if (r.resource === 'staff') staffRemoveIds.add(r.target_id)
          else if (r.resource === 'room') roomRemoveIds.add(r.target_id)
        }
      }
      return { staffAdds, roomAdds, staffRemoveIds, roomRemoveIds }
    },
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
