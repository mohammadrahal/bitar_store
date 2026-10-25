/** Simulated network latency so loading states are exercised in development. */
export const MOCK_LATENCY_MS = 300

export function delay<T>(value: T, ms = MOCK_LATENCY_MS): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}

export function delayedFailure(message: string, ms = MOCK_LATENCY_MS): Promise<never> {
  return new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms))
}
