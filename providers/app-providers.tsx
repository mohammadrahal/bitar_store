'use client'

import { useEffect, useState } from 'react'
import { Toaster } from 'sonner'
import { PreferenceEffects } from '@/components/shared/preference-effects'
import { QueryProvider } from '@/providers/query-provider'
import { useUIStore } from '@/store/ui-store'

/** Matches the server render until mount, then follows the chosen theme. */
function ThemedToaster() {
  const theme = useUIStore((state) => state.theme)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return <Toaster theme={mounted ? theme : 'light'} position="bottom-right" richColors closeButton />
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <PreferenceEffects />
      {children}
      <ThemedToaster />
    </QueryProvider>
  )
}
