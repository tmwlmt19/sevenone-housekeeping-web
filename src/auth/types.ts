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

/** Roles with a hotel's operational powers — room status, task CRUD, approving
 * task completion. Front desk shares these with managers; it differs only in
 * that it cannot file staff/room access requests (those stay manager-only). */
export function isHotelOps(role: Role | undefined): boolean {
  return role === 'manager' || role === 'front_desk'
}
