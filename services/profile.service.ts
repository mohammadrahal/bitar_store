import { getApiClient } from '@/lib/api'
import { bootstrapSession } from '@/services/session.service'
import { useUserStore } from '@/store/user-store'
import type { User } from '@/types'

/**
 * The signed-in user's own account. The API has no self-service route yet, so
 * both writes go to the same `/users` endpoints an admin uses: a backend that
 * reserves those for admins answers 403, and the form shows what it said.
 */
function currentSession() {
  const { user, token } = useUserStore.getState()
  if (!user || !token) throw new Error('You are not signed in.')
  return { user, token }
}

export async function updateOwnName(fullName: string): Promise<User> {
  const { user, token } = currentSession()
  await getApiClient().updateUser(user.id, { fullName })
  /* Re-read `GET /auth/me` so the shell shows the stored name, not the typed one. */
  return bootstrapSession(token)
}

export async function changeOwnPassword(password: string): Promise<void> {
  const { user } = currentSession()
  await getApiClient().setPassword(user.id, password)
}
