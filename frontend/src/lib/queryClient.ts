import { QueryClient } from '@tanstack/react-query'

import { ApiError } from './http'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Données métier peu volatiles : 30 s de fraîcheur évite les
      // rechargements en rafale lors de la navigation entre onglets.
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // Une erreur métier (400/403/404) ne doit jamais être rejouée.
        if (error instanceof ApiError) {
          return error.status >= 500 && failureCount < 1
        }
        return failureCount < 1
      },
    },
    mutations: { retry: false },
  },
})
