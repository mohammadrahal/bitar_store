import { ApiError, loginWithApi } from '@/lib/api'
import { bootstrapSession } from '@/services/session.service'
import type { User } from '@/types'

export interface LoginInput {
  email: string
  password: string
}

export interface Session {
  token: string
  user: User
}

const INVALID_CREDENTIALS = 'Email or password is incorrect.'

export async function login(input: LoginInput): Promise<Session> {
  try {
    const { token } = await loginWithApi(input.email.trim().toLowerCase(), input.password)
    const user = await bootstrapSession(token)
    return { token, user }
  } catch (error) {
    if (error instanceof ApiError && (error.status === 400 || error.status === 401)) {
      throw new Error(error.message || INVALID_CREDENTIALS)
    }
    throw error
  }
}

/** The API has no logout endpoint; dropping the token ends the session. */
export async function logout(): Promise<void> {
  return Promise.resolve()
}
