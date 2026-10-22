import { NextResponse, type NextRequest } from 'next/server'
import { catalogProduct } from '@/content/catalog'
import { PROMO_COOKIE } from '@/lib/lead'
import { accountEmail } from '@/server/account'
import { getConfig } from '@/server/config'
import { getDb } from '@/server/db'
import { voucherByCode } from '@/server/vouchers'

export const runtime = 'nodejs'

/**
 * "Folosește voucherul" from the account page: only the address in the signed link, only its own active voucher. The
 * code goes into the checkout's code cookie (as a recovery link does) and the visitor lands on the product's page.
 */
export async function GET(req: NextRequest) {
  const home = new URL('/', req.url)
  const email = accountEmail(req.nextUrl.searchParams.get('t'))
  const code = (req.nextUrl.searchParams.get('cod') ?? '').toUpperCase()
  if (!email || !/^[A-Z0-9]{4,32}$/.test(code)) return NextResponse.redirect(home, 303)
  const v = await voucherByCode(await getDb(), code)
  if (!v || v.email !== email || v.status !== 'active' || v.expiresAt <= new Date()) return NextResponse.redirect(home, 303)
  const slug = catalogProduct(v.productId)?.slug
  const res = NextResponse.redirect(new URL(slug ? `/products/${slug}` : '/', req.url), 303)
  res.cookies.set(PROMO_COOKIE, code, { path: '/', sameSite: 'lax', secure: getConfig().siteUrl.startsWith('https://'), maxAge: 86_400 })
  res.headers.set('Cache-Control', 'no-store')
  return res
}
