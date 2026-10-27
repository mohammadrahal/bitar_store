'use client'

import { useCallback, useMemo, useRef } from 'react'

function newKey() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

/**
 * One Idempotency-Key per stock-changing action. The same key is handed out
 * until `reset` is called after the server confirms, so a retry after a
 * timeout or a double tap can never apply the change twice.
 */
export function useIdempotencyKey() {
  const ref = useRef<string | null>(null)
  const current = useCallback(() => {
    ref.current ??= newKey()
    return ref.current
  }, [])
  const reset = useCallback(() => {
    ref.current = null
  }, [])
  return useMemo(() => ({ current, reset }), [current, reset])
}
