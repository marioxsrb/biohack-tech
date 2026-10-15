import { NextResponse, type NextRequest } from 'next/server'
import { getProduct } from '@/content/catalog'
import { GATE_COOKIE, GATE_DAYS, isGatedHost, PROMO_COOKIE } from '@/lib/lead'
import { getConfig } from '@/server/config'
import { getDb } from '@/server/db'
import { leads } from '@/server/leads'

export const runtime = 'nodejs'

/**
 * A recovery email's link. The token is the lead's own (opaque, single purpose). On the price-gated funnel it
 * unlocks prices on this device (the person already gave their details). Someone who stopped at the price
 * goes back to that product's page; someone who stopped in the checkout gets the recovery page, which puts
 * the selection back in the cart. An unknown token goes to that page too, which says the link is no longer valid.
 */
export async function GET(req: NextRequest) {
  const t = req.nextUrl.searchParams.get('t') ?? ''
  const safe = /^[\w-]{20,64}$/.test(t) ? t : 'invalid'
  const lead = safe === 'invalid' ? null : await leads.byRecoveryToken(await getDb(), safe).catch(() => null)
  const gatedHost = isGatedHost(req.headers.get('host'))
  // Stopped at the price: back to that product (or the home page, for a form sent without one), unlocked.
  const priceStage = lead?.stage === 'lead'
  const product = priceStage ? getProduct(lead.productId) : undefined
  const to = priceStage ? (product ? `/products/${product.slug}` : '/') : `/reluare/${safe}`
  // The address the visitor used (acces.<domain> or the main site): req.url can carry the server's own hostname.
  const host = req.headers.get('host')
  const origin = host && /^[\w.-]+(:\d+)?$/.test(host) ? `${req.headers.get('x-forwarded-proto') === 'http' || /\.?localhost(:\d+)?$/.test(host) ? 'http' : 'https'}://${host}` : req.url
  const res = NextResponse.redirect(new URL(`${to}${priceStage ? '?recuperare=1' : ''}`, origin), 303)
  if (lead && lead.funnel === 'gated_price' && gatedHost) {
    res.cookies.set(GATE_COOKIE, lead.id, { path: '/', sameSite: 'lax', secure: getConfig().siteUrl.startsWith('https://'), maxAge: GATE_DAYS * 86_400 })
  }
  // The AI call's personal code: kept for a day so the checkout fills it in (the server still checks it there).
  const code = (req.nextUrl.searchParams.get('cod') ?? '').toUpperCase()
  if (lead && /^[A-Z0-9]{4,32}$/.test(code)) res.cookies.set(PROMO_COOKIE, code, { path: '/', sameSite: 'lax', secure: getConfig().siteUrl.startsWith('https://'), maxAge: 86_400 })
  res.headers.set('X-Robots-Tag', 'noindex, nofollow')
  return res
}
