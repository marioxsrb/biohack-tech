/**
 * Advertising landings: one per product, on its own hostname (<slug>.biohack-tech.ro), served by this
 * same app. Only the hostnames built from this list are recognized; any other Host header is treated
 * as the main site. Kept dependency-free: the proxy imports it on every request.
 *
 * Locally the same page is at /lp/<slug>, and <slug>.localhost works outside production.
 */
export const LANDING_SLUGS = ['calm', 'focus', 'amber'] as const

/**
 * Landings of discontinued products (NEUROS Flow, 13.10.2026). Their hostname still resolves, so every
 * request is sent permanently to the same path on the main site: the home page for "/", and an old order
 * page (a Stripe return, an email link) keeps working. Nothing of the product is served or sold there.
 */
export const RETIRED_LANDING_SLUGS = ['brain-flow'] as const
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

/** `bare`: the target lives outside the language tree (the presentation page), so it gets no /ro prefix. */
export type LandingRoute = { action: 'rewrite'; path: string; bare?: true } | { action: 'next' } | { action: 'redirect'; path: string }

/** The presentation page of a landing: information only, at /prezentare on its hostname. */
export const presentationPath = (slug: LandingSlug) => `/prezentare/${slug}`

/** What a landing hostname does with a path. Pure, so it is tested without a server. */
export function routeLanding(slug: LandingSlug, pathname: string): LandingRoute {
  if (pathname === '/' || pathname === '') return { action: 'rewrite', path: `/lp/${slug}` }
  if (pathname === '/prezentare' || pathname === '/prezentare/') return { action: 'rewrite', path: presentationPath(slug), bare: true }
  if (pathname === `/lp/${slug}` || pathname === `/lp/${slug}/`) return { action: 'redirect', path: '/' }
  if (LANDING_PASSTHROUGH.some((r) => r.test(pathname))) return { action: 'next' }
  return { action: 'redirect', path: pathname }
}

/** Where a request to a retired landing hostname goes (same path on the main site), or null for any other host. */
export function retiredLandingRedirect(hostHeader: string | null | undefined, siteUrl: string, pathAndQuery: string, base = landingBaseDomain(), dev = process.env.NODE_ENV !== 'production'): string | null {
  if (!hostHeader) return null
  const raw = hostHeader.trim().toLowerCase()
  const host = raw.replace(/:\d+$/, '').replace(/\.$/, '')
  for (const slug of RETIRED_LANDING_SLUGS) {
    if (host === landingHost(slug as unknown as LandingSlug, base)) return `${new URL(siteUrl).origin}${pathAndQuery}`
    // Locally: brain-flow.localhost:3000 → localhost:3000.
    if (dev && host === `${slug}.localhost`) return `http://${raw.replace(/^[^.]+\./, '')}${pathAndQuery}`
  }
  return null
}

/** Public paths of discontinued products. They answer 410 Gone, never another product's page. */
export const DISCONTINUED_PATH = /^\/(products|lp|prezentare)\/brain-flow(\/prezentare)?\/?$/

/**
 * www → apex: `www.<main host>` answers with a permanent redirect to the same path on the main site
 * (NEXT_PUBLIC_SITE_URL), so there is one canonical host. Returns null for every other host.
 */
export function wwwRedirect(hostHeader: string | null | undefined, siteUrl: string, pathAndQuery: string): string | null {
  if (!hostHeader) return null
  const host = hostHeader.trim().toLowerCase().replace(/:\d+$/, '')
  let main: URL
  try {
    main = new URL(siteUrl)
  } catch {
    return null
  }
  return host === `www.${main.hostname}` ? `${main.origin}${pathAndQuery}` : null
}

/**
 * The price-gated funnel's hostname: acces.<base> (acces.localhost outside production). Same app and checkout;
 * the proxy maps its short paths onto app/[lang]/(landing)/acces.
 */
export const GATED_HOST_LABEL = 'acces'

export function isGatedHostname(hostHeader: string | null | undefined, base = landingBaseDomain(), dev = process.env.NODE_ENV !== 'production'): boolean {
  if (!hostHeader) return false
  const host = hostHeader.trim().toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '')
  return host === `${GATED_HOST_LABEL}.${base}` || (dev && host === `${GATED_HOST_LABEL}.localhost`)
}

/** What the gated hostname serves itself, besides its own pages: the purchase path's later steps and the legal pages. */
const GATED_PASSTHROUGH = [
  /^\/comanda\/[\w-]+\/?$/,
  /^\/reluare\/[\w-]+\/?$/,
  /^\/dezabonare\/[\w-]+\/?$/,
  /^\/_next\//,
  /^\/(terms-of-service|privacy-policy|politica-cookies|politica-livrare|politica-retur|garantie|plati)\/?$/,
  /^\/retragere(\/confirmare)?\/?$/,
  /^\/(icon\.svg|favicon\.ico|robots\.txt)$/,
]

/**
 * What the gated hostname does with a path. `enabled` is PRICE_GATE_ENABLED: switched off, the funnel's pages
 * send visitors to the same product on the main site (where the price is visible), while order, recovery and
 * unsubscribe links already sent keep working. `unlocked`: the visitor has the gate cookie; the cart and the
 * checkout show prices, so without it they go back to the funnel's home. Pure, tested without a server.
 */
export function routeGated(pathname: string, enabled: boolean, unlocked: boolean): LandingRoute | { action: 'main'; path: string } {
  const p = pathname.replace(/\/+$/, '') || '/'
  const slug = /^\/(?:acces\/|products\/|lp\/)?([\w-]+)$/.exec(p)?.[1]
  if (GATED_PASSTHROUGH.some((r) => r.test(pathname))) return { action: 'next' }
  if (!enabled) {
    if (p === '/' || p === '/acces') return { action: 'main', path: '/' }
    if (slug && isLandingSlug(slug)) return { action: 'main', path: `/products/${slug}` }
    return { action: 'main', path: pathname }
  }
  if (p === '/') return { action: 'rewrite', path: '/acces' }
  if (isLandingSlug(p.slice(1))) return { action: 'rewrite', path: `/acces${p}` }
  if (p === '/acces' || p === '/products') return { action: 'redirect', path: '/' }
  if (slug && isLandingSlug(slug)) return { action: 'redirect', path: `/${slug}` }
  if (p === '/cart' || p === '/checkout') return unlocked ? { action: 'next' } : { action: 'redirect', path: '/' }
  return { action: 'main', path: pathname }
}
