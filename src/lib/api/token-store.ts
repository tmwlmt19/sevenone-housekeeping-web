// Single source of truth for the JWT. Both the auth context and the API client
// read/write through here so they stay in sync.
//
// SECURITY NOTE: storing the token in localStorage is the simplest option but is
// XSS-exposed. The hardening path (in-memory token + httpOnly refresh cookie) is
// documented in PLAN.md §3 and requires backend support.
const STORAGE_KEY = 'sevenone.token'

let onUnauthorized: (() => void) | null = null

export function getToken(): string | null {
  return localStorage.getItem(STORAGE_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(STORAGE_KEY, token)
}

export function clearToken(): void {
  localStorage.removeItem(STORAGE_KEY)
}

/** Register a callback invoked when the API sees a 401 (token expired/invalid). */
export function setOnUnauthorized(fn: (() => void) | null): void {
  onUnauthorized = fn
}

export function notifyUnauthorized(): void {
  onUnauthorized?.()
}
