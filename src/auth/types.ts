import type { Language, Theme, UserRole } from '@/lib/api/types'

// Mirrors the backend UserRole enum (admin | manager | front_desk | housekeeper).
export type Role = UserRole

export interface AuthUser {
  id: string
  hotelId: string
  role: Role
  theme: Theme
  preferredLanguage: Language
}
