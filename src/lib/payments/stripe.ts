/**
 * Stripe Checkout (hosted payment page) over the REST API, no SDK.
 * Card data never touches this server. Docs: https://docs.stripe.com/api/checkout/sessions
 */
import type { CheckoutRequest, CheckoutStatus, PaymentProvider } from './types'
import { PaymentError } from './types'
import { billingAddress, shippingAddress } from '@/lib/checkout'
import { CURRENCY } from '@/lib/money'

const API = 'https://api.stripe.com/v1'

/** Flattens nested params into Stripe's form encoding: a[b][0][c]=v */
function encode(obj: Record<string, unknown>, prefix = '', out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || v === '') continue
    const key = prefix ? `${prefix}[${k}]` : k
    if (typeof v === 'object') encode(v as Record<string, unknown>, key, out)
    else out.append(key, String(v))
  }
  return out
}

export function createStripeProvider(secretKey: string): PaymentProvider {
  const call = async (path: string, init?: { body?: URLSearchParams; idempotencyKey?: string }) => {
    const res = await fetch(`${API}${path}`, {
      method: init?.body ? 'POST' : 'GET',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        ...(init?.body && { 'Content-Type': 'application/x-www-form-urlencoded' }),
        ...(init?.idempotencyKey && { 'Idempotency-Key': init.idempotencyKey }),
      },
      body: init?.body,
      cache: 'no-store',
    })
    const json = await res.json()
    if (!res.ok) throw new PaymentError(json?.error?.message ?? `Stripe ${res.status}`)
    return json
  }

  return {
    id: 'stripe',

    async createCheckout(req: CheckoutRequest) {
      const o = req.order
      // Everything the shop needs to ship and invoice, visible on the payment in the Stripe dashboard.
      const metadata = {
        customer_name: o.name,
        customer_phone: o.phone,
        buyer_type: o.buyerType === 'pj' ? 'persoana juridica' : 'persoana fizica',
        company: o.buyerType === 'pj' ? o.company : undefined,
        cui: o.buyerType === 'pj' ? o.cui : undefined,
        reg_com: o.buyerType === 'pj' ? o.regCom : undefined,
        billing_address: billingAddress(o),
        shipping_address: shippingAddress(o),
        notes: o.notes,
        line_keys: req.lines.map((l) => `${l.key}*${l.quantity}`).join(','),
      }
      const body = encode({
        mode: 'payment',
        locale: 'ro',
        customer_email: o.email,
        success_url: req.successUrl,
        cancel_url: req.cancelUrl,
        line_items: req.lines.map((l) => ({
          quantity: l.quantity,
          price_data: {
            currency: CURRENCY.toLowerCase(),
            unit_amount: l.unitAmount,
            product_data: { name: l.name, description: l.description },
          },
        })),
        metadata,
        payment_intent_data: { metadata, receipt_email: o.email },
      })
      const session = await call('/checkout/sessions', { body, idempotencyKey: req.idempotencyKey })
      return { redirectUrl: session.url as string, reference: session.id as string }
    },

    async getCheckout(reference: string): Promise<CheckoutStatus | null> {
      if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(reference)) return null
      try {
        const s = await call(`/checkout/sessions/${reference}`)
        const keys = String(s.metadata?.line_keys ?? '')
          .split(',')
          .filter(Boolean)
          .map((k: string) => k.split('*')[0])
        return {
          status: s.payment_status === 'paid' ? 'paid' : s.status === 'expired' ? 'expired' : 'unpaid',
          email: s.customer_details?.email ?? s.customer_email ?? undefined,
          total: s.amount_total != null && String(s.currency).toUpperCase() === CURRENCY ? Number(s.amount_total) : undefined,
          lineKeys: keys,
        }
      } catch {
        return null
      }
    },
  }
}
