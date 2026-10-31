import { ApiError } from '@/lib/api/api-error'

/**
 * What a screen needs to know about a failure, without reaching into
 * `lib/api/`. Components ask these questions instead of importing the client's
 * error class, so the HTTP layer stays behind the services.
 */
export function statusOf(error: unknown): number | undefined {
  return error instanceof ApiError ? error.status : undefined
}

export function isUnauthorized(error: unknown): boolean {
  return statusOf(error) === 401
}

/** 409: a duplicate the user has to resolve — a branch code, a Whish reference. */
export function isConflict(error: unknown): boolean {
  return statusOf(error) === 409
}

/** The server's own wording when it has one, which is better than ours. */
export function messageOf(error: unknown): string | undefined {
  return error instanceof Error ? error.message : undefined
}
