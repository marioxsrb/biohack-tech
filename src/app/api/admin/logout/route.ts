import { NextResponse, type NextRequest } from 'next/server'
import { ADMIN_COOKIE } from '@/lib/admin-auth'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const res = NextResponse.redirect(new URL('/admin/login', req.url), 303)
  res.cookies.set(ADMIN_COOKIE, '', { httpOnly: true, secure: req.nextUrl.protocol === 'https:', sameSite: 'strict', path: '/', maxAge: 0 })
  return res
}
