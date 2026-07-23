import path from 'node:path'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// Vitest config for unit tests (guard/redirect logic). Kept separate from
// vite.config.ts so the app build stays untouched. Provides the VITE_* env the
// app's env.ts requires at import time.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    env: {
      VITE_API_BASE_URL: 'http://localhost:8000',
      VITE_LOGIN_URL: 'http://localhost:5174',
    },
  },
})
