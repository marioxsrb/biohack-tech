import { NextResponse, type NextRequest } from 'next/server'
import { FULFIL_COOKIE } from '@/lib/fulfillment-auth'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const res = NextResponse.redirect(new URL('/fulfillment/login', req.url), 303)
  res.cookies.set(FULFIL_COOKIE, '', { httpOnly: true, secure: req.nextUrl.protocol === 'https:', sameSite: 'strict', path: '/', maxAge: 0 })
  return res
}
