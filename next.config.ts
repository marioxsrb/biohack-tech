import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Self-hosted on cPanel (Phusion Passenger): a self-contained server.js with only the traced node_modules.
  output: 'standalone',
  poweredByHeader: false,
  // A second local instance (the Stripe TEST environment, scripts/stripe-test.mjs) builds into its own folder.
  ...(process.env.NEXT_DIST_DIR && { distDir: process.env.NEXT_DIST_DIR }),
  turbopack: { root: process.cwd() },
  // Database drivers load native/wasm code at runtime; keep them out of the server bundle.
  serverExternalPackages: ['pg', '@electric-sql/pglite'],
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
