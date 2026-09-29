import { NextResponse, type NextRequest } from 'next/server'
import { checkAdminAuth } from '@/lib/admin-auth'

/**
 * /admin is behind HTTP Basic Auth (ADMIN_USER / ADMIN_PASSWORD). Without a password
 * configured, the area does not exist. Serve the site over HTTPS only (it is, in production).
 */
export function proxy(req: NextRequest) {
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

export const config = { matcher: ['/admin', '/admin/:path*'] }
