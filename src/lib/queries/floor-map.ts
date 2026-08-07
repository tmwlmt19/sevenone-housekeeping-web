import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api/client'
import type { FloorMapWrite, HotelMap } from '@/lib/api/types'
import { unwrap } from '@/lib/api/unwrap'

import { qk } from './keys'
import { useHotelId } from './use-hotel-id'

// The whole-hotel floor map (one payload; switch floors client-side). Managers
// and front desk may view; only managers save (see useSaveFloorMap + the API
// guards). Editing/viewing the map lives behind a min-width gate in the UI.
export function useHotelMap() {
  const hotelId = useHotelId()
  return useQuery({
    queryKey: qk.map(hotelId),
    // openapi-fetch widens the geometry tuple types ([x, y]) to number[] as they
    // pass through its response machinery; re-narrow to the schema type so the
    // Vertex/Polygon tuples flow cleanly into the map components.
    queryFn: async (): Promise<HotelMap> =>
      unwrap(
        await api.GET('/api/v1/hotels/{hotel_id}/map', {
          params: { path: { hotel_id: hotelId } },
        }),
      ) as HotelMap,
  })
}

export function useSaveFloorMap() {
  const hotelId = useHotelId()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      floor,
      body,
    }: {
      floor: number
      body: FloorMapWrite
    }) =>
      unwrap(
        await api.PUT('/api/v1/hotels/{hotel_id}/map/{floor}', {
          params: { path: { hotel_id: hotelId, floor } },
          body,
        }),
      ),
    onSuccess: () => {
      // Placement/decoration changes never touch room identity, but a save can
      // shift how rooms read on the list, so refresh both.
      qc.invalidateQueries({ queryKey: qk.map(hotelId) })
      qc.invalidateQueries({ queryKey: qk.rooms(hotelId) })
    },
  })
}
