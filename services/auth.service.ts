import { ApiError } from '@/lib/api/api-error'
import { loginWithApi } from '@/lib/api/client'
import { delayedFailure } from '@/lib/delay'
import { upsertDevCredential } from '@/lib/dev-credentials'
import { bootstrapSession } from '@/services/session.service'
import type { User } from '@/types'

export interface LoginInput {
  email: string
  password: string
}

const INVALID_CREDENTIALS = 'Email or password is incorrect.'

export async function login(input: LoginInput): Promise<User> {
  try {
    const apiUser = await loginWithApi(input.email, input.password)
    if (!apiUser.isActive) return delayedFailure(INVALID_CREDENTIALS)

    upsertDevCredential(
      apiUser.id,
      { email: apiUser.email, fullName: apiUser.fullName, role: apiUser.role },
      input.password,
    )

    return bootstrapSession(apiUser.id)
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 400)) {
      return delayedFailure(error.message || INVALID_CREDENTIALS)
    }
    if (error instanceof ApiError && error.status === 404) {
      return delayedFailure(INVALID_CREDENTIALS)
    }
    throw error
  }
}

export async function logout(): Promise<void> {
  return Promise.resolve()
}
