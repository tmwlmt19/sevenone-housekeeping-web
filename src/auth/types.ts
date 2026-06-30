// Mirrors the backend UserRole enum (admin | manager | housekeeper).
export type Role = 'admin' | 'manager' | 'housekeeper'

export interface AuthUser {
  id: string
  hotelId: string
  role: Role
}
