'use client'

import { useEffect, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ApiError, onUnauthorized } from '@/lib/api'
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
      useUserStore.getState().signOut()
      toast.error('Your session has expired. Please sign in again.')
    })
    return () => onUnauthorized(null)
  }, [queryClient])

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
