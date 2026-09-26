import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    formats: ['image/avif', 'image/webp'],
    qualities: [75, 85],
  },
  // Product pages were renamed (NEUROS Calm / Focus / Amber). Old links keep working.
  async redirects() {
    return [
      { source: '/products/balancewave', destination: '/products/calm', permanent: true },
      { source: '/products/brainlink', destination: '/products/focus', permanent: true },
      { source: '/products/glasses', destination: '/products/amber', permanent: true },
    ]
  },
}

export default nextConfig
