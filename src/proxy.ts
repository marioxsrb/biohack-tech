import { NextResponse, type NextRequest } from 'next/server'
import { site } from '@/config/site'
import { checkAdminAuth } from '@/lib/admin-auth'
import { landingForHost, routeLanding, wwwRedirect } from '@/lib/landing-hosts'
import { defaultLocale, splitLocale } from '@/i18n/locales'

/**
 * Two jobs, before anything renders:
 *
 * 1. Advertising landings. A request whose Host is one of the landing hostnames in the allowlist
 *    (lib/landing-hosts.ts) gets its landing at "/", the checkout and order pages it needs, and a
 *    redirect to the main site for everything else. Landing responses are never indexed. Any other
 *    Host, including a forged one, is simply the main site.
 *
 * 0. www.<main host> → 308 to the same path on the main host (one canonical host).
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

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl
  const www = wwwRedirect(req.headers.get('host'), site.url, `${pathname}${search}`)
  if (www) return NextResponse.redirect(www, 308)
  if (NOT_A_PAGE.test(pathname)) return NextResponse.next()
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
    // Landings and the purchase path they use are Romanian.
    const res = serve(req, defaultLocale, route.action === 'rewrite' ? route.path : pathname, search)
    res.headers.set('X-Robots-Tag', 'noindex, nofollow')
    return res
  }

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
