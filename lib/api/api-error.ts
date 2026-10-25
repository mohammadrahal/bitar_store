/** Every failure from the Bitar API: status = HTTP status, message = text you can show the user. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}
