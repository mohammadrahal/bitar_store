import { ApiError } from '@/lib/api/api-error'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export type RequestFn = <T>(path: string, method?: HttpMethod, body?: unknown) => Promise<T>

async function parseJsonBody(response: Response): Promise<unknown> {
  return response.json().catch(() => null)
}

/**
 * Low-level fetch for the Bitar API. Adds dev identity (`X-User-Id`); when login
 * ships, only this module should switch to `Authorization: Bearer`.
 */
export async function request<T>(
  path: string,
  userId: string,
  method: HttpMethod = 'GET',
  body?: unknown,
): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-User-Id': userId,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  if (response.status === 204) return undefined as T

  const data = await parseJsonBody(response)
  if (!response.ok) {
    const message =
      data !== null && typeof data === 'object' && 'message' in data && typeof data.message === 'string'
        ? data.message
        : 'Request failed'
    throw new ApiError(response.status, message)
  }

  return data as T
}

export interface LoginApiResponse {
  user: {
    id: string
    email: string
    fullName: string
    role: 'admin' | 'manager' | 'employee'
    isActive: boolean
  }
}

/** `POST /auth/login` — checks email/password against the API (no X-User-Id). */
export async function loginWithApi(email: string, password: string): Promise<LoginApiResponse['user']> {
  const response = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })

  const data = await parseJsonBody(response)
  if (!response.ok) {
    const message =
      data !== null && typeof data === 'object' && 'message' in data && typeof data.message === 'string'
        ? data.message
        : 'Request failed'
    throw new ApiError(response.status, message)
  }

  const payload = data as LoginApiResponse
  return payload.user
}

/** `GET /health` — no identity header required. */
export async function fetchHealth(): Promise<{ status: string }> {
  const response = await fetch(`${BASE_URL}/health`)
  const data = await parseJsonBody(response)
  if (!response.ok) {
    const message =
      data !== null && typeof data === 'object' && 'message' in data && typeof data.message === 'string'
        ? data.message
        : 'Health check failed'
    throw new ApiError(response.status, message)
  }
  return data as { status: string }
}

export function createRequest(userId: string): RequestFn {
  return (path, method = 'GET', body) => request(path, userId, method, body)
}

export function getApiBaseUrl(): string {
  return BASE_URL
}
