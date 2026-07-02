import { useMutation } from '@tanstack/react-query'

import { api } from '@/lib/api/client'
import { ensureOk } from '@/lib/api/unwrap'

export function useChangePassword() {
  return useMutation({
    mutationFn: async (body: {
      current_password: string
      new_password: string
    }) => ensureOk(await api.PUT('/api/v1/auth/me/password', { body })),
  })
}
