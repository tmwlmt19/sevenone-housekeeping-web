/**
 * Unit tests for redirectToLogin — the 401 bounce that sends an unauthenticated
 * user to the shared login app with a return URL (the browser-level behaviour is
 * covered by AUTH-08 / AUTH-09-N in the E2E suite).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/env', () => ({
  env: { loginUrl: 'http://localhost:5174', apiBaseUrl: 'http://localhost:8000' },
}))

function stubLocation(href: string) {
  Object.defineProperty(window, 'location', {
    value: { href },
    writable: true,
    configurable: true,
  })
}

describe('redirectToLogin', () => {
  beforeEach(() => {
    // Fresh module each test so the internal `redirecting` latch resets.
    vi.resetModules()
    stubLocation('http://localhost:5173/tasks?x=1')
  })

  it('sends the browser to the login app with an encoded return URL', async () => {
    const { redirectToLogin } = await import('./redirect')
    redirectToLogin()
    expect(window.location.href).toBe(
      `http://localhost:5174/?redirect=${encodeURIComponent('http://localhost:5173/tasks?x=1')}`,
    )
  })

  it('is idempotent — a second call does not navigate again', async () => {
    const { redirectToLogin } = await import('./redirect')
    redirectToLogin()
    // Simulate the navigation having started; a second call must be a no-op.
    window.location.href = 'http://localhost:5173/elsewhere'
    redirectToLogin()
    expect(window.location.href).toBe('http://localhost:5173/elsewhere')
  })
})
