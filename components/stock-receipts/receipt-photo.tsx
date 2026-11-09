'use client'

import { useEffect, useState } from 'react'
import { ImageOff } from 'lucide-react'
import { formatBytes } from '@/lib/image-downscale'
import { getReceiptPhoto, type ReceiptPhotoMeta } from '@/services/stock-receipts.service'

/**
 * The attached invoice photograph, read back out of IndexedDB.
 *
 * Three outcomes have to be told apart, because they mean different things to
 * whoever is looking for the paperwork:
 *
 * - **Not on this device.** The receipt was recorded somewhere else. Normal.
 * - **Recorded as lost.** Storage was full or blocked when it was posted, so it
 *   was never written. The receipt says so instead of looking like the first
 *   case.
 * - **Written but unreadable now.** Site data has been cleared since.
 *
 * `meta` comes from a legacy receipt, which recorded the picture's size beside
 * itself. A server receipt has no such record. the document is the server's and
 * the picture is not. so it is left out and the store is simply asked whether
 * this browser is the one that holds it.
 */
export function ReceiptPhoto({ receiptId, meta }: { receiptId: string; meta?: ReceiptPhotoMeta }) {
  const [url, setUrl] = useState<string | null>(null)
  const [missing, setMissing] = useState(false)
  const probe = meta === undefined || meta.stored

  useEffect(() => {
    if (!probe) return
    let revoke: string | null = null
    let live = true
    void getReceiptPhoto(receiptId).then((blob) => {
      if (!live) return
      if (!blob) {
        setMissing(true)
        return
      }
      revoke = URL.createObjectURL(blob)
      setUrl(revoke)
    })
    return () => {
      live = false
      if (revoke) URL.revokeObjectURL(revoke)
    }
  }, [receiptId, probe])

  if (meta === undefined && missing) {
    return (
      <p className="muted receipt-photo-empty">
        <ImageOff size={16} aria-hidden="true" />
        No photo in this browser. One was either never attached, or this delivery was recorded on another device.
      </p>
    )
  }

  if (meta && !meta.stored) {
    return (
      <p className="muted receipt-photo-empty">
        <ImageOff size={16} aria-hidden="true" />
        A photo was attached but could not be saved. the browser was out of storage. The stock and the audit note
        went through.
      </p>
    )
  }

  if (meta && missing) {
    return (
      <p className="muted receipt-photo-empty">
        <ImageOff size={16} aria-hidden="true" />
        The photo is no longer in this browser. Clearing site data removes it; the receipt itself is unaffected.
      </p>
    )
  }

  if (!url) return <p className="muted">Loading the photo…</p>

  return (
    <figure className="receipt-photo-view">
      {/* Opens full size in a new tab, because reading a handwritten quantity
          off a thumbnail is exactly what this is for.
          eslint-disable-next-line @next/next/no-img-element */}
      <a href={url} target="_blank" rel="noreferrer">
        <img src={url} alt="The supplier invoice this receipt was copied from" />
      </a>
      <figcaption className="tabular">
        {meta ? `${meta.width} × ${meta.height} · ${formatBytes(meta.bytes)} · ` : ''}opens full size
      </figcaption>
    </figure>
  )
}
