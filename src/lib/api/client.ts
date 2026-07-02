import createClient, { type Middleware } from 'openapi-fetch'

import { redirectToLogin } from '@/auth/redirect'
import { env } from '@/lib/env'

import type { paths } from './schema'

const authMiddleware: Middleware = {
  onResponse({ response }) {
    // The session cookie is missing/expired — bounce to the shared login app.
    if (response.status === 401) {
      redirectToLogin()
    }
    return response
  },
}

// Cookie-based auth: the browser sends the httpOnly session cookie automatically.
export const api = createClient<paths>({
  baseUrl: env.apiBaseUrl,
  credentials: 'include',
})
api.use(authMiddleware)
