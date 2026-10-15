import { NextResponse, type NextRequest } from 'next/server'
import { ADMIN_COOKIE, ADMIN_SESSION_DAYS, checkAdminCredentials, createAdminSession } from '@/lib/admin-auth'
import { log } from '@/server/log'
import { clientIp, rateLimit } from '@/server/rate-limit'

export const runtime = 'nodejs'

/** The login form: 10 attempts per 15 minutes per address; a session cookie (httpOnly, strict) on success. */
export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null)
  const raw = String(form?.get('next') ?? '/admin')
  const next = /^\/admin(\/[\w/-]*)?$/.test(raw) && !raw.startsWith('/admin/login') ? raw : '/admin'
  const back = (e: string) => NextResponse.redirect(new URL(`/admin/login?e=${e}&next=${encodeURIComponent(next)}`, req.url), 303)
  if (!rateLimit(`admin-login:${clientIp(req.headers)}`, 10, 15 * 60_000)) return back('limit')
  const user = String(form?.get('user') ?? '').trim().slice(0, 100)
  const auth = checkAdminCredentials(user, String(form?.get('password') ?? '').slice(0, 200))
  if (auth === 'disabled') return new NextResponse('Not found', { status: 404 })
  if (auth !== 'ok') {
    log.warn('admin.login_failed', { ip: clientIp(req.headers) })
    return back('invalid')
  }
  const res = NextResponse.redirect(new URL(next, req.url), 303)
  res.cookies.set(ADMIN_COOKIE, await createAdminSession(user), {
    httpOnly: true,
    secure: req.nextUrl.protocol === 'https:',
    sameSite: 'strict',
    path: '/',
    maxAge: ADMIN_SESSION_DAYS * 86_400,
  })
  log.info('admin.login')
  return res
}
