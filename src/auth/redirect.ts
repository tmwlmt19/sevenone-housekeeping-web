import { env } from '@/lib/env'

let redirecting = false

/** Send the browser to the shared login app, remembering where to return. */
export function redirectToLogin(): void {
  if (redirecting) return
  redirecting = true
  const back = encodeURIComponent(window.location.href)
  window.location.href = `${env.loginUrl}/?redirect=${back}`
}
