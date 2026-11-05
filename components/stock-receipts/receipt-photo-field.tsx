'use client'

import { useEffect, useRef, useState } from 'react'
import { Camera, Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { remainingBytes } from '@/lib/blob-store'
import { ACCEPTED_IMAGE_TYPES, downscaleImage, formatBytes } from '@/lib/image-downscale'
import type { ReceiptPhotoDraft } from '@/services/stock-receipts.service'

/** Refuse before decoding: a 60 MB file would hang the tab resizing it. */
const MAX_PICK_BYTES = 25 * 1024 * 1024

/**
 * The picture of the supplier's invoice that the receipt is copied from.
 *
 * `capture="environment"` makes a phone open the rear camera rather than the
 * file browser, which is the common case: someone standing over a box with the
 * paperwork in their hand. On a desktop the attribute is ignored and it is an
 * ordinary file picker.
 *
 * The file is shrunk as soon as it is picked, not on submit, so the size shown
 * is the size that will actually be stored and a photo too large to keep is
 * rejected while the person is still looking at the form.
 */
export function ReceiptPhotoField({
  photo,
  onChange,
}: {
  photo: ReceiptPhotoDraft | undefined
  onChange: (photo: ReceiptPhotoDraft | undefined) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)

  /* One object URL per blob, revoked when it is replaced or the form closes.
     Without this each re-pick leaks the previous image for the page's life. */
  useEffect(() => {
    if (!photo) {
      setPreview(null)
      return
    }
    const url = URL.createObjectURL(photo.blob)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [photo])

  const pick = async (file: File | undefined) => {
    if (!file) return
    if (file.size > MAX_PICK_BYTES) {
      toast.error(`That file is ${formatBytes(file.size)}. Use one under ${formatBytes(MAX_PICK_BYTES)}.`)
      return
    }
    setBusy(true)
    try {
      const shrunk = await downscaleImage(file)
      const room = await remainingBytes()
      /* Twice the size, because the browser reports an estimate and a write
         that runs out part-way loses the photo after the stock has moved. */
      if (room !== null && room < shrunk.blob.size * 2) {
        toast.error('This browser is nearly out of storage. Free some space before attaching a photo.')
        return
      }
      onChange(shrunk)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'That image could not be read.')
    } finally {
      setBusy(false)
      /* Clear the input so picking the same file twice still fires a change. */
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="receipt-photo-field">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(',')}
        capture="environment"
        className="sr-only"
        id="receipt-photo"
        onChange={(event) => void pick(event.target.files?.[0])}
      />

      {preview && photo ? (
        <figure className="receipt-photo-preview">
          {/* eslint-disable-next-line @next/next/no-img-element -- a blob URL
              from IndexedDB cannot go through the image optimizer. */}
          <img src={preview} alt="The supplier invoice you attached" />
          <figcaption>
            <span className="tabular">
              {photo.width} × {photo.height} · {formatBytes(photo.blob.size)}
            </span>
            {photo.originalBytes > photo.blob.size && (
              <small>Shrunk from {formatBytes(photo.originalBytes)} so it fits in the browser.</small>
            )}
          </figcaption>
          <div className="receipt-photo-actions">
            <label htmlFor="receipt-photo" className="btn btn-secondary btn-sm">
              Replace
            </label>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => onChange(undefined)}>
              <Trash2 size={14} aria-hidden="true" />
              Remove
            </button>
          </div>
        </figure>
      ) : (
        <label htmlFor="receipt-photo" className={`receipt-photo-drop ${busy ? 'is-busy' : ''}`}>
          {busy ? (
            <>
              <Loader2 size={20} className="spin" aria-hidden="true" />
              <strong>Preparing the image…</strong>
            </>
          ) : (
            <>
              <Camera size={20} aria-hidden="true" />
              <strong>Photograph the invoice</strong>
              <small>
                On a phone this opens the camera. JPEG, PNG or WebP; it is shrunk to about 2000px so the numbers stay
                readable.
              </small>
            </>
          )}
        </label>
      )}
    </div>
  )
}
