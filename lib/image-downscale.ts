/**
 * Shrinking a photograph before it is stored.
 *
 * A phone camera produces 3 to 8 MB for one sheet of paper, almost all of it
 * detail nobody needs: what matters is that the numbers on the invoice can be
 * read back. 2000px on the long edge at JPEG 0.82 keeps printed digits legible
 * and lands between 250 and 600 KB. about a tenth of the original, so a year of
 * deliveries fits in the browser instead of filling it.
 *
 * The original is never kept. There is nowhere to put it, and holding a 6 MB
 * file to show a 600 KB thumbnail would be the whole cost with none of the use.
 */

export const MAX_EDGE = 2000
export const JPEG_QUALITY = 0.82

/** What a browser can decode and what this shrinks. HEIC is absent on purpose. */
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

export interface Downscaled {
  blob: Blob
  width: number
  height: number
  /** Bytes of the original, so the saving can be shown. */
  originalBytes: number
}

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('That file could not be read as an image.'))
    }
    image.src = url
  })
}

/**
 * Re-encode to a bounded JPEG.
 *
 * An image already smaller than the bound is still re-encoded: a 900px PNG
 * screenshot of an invoice can be larger than the 2000px JPEG of the same
 * thing, so "small enough already" is about bytes, not pixels.
 */
export async function downscaleImage(file: File): Promise<Downscaled> {
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    throw new Error('Use a JPEG, PNG or WebP. A photo straight from a phone camera is fine.')
  }

  const image = await loadImage(file)
  const scale = Math.min(1, MAX_EDGE / Math.max(image.naturalWidth, image.naturalHeight))
  const width = Math.max(1, Math.round(image.naturalWidth * scale))
  const height = Math.max(1, Math.round(image.naturalHeight * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('This browser cannot resize the image.')
  /* White behind it: a transparent PNG flattened onto nothing comes out black,
     which would make a scanned invoice unreadable. */
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, width, height)
  context.drawImage(image, 0, 0, width, height)

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
  )
  if (!blob) throw new Error('The image could not be prepared for storage.')

  return { blob, width, height, originalBytes: file.size }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
