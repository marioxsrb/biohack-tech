import { NextResponse, type NextRequest } from 'next/server'
import { lineKey } from '@/components/cart/cart-store'
import { resolveLine, variantLabel } from '@/content/catalog'
import { normalizeCustomer, validateCustomer } from '@/lib/checkout'
import { getPaymentProvider, PaymentError, type OrderLine } from '@/lib/payments'
import { site } from '@/config/site'

const fail = (status: number, code: string, message: string, extra?: object) =>
  NextResponse.json({ error: code, message, ...extra }, { status })

/**
 * Creates a hosted payment session for one currency's worth of cart lines.
 * Prices come from the catalog on the server; the client only sends ids and quantities.
 */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return fail(400, 'BAD_REQUEST', 'Cererea nu este validă.')
  }

  const currency = body.currency
  if (currency !== 'EUR' && currency !== 'RON') return fail(400, 'BAD_CURRENCY', 'Moneda nu este validă.')

  const rawLines = Array.isArray(body.lines) ? body.lines.slice(0, 20) : []
  const lines: OrderLine[] = []
  for (const raw of rawLines) {
    const { productId, variantId, quantity } = (raw ?? {}) as Record<string, unknown>
    const r = resolveLine(String(productId), typeof variantId === 'string' ? variantId : undefined)
    const q = Number(quantity)
    if (!r || !Number.isInteger(q) || q < 1 || q > 10) return fail(400, 'BAD_LINE', 'Un produs din coș nu mai este disponibil. Reîncarcă pagina.')
    if (r.product.price.currency !== currency) continue
    lines.push({
      key: lineKey({ productId: r.product.id, variantId: r.variant?.id }),
      name: r.product.name,
      description: r.variant ? variantLabel(r.product, r.variant) : undefined,
      quantity: q,
      unitAmount: r.product.price.amount,
    })
  }
  if (lines.length === 0) return fail(400, 'EMPTY', 'Coșul este gol.')

  const customer = normalizeCustomer(body.customer)
  const errors = validateCustomer(customer, body.acceptedTerms === true)
  if (Object.keys(errors).length) return fail(422, 'INVALID', 'Verifică datele din formular.', { fields: errors })

  const provider = getPaymentProvider()
  if (!provider) {
    return fail(
      503,
      'PAYMENTS_DISABLED',
      `Plata online nu este activă încă, așa că nu am înregistrat nicio comandă. Scrie-ne la ${site.email} sau sună la ${site.phone} și te ajutăm să comanzi.`,
    )
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL ? site.url : req.nextUrl.origin
  try {
    const { redirectUrl } = await provider.createCheckout({
      currency,
      lines,
      customer,
      successUrl: `${origin}/checkout/success?ref={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${origin}/checkout?anulat=1`,
    })
    return NextResponse.json({ url: redirectUrl })
  } catch (e) {
    console.error('[checkout] provider error', e instanceof PaymentError ? e.message : e)
    return fail(502, 'PROVIDER', 'Nu am putut deschide pagina de plată. Încearcă din nou în câteva minute.')
  }
}
