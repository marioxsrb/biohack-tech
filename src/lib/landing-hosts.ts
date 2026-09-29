/**
 * Advertising landings: one per product, on its own hostname (<slug>.biohack-tech.ro), served by this
 * same app. Only the hostnames built from this list are recognized; any other Host header is treated
 * as the main site. Kept dependency-free: the proxy imports it on every request.
 *
 * Locally the same page is at /lp/<slug>, and <slug>.localhost works outside production.
 */
export const LANDING_SLUGS = ['calm', 'focus', 'amber', 'brain-flow'] as const
export type LandingSlug = (typeof LANDING_SLUGS)[number]

export const isLandingSlug = (v: unknown): v is LandingSlug => typeof v === 'string' && (LANDING_SLUGS as readonly string[]).includes(v)

/** The registrable domain the landing subdomains hang off. */
export const landingBaseDomain = () => (process.env.LANDING_BASE_DOMAIN?.trim().toLowerCase() || 'biohack-tech.ro').replace(/^\.+|\.+$/g, '')

export const landingHost = (slug: LandingSlug, base = landingBaseDomain()) => `${slug}.${base}`

/** Which landing a Host header belongs to, or null for the main site and anything unknown. */
export function landingForHost(hostHeader: string | null | undefined, base = landingBaseDomain(), dev = process.env.NODE_ENV !== 'production'): LandingSlug | null {
  if (!hostHeader) return null
  const host = hostHeader.trim().toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '')
  for (const slug of LANDING_SLUGS) {
    if (host === landingHost(slug, base)) return slug
    if (dev && host === `${slug}.localhost`) return slug
  }
  return null
}

/**
 * Paths a landing hostname serves itself: the landing, the whole purchase path (checkout, cart and
 * the product pages the cart's offer links to, so the cart, which lives in this origin's storage,
 * is never lost on the way), the order page Stripe returns to, the legal pages the checkout links to,
 * and the framework's own files. Everything else is sent to the main site.
 */
const LANDING_PASSTHROUGH = [
  /^\/checkout\/?$/,
  /^\/cart\/?$/,
  /^\/products(\/[\w-]+)?\/?$/,
  /^\/comanda\/[\w-]+\/?$/,
  /^\/api\/(checkout|consent|contact)(\/|$)/,
  /^\/_next\//,
  /^\/(terms-of-service|privacy-policy|politica-cookies|politica-livrare|politica-retur|garantie|plati)\/?$/,
  /^\/retragere(\/confirmare)?\/?$/,
  /^\/(icon\.svg|favicon\.ico|robots\.txt)$/,
]

export type LandingRoute = { action: 'rewrite'; path: string } | { action: 'next' } | { action: 'redirect'; path: string }

/** What a landing hostname does with a path. Pure, so it is tested without a server. */
export function routeLanding(slug: LandingSlug, pathname: string): LandingRoute {
  if (pathname === '/' || pathname === '') return { action: 'rewrite', path: `/lp/${slug}` }
  if (pathname === `/lp/${slug}` || pathname === `/lp/${slug}/`) return { action: 'redirect', path: '/' }
  if (LANDING_PASSTHROUGH.some((r) => r.test(pathname))) return { action: 'next' }
  return { action: 'redirect', path: pathname }
}
