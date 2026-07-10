import { useQuery } from '@tanstack/react-query'

import { api } from '@/lib/api/client'
import { unwrap } from '@/lib/api/unwrap'

import { qk } from './keys'
import { useHotelId } from './use-hotel-id'

// Managers view staff here; adding, editing, and removing staff are not direct
// actions in this app. Adds/removes go through the request queue
// (see access-requests.ts); edits are done by a platform admin in the console.
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
