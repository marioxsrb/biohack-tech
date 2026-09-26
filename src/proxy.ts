import { NextResponse, type NextRequest } from 'next/server'

/**
 * /admin is behind HTTP Basic Auth (ADMIN_USER / ADMIN_PASSWORD). Without a password
 * configured, the area does not exist. Serve the site over HTTPS only (it is, in production).
 */
export function proxy(req: NextRequest) {
  const password = process.env.ADMIN_PASSWORD
  if (!password || password.length < 12) return new NextResponse('Not found', { status: 404 })
  const user = process.env.ADMIN_USER || 'admin'
  const header = req.headers.get('authorization') ?? ''
  const [scheme, encoded] = header.split(' ')
  if (scheme === 'Basic' && encoded) {
    const decoded = atob(encoded)
    const i = decoded.indexOf(':')
    if (safeEqual(decoded.slice(0, i), user) && safeEqual(decoded.slice(i + 1), password)) {
      const res = NextResponse.next()
      res.headers.set('X-Robots-Tag', 'noindex, nofollow')
      res.headers.set('Cache-Control', 'no-store')
      return res
    }
  }
  return new NextResponse('Autentificare necesară', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="Biohack Tech admin", charset="UTF-8"' } })
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let d = 0
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return d === 0
}

export const config = { matcher: ['/admin', '/admin/:path*'] }
