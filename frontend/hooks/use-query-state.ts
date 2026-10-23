'use client'

import { useCallback, useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

/**
 * Filter state stored in the URL so views are shareable and survive reloads.
 * `defaults` must be a stable (module-level) object; default values are omitted from the URL.
 */
export function useSearchState<T extends Record<string, string>>(defaults: T) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const values = useMemo(() => {
    const result: Record<string, string> = {}
    for (const key of Object.keys(defaults)) result[key] = searchParams.get(key) ?? defaults[key]
    return result as T
  }, [defaults, searchParams])

  const update = useCallback(
    (patch: Partial<T>) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(patch)) {
        if (value === undefined || value === '' || value === defaults[key]) params.delete(key)
        else params.set(key, value)
      }
      if (!('page' in patch)) params.delete('page')
      const query = params.toString()
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    },
    [defaults, pathname, router, searchParams],
  )

  return [values, update] as const
}
