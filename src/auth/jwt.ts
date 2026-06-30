import type { Role } from './types'

// Claims the backend puts in the access token (see auth router / docs/auth.md).
export interface JwtClaims {
  sub: string
  hotel_id: string
  role: Role
  exp: number
}

/** Decode a JWT payload without verifying the signature (the server verifies). */
export function decodeJwt(token: string): JwtClaims | null {
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(json) as JwtClaims
  } catch {
    return null
  }
}

export function isExpired(claims: JwtClaims): boolean {
  return claims.exp * 1000 <= Date.now()
}
