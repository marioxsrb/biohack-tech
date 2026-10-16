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
  // Security headers (HSTS comes from Vercel). No page may be framed by another site (clickjacking on the
  // checkout); private links (order, recovery, unsubscribe) never leave in a Referer.
  async headers() {
    const base = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      { key: 'Content-Security-Policy', value: "frame-ancestors 'self'; base-uri 'self'; object-src 'none'" },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      // Stripe's wallets (Apple Pay, Google Pay) run in its own frame and need the Payment Request API.
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(self "https://js.stripe.com")' },
    ]
    const privatePages = '/:lang(en)?/:page(comanda|reluare|dezabonare|retragere)/:path*'
    return [
      { source: '/:path*', headers: base },
      { source: privatePages, headers: [{ key: 'Referrer-Policy', value: 'no-referrer' }] },
      { source: '/:page(comanda|reluare|dezabonare|retragere)/:path*', headers: [{ key: 'Referrer-Policy', value: 'no-referrer' }] },
    ]
  },
  // Product pages were renamed (NEUROS Calm / Focus / Amber). Old links keep working.
  async headers() {
    return [
      {
        // Films and posters in /public. Hashed /_next/static files already ship with an immutable cache.
        source: '/video/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=2592000, stale-while-revalidate=86400' }],
      },
    ]
  },
  async redirects() {
    return [
      { source: '/products/balancewave', destination: '/products/calm', permanent: true },
      { source: '/products/brainlink', destination: '/products/focus', permanent: true },
      { source: '/products/glasses', destination: '/products/amber', permanent: true },
      { source: '/en/products/balancewave', destination: '/en/products/calm', permanent: true },
      { source: '/en/products/brainlink', destination: '/en/products/focus', permanent: true },
      { source: '/en/products/glasses', destination: '/en/products/amber', permanent: true },
      // Browsers ask for /favicon.ico on their own; the site's icon is the SVG.
      { source: '/favicon.ico', destination: '/icon.svg', permanent: true },
    ]
  },
}

export default nextConfig
