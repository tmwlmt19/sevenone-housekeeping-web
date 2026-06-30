import { useAuth } from '@/auth/auth-context'

/** The current user's hotel id. Safe under RequireAuth (user always present). */
export function useHotelId(): string {
  const { user } = useAuth()
  if (!user) throw new Error('useHotelId requires an authenticated user')
  return user.hotelId
}
