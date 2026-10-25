'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { LoginForm } from '@/components/auth/login-form'
import { ThemeToggle } from '@/components/shared/theme-toggle'
import { postLoginPathFor } from '@/lib/permissions'
import { useSession } from '@/store/user-store'

/**
 * Owns the post-login redirect: the form only signs in, and this reacts to the
 * session appearing, whether that happened here or in another tab.
 */
export function LoginScreen() {
  const user = useSession()
  const router = useRouter()
  const next = useSearchParams().get('next')

  useEffect(() => {
    if (user) router.replace(postLoginPathFor(user, next))
  }, [user, next, router])

  return (
    <div className="auth-screen">
      <div className="auth-corner">
        <ThemeToggle />
      </div>

      <main className="auth-card">
        <div className="auth-head">
          {/* Not the shell's BrandLogo: that links to a page only a signed-in user has. */}
          <span className="logo-full" role="img" aria-label="Bitar" />
          <p className="eyebrow">Inventory</p>
          <h1>Sign in</h1>
          <p className="subtitle">Multi-branch stock and catalog for the Bitar boutiques.</p>
        </div>

        <LoginForm />
      </main>
    </div>
  )
}
