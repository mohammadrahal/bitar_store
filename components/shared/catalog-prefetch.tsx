'use client'

import { usePathname } from 'next/navigation'
import { useCatalogSync } from '@/hooks/use-stock'

/* Screens that never read the mirrored catalog. Warming it for them costs a
   full `GET /styles` + `GET /skus` sweep that nothing on the page will look at,
   and this component sits in the dashboard layout, so it ran on all of them.

   A screen listed here by mistake only loses the head start: the hooks that
   need the mirror share this query key and fetch it themselves. */
const WITHOUT_CATALOG = new Set([
  '/dashboard',
  '/users',
  '/profile',
  '/account',
  '/settings',
  '/settings/exchange',
  '/audit',
  '/categories',
  '/reports',
  '/branches',
])

/** Warms the mirrored catalog once per session for the screens built on it. */
export function CatalogPrefetch() {
  const pathname = usePathname()
  useCatalogSync({ enabled: !WITHOUT_CATALOG.has(pathname) })
  return null
}
