import { ImageResponse } from 'next/og'

/**
 * The home-screen icon for a till or stock terminal saved to an iPad. iOS
 * ignores SVG icons and does not apply a corner radius of its own on newer
 * versions, so this is rendered as a square PNG at the size Apple asks for,
 * from the same brass-and-cream pair as app/icon.svg.
 *
 * Satori renders this with its own bundled sans — the serif stack below is not
 * available to it, and embedding Playfair for one letter is not worth the
 * 500 KB budget — so this reads slightly lighter than the SVG tab icon.
 */
export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#B08D57',
          color: '#F7F5F0',
          fontSize: 112,
          fontWeight: 600,
          fontFamily: 'Georgia, Times New Roman, serif',
        }}
      >
        B
      </div>
    ),
    size,
  )
}
