import type { MetadataRoute } from 'next'

/**
 * A till or stock terminal is used all day on one tablet, so the app is worth
 * installing to the home screen: `standalone` drops the browser chrome, and
 * `start_url` opens on the overview rather than wherever it was last closed.
 * The colours are the --background token for each scheme, matching the
 * themeColor viewport entries in app/layout.tsx.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Bitar Fashion — Inventory',
    short_name: 'Bitar',
    description: 'Stock, sales and transfers for Bitar Fashion.',
    start_url: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#F8F8F6',
    theme_color: '#F8F8F6',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png' },
    ],
  }
}
