function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`${name} is not set. Copy .env.example to .env.local.`)
  }
  return value
}

export const env = {
  apiBaseUrl: required('VITE_API_BASE_URL', import.meta.env.VITE_API_BASE_URL),
  // The shared login app; unauthenticated users are redirected here.
  loginUrl: required('VITE_LOGIN_URL', import.meta.env.VITE_LOGIN_URL),
} as const
