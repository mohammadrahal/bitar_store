import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { migrateSessionKey } from '@/lib/session-storage'
import type { User } from '@/types'

const STORAGE_KEY = 'bitar-fashion:user:v3'

interface UserState {
  userId: string | null
  user: User | null
  signIn: (user: User) => void
  signOut: () => void
}

/**
 * Signed-in user for API headers and UI scope. Stored in sessionStorage so it
 * clears when the browser tab closes.
 */
export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      userId: null,
      user: null,
      signIn: (user) => set({ userId: user.id, user }),
      signOut: () => set({ userId: null, user: null }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => sessionStorage),
      skipHydration: true,
    },
  ),
)

/** Call before rehydrate so an old localStorage session is not left behind. */
export function migrateUserSessionStorage() {
  migrateSessionKey(STORAGE_KEY)
  migrateSessionKey('bitar-fashion:user:v2')
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
