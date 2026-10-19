import { NextResponse, type NextRequest } from 'next/server'
import { checkFulfilCredentials, createFulfilSession, FULFIL_COOKIE, FULFIL_SESSION_HOURS } from '@/lib/fulfillment-auth'
import { log } from '@/server/log'
import { clientIp, rateLimit } from '@/server/rate-limit'

export const runtime = 'nodejs'

/** The portal login: 10 attempts per 15 minutes per address; a portal-only session cookie (httpOnly, strict). */
export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null)
  const raw = String(form?.get('next') ?? '/fulfillment')
  const next = /^\/fulfillment(\/[\w/-]*)?$/.test(raw) && !raw.startsWith('/fulfillment/login') ? raw : '/fulfillment'
  const back = (e: string) => NextResponse.redirect(new URL(`/fulfillment/login?e=${e}&next=${encodeURIComponent(next)}`, req.url), 303)
  if (!rateLimit(`fulfil-login:${clientIp(req.headers)}`, 10, 15 * 60_000)) return back('limit')
  const user = String(form?.get('user') ?? '').trim().slice(0, 100)
  const role = checkFulfilCredentials(user, String(form?.get('password') ?? '').slice(0, 200))
  if (!role) {
    log.warn('fulfillment.login_failed', { ip: clientIp(req.headers) })
    return back('invalid')
  }
  const res = NextResponse.redirect(new URL(next, req.url), 303)
  res.cookies.set(FULFIL_COOKIE, await createFulfilSession(role, user), {
    httpOnly: true,
    secure: req.nextUrl.protocol === 'https:',
    sameSite: 'strict',
    path: '/',
    maxAge: FULFIL_SESSION_HOURS * 3600,
  })
  log.info('fulfillment.login', { role })
  return res
}
