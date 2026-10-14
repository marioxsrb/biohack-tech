import { NextResponse, type NextRequest } from 'next/server'
import { resolveOrderLines } from '@/lib/orders/resolve'
import { priceLines } from '@/lib/promotions'
import { getDb } from '@/server/db'
import { errText, log } from '@/server/log'
import { promoCodes, promoMessage, ruleOf } from '@/server/promo'
import { clientIp, rateLimit } from '@/server/rate-limit'

export const runtime = 'nodejs'

/**
 * Checks a promo code typed in the checkout against the current cart (and the email, when already typed), and
 * returns the rule so the page shows the same totals the order will have. Nothing is reserved: the order checks
 * the code again when it is placed. Answers in the checkout's language.
 */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, message: 'BAD_REQUEST' }, { status: 400 })
  }
  const locale = body.locale === 'en' ? 'en' : 'ro'
  if (!rateLimit(`promo:${clientIp(req.headers)}`, 20, 10 * 60_000)) {
    return NextResponse.json({ ok: false, message: locale === 'en' ? 'Too many attempts. Please try again in a few minutes.' : 'Prea multe încercări. Încearcă din nou în câteva minute.' }, { status: 429 })
  }
  const resolved = resolveOrderLines(body.lines)
  if (!resolved.ok) return NextResponse.json({ ok: false, message: promoMessage('no_products', locale) }, { status: 422 })
  try {
    const email = typeof body.email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim()) ? body.email.trim().toLowerCase() : undefined
    const checked = await promoCodes.check(await getDb(), body.code, { email })
    if (!checked.ok) return NextResponse.json({ ok: false, message: promoMessage(checked.problem, locale) }, { status: 422 })
    const rule = ruleOf(checked.code)
    const pricing = priceLines(resolved.lines, undefined, rule)
    if (pricing.code?.problem) return NextResponse.json({ ok: false, message: promoMessage(pricing.code.problem, locale, rule) }, { status: 422 })
    return NextResponse.json({ ok: true, rule, discountMinor: pricing.code?.amountMinor ?? 0 })
  } catch (e) {
    log.error('promo.check_failed', { error: errText(e) })
    return NextResponse.json({ ok: false, message: locale === 'en' ? 'The code could not be checked. Please try again.' : 'Nu am putut verifica codul. Încearcă din nou.' }, { status: 500 })
  }
}
