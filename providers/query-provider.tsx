'use client'

import { useEffect, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ApiError, onUnauthorized } from '@/lib/api'
import { clearPersistedQueryCache } from '@/lib/query-persist'
import { useUserStore } from '@/store/user-store'

/** Auth and permission failures will not change on a retry. */
function shouldRetry(failureCount: number, error: Error) {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false
  return failureCount < 1
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            /* A week, matching the snapshot's own cut-off in lib/query-persist.ts.
               The default five minutes would collect a restored query before
               the screen asking for it had mounted, which on a dead network
               means the figures are dropped and nothing replaces them. */
            gcTime: 7 * 24 * 60 * 60 * 1000,
            retry: shouldRetry,
            refetchOnWindowFocus: false,
          },
        },
      }),
  )

  useEffect(() => {
    onUnauthorized(() => {
      if (!useUserStore.getState().token) return
      queryClient.clear()
      /* The snapshot belongs to the token that just expired. */
      void clearPersistedQueryCache()
      useUserStore.getState().signOut()
      toast.error('Your session has expired. Please sign in again.')
    })
    return () => onUnauthorized(null)
  }, [queryClient])

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
