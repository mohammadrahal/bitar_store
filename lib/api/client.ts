import { ApiError } from '@/lib/api/api-error'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export type RequestOptions = { idempotencyKey?: string }

export type RequestFn = <T>(
  path: string,
  method?: HttpMethod,
  body?: unknown,
  options?: RequestOptions,
) => Promise<T>

interface SendOptions {
  method?: HttpMethod
  body?: unknown
  token?: string | null
  /** Extra headers, e.g. Idempotency-Key for stock opening and sales. */
  headers?: Record<string, string>
}

let unauthorizedHandler: (() => void) | null = null

/** Called when a protected request answers 401, so the app can drop the session. */
export function onUnauthorized(handler: (() => void) | null) {
  unauthorizedHandler = handler
}

function errorBody(data: unknown, fallback: string): { message: string; details?: unknown } {
  if (data !== null && typeof data === 'object') {
    const row = data as { message?: unknown; details?: unknown }
    const message = typeof row.message === 'string' ? row.message : fallback
    return { message, details: row.details }
  }
  return { message: fallback }
}

/** One list page plus how many items match the filters (`X-Total-Count`). */
export interface ApiPage<T> {
  items: T[]
  total: number
}

export const newIdempotencyKey = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`

/** Low-level fetch for the Bitar API. Never put the token in the URL or logs. */
export async function send<T>(path: string, { method = 'GET', body, token, headers: extra }: SendOptions = {}): Promise<T> {
  const headers: Record<string, string> = { ...extra }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`

  let response: Response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      /* TanStack Query holds the only cache that matters here. Letting the browser
         revalidate instead sends If-None-Match, and a 304 answer carries no body
         this client could turn back into data. */
      cache: 'no-store',
    })
  } catch {
    throw new ApiError(0, 'Could not reach the server. Check your connection and try again.')
  }

  if (response.status === 204) return undefined as T

  const data: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    if (response.status === 401 && token) unauthorizedHandler?.()
    /* `response.ok` is 200-299 only, so a 304 arrives here with nothing to parse.
       The no-store above should stop one being sent; name it if it happens anyway. */
    if (response.status === 304) {
      throw new ApiError(304, 'The server answered 304 Not Modified with no body. Check the API cache headers.')
    }
    const { message, details } = errorBody(data, 'Request failed')
    throw new ApiError(response.status, message, details)
  }

  return data as T
}

/** `GET` list endpoints that send the full count in `X-Total-Count`. */
export async function sendPage<T>(path: string, { token }: { token?: string | null } = {}): Promise<ApiPage<T>> {
  const headers: Record<string, string> = {}
  if (token) headers.Authorization = `Bearer ${token}`

  let response: Response
  try {
    response = await fetch(`${BASE_URL}${path}`, { method: 'GET', headers, cache: 'no-store' })
  } catch {
    throw new ApiError(0, 'Could not reach the server. Check your connection and try again.')
  }

  const data: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    if (response.status === 401 && token) unauthorizedHandler?.()
    const { message, details } = errorBody(data, 'Request failed')
    throw new ApiError(response.status, message, details)
  }

  const items = Array.isArray(data) ? (data as T[]) : []
  const totalHeader = response.headers.get('X-Total-Count')
  const total = totalHeader !== null && totalHeader !== '' ? Number(totalHeader) : items.length
  return { items, total: Number.isFinite(total) ? total : items.length }
}

export function createRequest(token: string): RequestFn {
  return (path, method = 'GET', body, options) =>
    send(path, {
      method,
      body,
      token,
      headers: options?.idempotencyKey ? { 'Idempotency-Key': options.idempotencyKey } : undefined,
    })
}

export type PageRequestFn = <T>(path: string) => Promise<ApiPage<T>>

export function createPageRequest(token: string): PageRequestFn {
  return (path) => sendPage(path, { token })
}

/** GET endpoints that return an object plus the whole count in `X-Total-Count`. */
export async function sendWithTotal<T>(
  path: string,
  { token }: { token?: string | null } = {},
): Promise<{ data: T; total: number }> {
  const headers: Record<string, string> = {}
  if (token) headers.Authorization = `Bearer ${token}`

  let response: Response
  try {
    response = await fetch(`${BASE_URL}${path}`, { method: 'GET', headers, cache: 'no-store' })
  } catch {
    throw new ApiError(0, 'Could not reach the server. Check your connection and try again.')
  }

  const data: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    if (response.status === 401 && token) unauthorizedHandler?.()
    const { message, details } = errorBody(data, 'Request failed')
    throw new ApiError(response.status, message, details)
  }

  const totalHeader = response.headers.get('X-Total-Count')
  const total = totalHeader !== null && totalHeader !== '' ? Number(totalHeader) : 0
  return { data: data as T, total: Number.isFinite(total) ? total : 0 }
}

export type TotalRequestFn = <T>(path: string) => Promise<{ data: T; total: number }>

export function createTotalRequest(token: string): TotalRequestFn {
  return (path) => sendWithTotal(path, { token })
}

export function getApiBaseUrl(): string {
  return BASE_URL
}
