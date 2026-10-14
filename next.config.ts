import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // A second local instance (the Stripe TEST environment, scripts/stripe-test.mjs) builds into its own folder.
  ...(process.env.NEXT_DIST_DIR && { distDir: process.env.NEXT_DIST_DIR }),
  turbopack: { root: process.cwd() },
  // META_PIXEL_ENABLED is a server variable; the browser bundle gets its value at build time.
  env: { NEXT_PUBLIC_META_PIXEL_ENABLED: process.env.META_PIXEL_ENABLED ?? '' },
  // Pages live under app/[lang]; a URL that matches no route at all gets app/global-not-found.tsx.
  experimental: {
    globalNotFound: true,
    // The stylesheet (Tailwind, ~17 KB compressed) arrives inside the HTML: no render-blocking request.
    inlineCss: true,
  },
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
