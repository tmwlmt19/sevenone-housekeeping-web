/**
 * Unit tests for the hotel app's route guards — the pure client-side role/auth
 * gating that the E2E suite exercises through the browser (AUTH-02/03, HK-06-N).
 * Here we assert the logic in isolation, fast, with `useAuth` mocked.
 *
 * See sevenone-docs/housekeeping/testing/README.md.
 */
import '@testing-library/jest-dom/vitest'

import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Role } from '@/auth/types'

import { RequireAuth, RequireRole, RootRedirect, homePathFor } from './guards'

// Mock the auth context so guards read a role/status we control (and so we don't
// pull in the API client / env at all).
const useAuth = vi.fn()
vi.mock('@/auth/auth-context', () => ({ useAuth: () => useAuth() }))

function setAuth(value: {
  status?: 'loading' | 'authed' | 'unauthed'
  user?: { role: Role } | null
}) {
  useAuth.mockReturnValue({
    status: value.status ?? 'authed',
    user: value.user ?? null,
  })
}

beforeEach(() => {
  useAuth.mockReset()
})

describe('homePathFor', () => {
  it('sends housekeepers to /my-tasks', () => {
    expect(homePathFor('housekeeper')).toBe('/my-tasks')
  })
  it('sends managers and admins to /dashboard', () => {
    expect(homePathFor('manager')).toBe('/dashboard')
    expect(homePathFor('admin')).toBe('/dashboard')
  })
})

describe('RootRedirect', () => {
  function renderAt() {
    return render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/dashboard" element={<div>DASHBOARD</div>} />
          <Route path="/my-tasks" element={<div>MY TASKS</div>} />
        </Routes>
      </MemoryRouter>,
    )
  }

  it('routes a manager to the dashboard', () => {
    setAuth({ user: { role: 'manager' } })
    renderAt()
    expect(screen.getByText('DASHBOARD')).toBeInTheDocument()
  })

  it('routes a housekeeper to my-tasks', () => {
    setAuth({ user: { role: 'housekeeper' } })
    renderAt()
    expect(screen.getByText('MY TASKS')).toBeInTheDocument()
  })
})

describe('RequireRole', () => {
  function renderRoomsGate() {
    return render(
      <MemoryRouter initialEntries={['/rooms']}>
        <Routes>
          <Route element={<RequireRole allow={['admin', 'manager']} />}>
            <Route path="/rooms" element={<div>ROOMS</div>} />
          </Route>
          <Route path="/my-tasks" element={<div>MY TASKS</div>} />
          <Route path="/dashboard" element={<div>DASHBOARD</div>} />
        </Routes>
      </MemoryRouter>,
    )
  }

  it('renders the route for an allowed role', () => {
    setAuth({ user: { role: 'manager' } })
    renderRoomsGate()
    expect(screen.getByText('ROOMS')).toBeInTheDocument()
  })

  it('bounces a disallowed role to its own home', () => {
    setAuth({ user: { role: 'housekeeper' } })
    renderRoomsGate()
    expect(screen.queryByText('ROOMS')).not.toBeInTheDocument()
    expect(screen.getByText('MY TASKS')).toBeInTheDocument()
  })
})

describe('RequireAuth', () => {
  function renderGate() {
    return render(
      <MemoryRouter initialEntries={['/x']}>
        <Routes>
          <Route element={<RequireAuth />}>
            <Route path="/x" element={<div>PROTECTED</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )
  }

  it('shows a placeholder while the session check is pending', () => {
    setAuth({ status: 'loading' })
    renderGate()
    expect(screen.queryByText('PROTECTED')).not.toBeInTheDocument()
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('renders the protected outlet once authed', () => {
    setAuth({ status: 'authed', user: { role: 'manager' } })
    renderGate()
    expect(screen.getByText('PROTECTED')).toBeInTheDocument()
  })
})
