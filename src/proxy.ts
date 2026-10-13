import { NextResponse, type NextRequest } from 'next/server'
import { site } from '@/config/site'
import { checkAdminAuth } from '@/lib/admin-auth'
import { DISCONTINUED_PATH, isLandingSlug, landingForHost, presentationPath, retiredLandingRedirect, routeLanding, wwwRedirect } from '@/lib/landing-hosts'
import { defaultLocale, splitLocale } from '@/i18n/locales'

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
 *    landing (a discontinued product) gets the same treatment, and the discontinued product's own pages
 *    answer 410 Gone.
 *
 * 1b. Languages. Romanian keeps the plain URLs, English lives under /en. Every page lives internally under
 *    app/[lang], so a plain path is rewritten to /ro/<path>; /en/<path> passes as it is; a typed /ro/<path>
 *    redirects to the plain URL, so each page has exactly one public address per language. API routes and
 *    files are outside the matcher's page logic and stay where they are.
 *
 * 2. /admin is behind HTTP Basic Auth (ADMIN_USER / ADMIN_PASSWORD). Without a password configured,
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

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl
  const www = wwwRedirect(req.headers.get('host'), site.url, `${pathname}${search}`)
  if (www) return NextResponse.redirect(www, 308)
  const retired = retiredLandingRedirect(req.headers.get('host'), site.url, `${pathname}${search}`)
  if (retired) return NextResponse.redirect(retired, 308)
  if (NOT_A_PAGE.test(pathname)) return NextResponse.next()
  // A discontinued product's pages, on any host and in any language: 410 Gone, never another product.
  const bare = splitLocale(pathname)
  if (DISCONTINUED_PATH.test(bare.path)) return gone(bare.locale)
  const landing = landingForHost(req.headers.get('host'))

  if (landing) {
    const route = routeLanding(landing, pathname)
    if (route.action === 'redirect') {
      // Local <slug>.localhost hosts send the rest to the local main site, not to production.
      const host = req.headers.get('host') ?? ''
      const main = /\.localhost(:\d+)?$/.test(host) ? `${req.nextUrl.protocol}//${host.replace(/^[^.]+\./, '')}` : site.url
      const to = route.path === '/' ? new URL(`/${search}`, req.url) : new URL(`${route.path}${search}`, main)
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

  // Presentation pages on the main host: /lp/<slug>/prezentare, for previews. Never indexed.
  const presentation = /^\/lp\/([\w-]+)\/prezentare\/?$/.exec(pathname)?.[1]
  if (presentation && isLandingSlug(presentation)) return noindex(NextResponse.rewrite(new URL(`${presentationPath(presentation)}${search}`, req.url)))
  if (/^\/prezentare\//.test(pathname)) return noindex(NextResponse.next())

  const { locale, path } = splitLocale(pathname)
  if (locale === defaultLocale && pathname !== path) return NextResponse.redirect(new URL(`${path}${search}`, req.url), 308)

  if (path === '/admin' || path.startsWith('/admin/')) {
    const auth = checkAdminAuth(req.headers.get('authorization'))
    if (auth === 'disabled') return new NextResponse('Not found', { status: 404 })
    if (auth === 'ok') {
      const res = serve(req, locale, path, search)
      res.headers.set('X-Robots-Tag', 'noindex, nofollow')
      res.headers.set('Cache-Control', 'no-store')
      return res
    }
    return new NextResponse('Autentificare necesară', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="Biohack Tech admin", charset="UTF-8"' } })
  }

  const res = serve(req, locale, path, search)
  // Main-site copies of the landings (/lp/<slug>) are for previews and local work, not for search.
  if (path.startsWith('/lp/')) res.headers.set('X-Robots-Tag', 'noindex, nofollow')
  return res
}

// Everything except build assets and images: landing hostnames must be routed on every page path.
export const config = {
  matcher: ['/((?!_next/static|_next/image|.*\\.(?:webp|png|jpg|jpeg|svg|ico|woff2?|txt|xml|mp4)$).*)'],
}
