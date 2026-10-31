'use client'

import { useEffect } from 'react'

/* Mirrors the title template in app/layout.tsx. */
const SUFFIX = 'Bitar Fashion'

/**
 * Names the browser tab after the record on screen. Detail routes only learn
 * that name on the client, so their static metadata title stands in until the
 * query resolves and nothing runs while the title is still undefined.
 */
export function useDocumentTitle(title: string | undefined) {
  useEffect(() => {
    if (!title) return
    document.title = `${title} · ${SUFFIX}`
  }, [title])
}
