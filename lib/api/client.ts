import { ApiError } from '@/lib/api/api-error'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export type RequestFn = <T>(path: string, method?: HttpMethod, body?: unknown) => Promise<T>

interface SendOptions {
  method?: HttpMethod
  body?: unknown
  token?: string | null
}

let unauthorizedHandler: (() => void) | null = null

/** Called when a protected request answers 401, so the app can drop the session. */
export function onUnauthorized(handler: (() => void) | null) {
  unauthorizedHandler = handler
}

function messageFrom(data: unknown, fallback: string): string {
  return data !== null && typeof data === 'object' && 'message' in data && typeof data.message === 'string'
    ? data.message
    : fallback
}

/** Low-level fetch for the Bitar API. Never put the token in the URL or logs. */
export async function send<T>(path: string, { method = 'GET', body, token }: SendOptions = {}): Promise<T> {
  const headers: Record<string, string> = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`

  let response: Response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, 'Could not reach the server. Check your connection and try again.')
  }

  if (response.status === 204) return undefined as T

  const data: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    if (response.status === 401 && token) unauthorizedHandler?.()
    throw new ApiError(response.status, messageFrom(data, 'Request failed'))
  }

  return data as T
}

export function createRequest(token: string): RequestFn {
  return (path, method = 'GET', body) => send(path, { method, body, token })
}

export function getApiBaseUrl(): string {
  return BASE_URL
}
