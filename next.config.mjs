/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['localhost', '127.0.0.1'],
  // The default bottom-left badge sits on top of the sidebar avatar.
  devIndicators: { position: 'bottom-right' },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
