import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { User } from '@/types'

const STORAGE_KEY = 'bitar-fashion:session:v4'
const LEGACY_KEYS = ['bitar-fashion:user:v3', 'bitar-fashion:user:v2', 'bitar:dev-credentials:v1']

interface UserState {
  token: string | null
  user: User | null
  signIn: (token: string, user: User) => void
  setUser: (user: User) => void
  signOut: () => void
}

/**
 * Bearer token and the access context from `GET /auth/me`. Kept in
 * sessionStorage so it clears when the tab closes; never holds a password.
 */
export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      signIn: (token, user) => set({ token, user }),
      setUser: (user) => set({ user }),
      signOut: () => set({ token: null, user: null }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => sessionStorage),
      skipHydration: true,
    },
  ),
)

/** Drops sessions and stored passwords written by the old dev-header builds. */
export function clearLegacySessionStorage() {
  if (typeof window === 'undefined') return
  for (const key of LEGACY_KEYS) {
    sessionStorage.removeItem(key)
    localStorage.removeItem(key)
  }
}

/** The signed-in user, or null. Safe to call outside the authenticated tree. */
export function useSession(): User | null {
  return useUserStore((state) => state.user)
}

/** The signed-in user. Only valid under <AuthGate>, which guarantees one. */
export function useCurrentUser(): User {
  const user = useSession()
  if (!user) throw new Error('useCurrentUser was called outside a signed-in tree')
  return user
}
