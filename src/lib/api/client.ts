import createClient, { type Middleware } from 'openapi-fetch'

import { env } from '@/lib/env'

import type { paths } from './schema'
import { clearToken, getToken, notifyUnauthorized } from './token-store'

const authMiddleware: Middleware = {
  onRequest({ request }) {
    const token = getToken()
    if (token) {
      request.headers.set('Authorization', `Bearer ${token}`)
    }
    return request
  },
  onResponse({ response }) {
    // Global 401 handling: clear the session and let the app redirect to login.
    if (response.status === 401) {
      clearToken()
      notifyUnauthorized()
    }
    return response
  },
}

/** Typed API client. Paths are filled in once `pnpm gen:api` runs (Phase 2). */
export const api = createClient<paths>({ baseUrl: env.apiBaseUrl })
api.use(authMiddleware)
