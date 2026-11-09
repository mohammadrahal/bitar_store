/** Every failure from the Bitar API: status = HTTP status, message = text you can show the user. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/** Duck-type check so HMR does not break `instanceof ApiError` in query retry handlers. */
export function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as ApiError).name === 'ApiError' &&
    typeof (error as ApiError).status === 'number'
  )
}
