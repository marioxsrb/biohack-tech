import { NextResponse, type NextRequest } from 'next/server'
import { getBankDetails } from '@/config/bank'
import { site } from '@/config/site'
import { normalizeOrder, validateOrder } from '@/lib/checkout'
import { CURRENCY } from '@/lib/money'
import { notifyOrder } from '@/lib/orders/notify'
import { orderReference, resolveOrderLines } from '@/lib/orders/resolve'
import { availablePaymentMethods, getPaymentProvider, PaymentError } from '@/lib/payments'

const fail = (status: number, code: string, message: string, extra?: object) => NextResponse.json({ error: code, message, ...extra }, { status })

const contactLine = `Scrie-ne la ${site.email} sau sună la ${site.phone} și te ajutăm să comanzi.`

/**
 * Places an order. The browser sends only product ids, variant ids and quantities, plus the
 * customer's details; prices, names and the total are resolved here from the catalog.
 *   card     → a Stripe Checkout session; the order is paid only when Stripe says so.
 *   transfer → the order is sent to the shop as "awaiting payment" and the customer gets
 *              the bank details. It is never marked paid here.
 */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return fail(400, 'BAD_REQUEST', 'Cererea nu este validă. Reîncarcă pagina și încearcă din nou.')
  }

  const resolved = resolveOrderLines(body.lines)
  if (!resolved.ok) {
    return resolved.reason === 'EMPTY'
      ? fail(400, 'EMPTY', 'Coșul este gol.')
      : fail(409, 'BAD_LINE', 'Un produs din coș s-a schimbat între timp. Reîncarcă pagina și verifică din nou coșul.')
  }

  const available = availablePaymentMethods()
  const order = normalizeOrder(body.order)
  const errors = validateOrder(order, body.acceptedTerms === true, available)
  if (Object.keys(errors).length) {
    if (errors.paymentMethod && !available.card && !available.transfer) {
      return fail(503, 'PAYMENTS_DISABLED', `Comenzile online nu sunt active încă, așa că nu am înregistrat nimic. ${contactLine}`)
    }
    return fail(422, 'INVALID', 'Verifică datele marcate în formular.', { fields: errors })
  }

  const attemptId = typeof body.attemptId === 'string' && /^[\w-]{8,64}$/.test(body.attemptId) ? body.attemptId : crypto.randomUUID()
  const fingerprint = JSON.stringify({ attemptId, lines: resolved.lines.map((l) => [l.key, l.quantity]), order })
  const reference = await orderReference(fingerprint)

  if (order.paymentMethod === 'transfer') {
    const bank = getBankDetails()!
    const delivered = await notifyOrder({
      reference,
      createdAt: new Date().toISOString(),
      status: 'awaiting_payment',
      paymentMethod: 'transfer',
      currency: CURRENCY,
      total: resolved.total,
      lines: resolved.lines.map((l) => ({ productId: l.productId, variantId: l.variantId, name: l.name, description: l.description, quantity: l.quantity, unitAmount: l.unitAmount })),
      customer: order,
    })
    if (!delivered) {
      return fail(502, 'ORDER_NOT_SAVED', `Nu am putut înregistra comanda. Nu ai de plătit nimic. Încearcă din nou în câteva minute sau ${contactLine.charAt(0).toLowerCase()}${contactLine.slice(1)}`)
    }
    return NextResponse.json({
      method: 'transfer',
      reference,
      total: resolved.total,
      email: order.email,
      lineKeys: resolved.lines.map((l) => l.key),
      bank,
    })
  }

  const provider = getPaymentProvider()!
  const origin = process.env.NEXT_PUBLIC_SITE_URL ? site.url : req.nextUrl.origin
  try {
    const { redirectUrl } = await provider.createCheckout({
      lines: resolved.lines,
      order,
      successUrl: `${origin}/checkout/success?ref={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${origin}/checkout?anulat=1`,
      idempotencyKey: `checkout-${attemptId}-${reference}`,
    })
    return NextResponse.json({ method: 'card', url: redirectUrl })
  } catch (e) {
    console.error('[checkout] provider error', e instanceof PaymentError ? e.message : e)
    return fail(502, 'PROVIDER', 'Nu am putut deschide pagina de plată. Nu ți s-a retras nimic. Încearcă din nou în câteva minute.')
  }
}
