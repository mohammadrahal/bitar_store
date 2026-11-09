/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['localhost', '127.0.0.1'],
  // The default bottom-left badge sits on top of the sidebar avatar.
  devIndicators: { position: 'bottom-right' },
  images: {
    unoptimized: true,
  },
  experimental: {
    /* Turns on connectivity detection and the automatic retry of navigations,
       prefetches and Server Actions that failed while the network was down,
       and exposes `useOffline` from `next/offline` (see hooks/use-online-status.ts).
       Worth more than the `offline` event alone: it also flips when a request
       cannot reach the origin while the device still reports itself online,
       which is what a shop's half-dead wifi actually looks like. */
    useOffline: true,
  },
  async headers() {
    return [
      {
        /* The worker must never be served from the browser's HTTP cache, or a
           deployment waits for the old copy to expire before it takes effect. */
        source: '/sw.js',
        headers: [
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
        ],
      },
    ]
  },
}

export default nextConfig
