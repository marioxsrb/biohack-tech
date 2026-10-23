import { NextResponse, type NextRequest } from 'next/server'
import { site } from '@/config/site'
import { ADMIN_COOKIE, checkAdminRequest } from '@/lib/admin-auth'
import { FULFIL_COOKIE, fulfilAccess } from '@/lib/fulfillment-auth'
import { DISCONTINUED_PATH, isLandingSlug, landingForHost, presentationPath, retiredAccesRedirect, retiredLandingRedirect, routeLanding, wwwRedirect } from '@/lib/landing-hosts'
import { defaultLocale, splitLocale } from '@/i18n/locales'
import { isIntlHost } from '@/lib/sites'
import { PRIVATE_PAGES, privateLink, tokenFreeUrl } from '@/lib/private-links'
import { isBlockedNetwork, OPEN_TO_BLOCKED } from '@/lib/blocked-network'

/**
 * Two jobs, before anything renders:
 *
 * 1. Advertising landings. A request whose Host is one of the landing hostnames in the allowlist
 *    (lib/landing-hosts.ts) gets its landing at "/", the checkout and order pages it needs, and a
 *    redirect to the main site for everything else. Its presentation page (information only, no purchase)
 *    is at /prezentare. Landing responses are never indexed. Any other Host, including a forged one, is
 *    simply the main site.
 *
 * 0. www.<main host> → 308 to the same path on the main host (one canonical host). The hostname of a retired
 *    landing (a discontinued product) and the former acces.<domain> funnel get the same treatment, and the
 *    discontinued product's own pages answer 410 Gone.
 *
 * 1b. Languages. Romanian keeps the plain URLs, English lives under /en. Every page lives internally under
 *    app/[lang], so a plain path is rewritten to /ro/<path>; /en/<path> passes as it is; a typed /ro/<path>
 *    redirects to the plain URL, so each page has exactly one public address per language. API routes and
 *    files are outside the matcher's page logic and stay where they are.
 *
 * 1d. The international site (biohack-tech.net): the same storefront, English by default. A plain (Romanian) URL
 *    is sent to its /en address unless the visitor picked Romanian in the language switch (cookie bt_lang=ro).
 *
 * 2. /admin is behind the login page (a signed session cookie; HTTP Basic Auth still works for scripts),
 *    with ADMIN_USER / ADMIN_PASSWORD. Without a password configured,
 *    the area does not exist. Serve the site over HTTPS only (it is, in production).
 */
/** Requests that are not pages: API routes and generated files keep their own paths. */
const NOT_A_PAGE = /^\/(api\/|robots\.txt$|sitemap\.xml$|icon\.svg$|favicon\.ico$)/

/** Serves `path` (a public path without its language) from the internal app/[lang] tree. */
function serve(req: NextRequest, locale: string, path: string, search: string) {
  return NextResponse.rewrite(new URL(`/${locale}${path === '/' ? '' : path}${search}`, req.url))
}

/** A discontinued product: 410 Gone with a short page and a link to the products that are sold. */
function gone(locale: string) {
  const en = locale === 'en'
  const title = en ? 'This product is no longer available' : 'Acest produs nu mai este disponibil'
  const text = en ? 'NEUROS Flow is no longer sold by Biohack Tech.' : 'NEUROS Flow nu mai este vândut de Biohack Tech.'
  const link = en ? 'See our products' : 'Vezi produsele noastre'
  const body = `<!doctype html><html lang="${en ? 'en' : 'ro'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title} | Biohack Tech</title></head><body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;background:#f2f5f6;color:#0b1316"><main style="max-width:560px;margin:15vh auto;padding:0 20px"><p style="font-weight:700;letter-spacing:.06em">BIOHACK <span style="color:#0e7490">TECH</span></p><h1 style="font-size:28px;line-height:1.2">${title}</h1><p style="font-size:17px;line-height:1.5;color:#27343a">${text}</p><p><a href="${en ? '/en/products' : '/products'}" style="color:#0b1316">${link}</a></p></main></body></html>`
  return new NextResponse(body, { status: 410, headers: { 'content-type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex, nofollow' } })
}

function noindex(res: NextResponse) {
  res.headers.set('X-Robots-Tag', 'noindex, nofollow')
  return res
}

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl
  const www = wwwRedirect(req.headers.get('host'), site.url, `${pathname}${search}`)
  if (www) return NextResponse.redirect(www, 308)
  const retired = retiredLandingRedirect(req.headers.get('host'), site.url, `${pathname}${search}`)
  if (retired) return NextResponse.redirect(retired, 308)
  const acces = retiredAccesRedirect(req.headers.get('host'), site.url, pathname, search)
  if (acces) return NextResponse.redirect(acces, 308)
  // 0a. A network blocked after the card testing attack (config/risk-blocklist.ts): no form, order, chat or API
  // answers it, in any browser or private window.
  if (pathname.startsWith('/api/') && !OPEN_TO_BLOCKED.test(pathname) && (await isBlockedNetwork(req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('x-real-ip')))) {
    return NextResponse.json({ error: 'BLOCKED', message: `Pentru comenzi te rugăm să ne suni la ${site.phone}.` }, { status: 403 })
  }
  if (NOT_A_PAGE.test(pathname)) return NextResponse.next()
  // 0b. A private link (order, cart recovery, unsubscribe): the token goes into an HttpOnly cookie and the page
  // opens at an address without it, so no analytics or ad tool, and no Referer, ever carries it (lib/private-links).
  const link = privateLink(pathname)
  if (link) {
    const res = NextResponse.redirect(new URL(tokenFreeUrl(link, req.nextUrl.searchParams), req.url), 303)
    const p = PRIVATE_PAGES[link.page]
    res.cookies.set(p.cookie, link.token, { httpOnly: true, secure: req.nextUrl.protocol === 'https:', sameSite: 'lax', path: '/', maxAge: p.days * 86_400 })
    res.headers.set('Referrer-Policy', 'no-referrer')
    res.headers.set('Cache-Control', 'no-store')
    return noindex(res)
  }
  // A discontinued product's pages, on any host and in any language: 410 Gone, never another product.
  const bare = splitLocale(pathname)
  if (DISCONTINUED_PATH.test(bare.path)) return gone(bare.locale)
  const host = req.headers.get('host') ?? ''
  // Local *.localhost hosts send the rest to the local main site, not to production.
  const mainOrigin = /\.localhost(:\d+)?$/.test(host) ? `${req.nextUrl.protocol}//${host.replace(/^[^.]+\./, '')}` : site.url

  // Old addresses of the former acces funnel on the main host (/acces/<slug>): the product page.
  if (/^\/(ro\/|en\/)?acces(\/|$)/.test(pathname)) {
    const slug = /\/acces\/([\w-]+)\/?$/.exec(pathname)?.[1]
    return NextResponse.redirect(new URL(slug && isLandingSlug(slug) ? `/products/${slug}` : '/', req.url), 307)
  }

  const landing = landingForHost(host)

  if (landing) {
    const route = routeLanding(landing, pathname)
    if (route.action === 'redirect') {
      const to = route.path === '/' ? new URL(`/${search}`, req.url) : new URL(`${route.path}${search}`, mainOrigin)
      return NextResponse.redirect(to, 308)
    }
    // Landings and the purchase path they use are Romanian; the presentation page sits outside the language tree.
    const res =
      route.action === 'rewrite' && route.bare
        ? NextResponse.rewrite(new URL(`${route.path}${search}`, req.url))
        : serve(req, defaultLocale, route.action === 'rewrite' ? route.path : pathname, search)
    res.headers.set('X-Robots-Tag', 'noindex, nofollow')
    return res
  }

  return storefront(req, pathname, search)
}

/**
 * Failed Basic Auth attempts on /admin and /fulfillment, per client address (per instance, like server/rate-limit.ts):
 * after BASIC_MAX failures in BASIC_WINDOW_MS the address gets 429 until the window ends, so a password cannot be
 * guessed by retrying the header. A session cookie or a correct header below the limit is never affected.
 */
const BASIC_MAX = 10
const BASIC_WINDOW_MS = 15 * 60_000
const basicFailures = new Map<string, { n: number; reset: number }>()
const clientAddress = (req: NextRequest) => req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown'
function basicBlocked(req: NextRequest) {
  if (!/^Basic\s/i.test(req.headers.get('authorization') ?? '')) return false
  const h = basicFailures.get(clientAddress(req))
  return !!h && h.reset > Date.now() && h.n >= BASIC_MAX
}
function basicFailed(req: NextRequest) {
  if (!/^Basic\s/i.test(req.headers.get('authorization') ?? '')) return
  const key = clientAddress(req)
  const now = Date.now()
  const h = basicFailures.get(key)
  if (!h || h.reset < now) basicFailures.set(key, { n: 1, reset: now + BASIC_WINDOW_MS })
  else h.n++
  if (basicFailures.size > 5000) for (const [k, v] of basicFailures) if (v.reset < now) basicFailures.delete(k)
}
const tooMany = () => new NextResponse('Too many attempts', { status: 429, headers: { 'Retry-After': String(BASIC_WINDOW_MS / 1000), 'Cache-Control': 'no-store' } })

/** The main storefront's routing: presentation previews, languages, admin. */
async function storefront(req: NextRequest, pathname: string, search: string) {
  // Presentation pages on the main host: /lp/<slug>/prezentare, for previews. Never indexed.
  const presentation = /^\/lp\/([\w-]+)\/prezentare\/?$/.exec(pathname)?.[1]
  if (presentation && isLandingSlug(presentation)) return noindex(NextResponse.rewrite(new URL(`${presentationPath(presentation)}${search}`, req.url)))
  if (/^\/prezentare\//.test(pathname)) return noindex(NextResponse.next())

  const { locale, path } = splitLocale(pathname)
  if (locale === defaultLocale && pathname !== path) return NextResponse.redirect(new URL(`${path}${search}`, req.url), 308)
  // biohack-tech.net opens in English: Romanian only when chosen in the language switch.
  if (locale === defaultLocale && isIntlHost(req.headers.get('host')) && req.cookies.get('bt_lang')?.value !== 'ro' && !path.startsWith('/admin') && !path.startsWith('/fulfillment')) {
    return NextResponse.redirect(new URL(`/en${path === '/' ? '' : path}${search}`, req.url), 307)
  }

  if (path === '/admin' || path.startsWith('/admin/')) {
    if (basicBlocked(req)) return tooMany()
    const auth = await checkAdminRequest(req.cookies.get(ADMIN_COOKIE)?.value, req.headers.get('authorization'))
    if (auth === 'disabled') return new NextResponse('Not found', { status: 404 })
    if (auth !== 'ok') basicFailed(req)
    const admin = (res: NextResponse) => {
      res.headers.set('X-Robots-Tag', 'noindex, nofollow')
      res.headers.set('Cache-Control', 'no-store')
      return res
    }
    // The login page is the only admin page open without a session (signed in: straight to the dashboard).
    if (path === '/admin/login') return admin(auth === 'ok' ? NextResponse.redirect(new URL('/admin', req.url), 303) : serve(req, locale, path, search))
    if (auth === 'ok') return admin(serve(req, locale, path, search))
    const login = new URL('/admin/login', req.url)
    login.searchParams.set('next', path)
    return admin(NextResponse.redirect(login, 303))
  }

  // The fulfillment portal: its own session (or an admin's); the login page is the only page open without one.
  if (path === '/fulfillment' || path.startsWith('/fulfillment/')) {
    if (basicBlocked(req)) return tooMany()
    const actor = await fulfilAccess(req.cookies.get(FULFIL_COOKIE)?.value, req.cookies.get(ADMIN_COOKIE)?.value, req.headers.get('authorization'))
    if (!actor) basicFailed(req)
    const portal = (res: NextResponse) => {
      res.headers.set('X-Robots-Tag', 'noindex, nofollow')
      res.headers.set('Cache-Control', 'no-store')
      return res
    }
    if (path === '/fulfillment/login') return portal(actor ? NextResponse.redirect(new URL('/fulfillment', req.url), 303) : serve(req, locale, path, search))
    if (actor) return portal(serve(req, locale, path, search))
    const login = new URL('/fulfillment/login', req.url)
    login.searchParams.set('next', path)
    return portal(NextResponse.redirect(login, 303))
  }

  const res = serve(req, locale, path, search)
  // Main-site copies of the landings (/lp/<slug>) are for previews and local work, not for search.
  if (/^\/(en\/)?lp\//.test(path)) res.headers.set('X-Robots-Tag', 'noindex, nofollow')
  return res
}

// Everything except build assets, images and the try-on's face tracker (/mediapipe): landing hostnames must be routed on every page path.
export const config = {
  matcher: ['/((?!_next/static|_next/image|mediapipe/|.*\\.(?:webp|png|jpg|jpeg|svg|ico|woff2?|txt|xml|mp4|mp3)$).*)'],
}
