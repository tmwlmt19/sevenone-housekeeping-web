import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Collaborative data: refetch when the user returns to the tab.
      refetchOnWindowFocus: true,
      staleTime: 30_000,
      retry: 1,
    },
  },
})
