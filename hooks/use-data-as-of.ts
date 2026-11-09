'use client'

import { useSyncExternalStore } from 'react'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'

/**
 * When the newest figure on screen last came from the server, as epoch ms, or
 * null if nothing in the cache has ever been fetched.
 *
 * This is the whole cache rather than one query on purpose: the question staff
 * ask while offline is "how old is what I am looking at", and the most recent
 * successful read is the honest answer to it. It needs no bookkeeping of its
 * own, because every restored snapshot carries the `dataUpdatedAt` the figures
 * had when they were saved.
 */
function newestUpdate(client: QueryClient): number | null {
  let newest = 0
  for (const query of client.getQueryCache().getAll()) {
    if (query.state.status === 'success' && query.state.dataUpdatedAt > newest) {
      newest = query.state.dataUpdatedAt
    }
  }
  return newest === 0 ? null : newest
}

export function useDataAsOf(): number | null {
  const client = useQueryClient()
  return useSyncExternalStore(
    (onChange) => client.getQueryCache().subscribe(onChange),
    () => newestUpdate(client),
    () => null,
  )
}
