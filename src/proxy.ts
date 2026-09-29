import { NextResponse, type NextRequest } from 'next/server'
import { site } from '@/config/site'
import { checkAdminAuth } from '@/lib/admin-auth'
import { landingForHost, routeLanding } from '@/lib/landing-hosts'

/**
 * Two jobs, before anything renders:
 *
 * 1. Advertising landings. A request whose Host is one of the landing hostnames in the allowlist
 *    (lib/landing-hosts.ts) gets its landing at "/", the checkout and order pages it needs, and a
 *    redirect to the main site for everything else. Landing responses are never indexed. Any other
 *    Host, including a forged one, is simply the main site.
 *
 * 2. /admin is behind HTTP Basic Auth (ADMIN_USER / ADMIN_PASSWORD). Without a password configured,
 *    the area does not exist. Serve the site over HTTPS only (it is, in production).
 */
export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl
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
    const res = route.action === 'rewrite' ? NextResponse.rewrite(new URL(`${route.path}${search}`, req.url)) : NextResponse.next()
    res.headers.set('X-Robots-Tag', 'noindex, nofollow')
    return res
  }

  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    const auth = checkAdminAuth(req.headers.get('authorization'))
    if (auth === 'disabled') return new NextResponse('Not found', { status: 404 })
    if (auth === 'ok') {
      const res = NextResponse.next()
      res.headers.set('X-Robots-Tag', 'noindex, nofollow')
      res.headers.set('Cache-Control', 'no-store')
      return res
    }
    return new NextResponse('Autentificare necesară', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="Biohack Tech admin", charset="UTF-8"' } })
  }

  // Main-site copies of the landings (/lp/<slug>) are for previews and local work, not for search.
  if (pathname.startsWith('/lp/')) {
    const res = NextResponse.next()
    res.headers.set('X-Robots-Tag', 'noindex, nofollow')
    return res
  }

  return NextResponse.next()
}

// Everything except build assets and images: landing hostnames must be routed on every page path.
export const config = {
  matcher: ['/((?!_next/static|_next/image|.*\\.(?:webp|png|jpg|jpeg|svg|ico|woff2?|txt|xml)$).*)'],
}
