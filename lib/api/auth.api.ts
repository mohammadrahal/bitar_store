import { send } from '@/lib/api/client'
import type { HealthResponse, LoginResponse, MeResponse } from '@/lib/api/types'

/** `POST /auth/login` — public. */
export function loginWithApi(email: string, password: string): Promise<LoginResponse> {
  return send<LoginResponse>('/auth/login', { method: 'POST', body: { email, password } })
}

/** `GET /auth/me` — the token's user, permissions and branch scope. */
export function fetchMe(token: string): Promise<MeResponse> {
  return send<MeResponse>('/auth/me', { token })
}

/** `GET /health` — public. */
export function fetchHealth(): Promise<HealthResponse> {
  return send<HealthResponse>('/health')
}
