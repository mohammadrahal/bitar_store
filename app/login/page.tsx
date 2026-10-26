import { Suspense } from 'react'
import type { Metadata } from 'next'
import { LoginScreen } from '@/components/auth/login-screen'
import { HydrationGate } from '@/components/shared/hydration-gate'

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Welcome to our online store! Please sign in to access your account.',
}

export default function LoginPage() {
  return (
    // Suspense: LoginScreen reads the `next` search param on the client.
    <Suspense>
      <HydrationGate fallback={null}>
        <LoginScreen />
      </HydrationGate>
    </Suspense>
  )
}
