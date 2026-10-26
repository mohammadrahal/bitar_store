'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { LoginAside } from '@/components/auth/login-aside'
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
      <LoginAside />

      <div className="auth-main">
        <div className="auth-corner">
          <ThemeToggle />
        </div>

        <main className="auth-card">
          <div className="auth-head">
            {/* Not the shell's BrandLogo: that links to a page only a signed-in user has. */}
            <span className="logo-full" role="img" aria-label="Bitar" />
            <h1>Welcome back</h1>
            <p className="subtitle">Sign in to continue to your dashboard.</p>
          </div>

          <LoginForm />
        </main>

        <p className="auth-foot">© {new Date().getFullYear()} Bitar. All rights reserved.</p>
      </div>
    </div>
  )
}
