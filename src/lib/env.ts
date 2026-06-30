const apiBaseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined

if (!apiBaseUrl) {
  throw new Error(
    'VITE_API_BASE_URL is not set. Copy .env.example to .env.local and set it.',
  )
}

export const env = {
  apiBaseUrl,
} as const
