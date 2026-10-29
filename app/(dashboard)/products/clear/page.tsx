'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/shared/page-header'
import { usePermission } from '@/hooks/use-permission'
import { archiveAllActiveStyles, type ArchiveAllResult } from '@/services/catalog-reset.service'

/** One-shot catalog wipe while you are signed in (dev-friendly). */
export default function ClearCatalogPage() {
  const router = useRouter()
  const { can } = usePermission()
  const allowed = can('catalog.edit')
  const [result, setResult] = useState<ArchiveAllResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const started = useRef(false)

  useEffect(() => {
    if (!allowed || started.current || result || error) return
    started.current = true
    setRunning(true)
    archiveAllActiveStyles()
      .then((outcome) => {
        setResult(outcome)
        setTimeout(() => router.replace('/products'), 2500)
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setRunning(false))
  }, [allowed, running, result, error, router])

  return (
    <>
      <PageHeader eyebrow="Catalog" title="Clearing products…" description="Archiving every active model on the server." />
      {!allowed && (
        <p className="field-error">Sign in as an admin with catalog access, then open this page again.</p>
      )}
      {running && <p className="muted">Working…</p>}
      {error && (
        <p className="field-error">
          {error}. <Link href="/products">Back to products</Link>
        </p>
      )}
      {result && (
        <p className="muted">
          Archived {result.archived} model{result.archived === 1 ? '' : 's'}
          {result.errors.length > 0 ? `; ${result.errors.length} failed` : ''}. Redirecting…
        </p>
      )}
    </>
  )
}
