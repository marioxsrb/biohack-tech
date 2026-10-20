import { NextResponse, type NextRequest } from 'next/server'
import { getProduct } from '@/content/catalog'
import { PROMO_COOKIE } from '@/lib/lead'
import { getConfig } from '@/server/config'
import { getDb } from '@/server/db'
import { leads } from '@/server/leads'

export const runtime = 'nodejs'

/**
 * A recovery email's link. The token is the lead's own (opaque, single purpose). The recovery page puts the
 * checkout's selection back in the cart; an older lead without a cart (the former acces price form) goes to its
 * product's page. An unknown token goes to the recovery page too, which says the link is no longer valid.
 */
export async function GET(req: NextRequest) {
  const t = req.nextUrl.searchParams.get('t') ?? ''
  const safe = /^[\w-]{20,64}$/.test(t) ? t : 'invalid'
  const lead = safe === 'invalid' ? null : await leads.byRecoveryToken(await getDb(), safe).catch(() => null)
  const priceStage = lead?.stage === 'lead' && !lead.cart?.length
  const product = priceStage ? getProduct(lead.productId) : undefined
  const to = priceStage ? (product ? `/products/${product.slug}` : '/') : `/reluare/${safe}`
  // The address the visitor used: req.url can carry the server's own hostname.
  const host = req.headers.get('host')
  const origin = host && /^[\w.-]+(:\d+)?$/.test(host) ? `${req.headers.get('x-forwarded-proto') === 'http' || /\.?localhost(:\d+)?$/.test(host) ? 'http' : 'https'}://${host}` : req.url
  const res = NextResponse.redirect(new URL(`${to}${priceStage ? '?recuperare=1' : ''}`, origin), 303)
  // The AI call's personal code: kept for a day so the checkout fills it in (the server still checks it there).
  const code = (req.nextUrl.searchParams.get('cod') ?? '').toUpperCase()
  if (lead && /^[A-Z0-9]{4,32}$/.test(code)) res.cookies.set(PROMO_COOKIE, code, { path: '/', sameSite: 'lax', secure: getConfig().siteUrl.startsWith('https://'), maxAge: 86_400 })
  res.headers.set('X-Robots-Tag', 'noindex, nofollow')
  return res
}
