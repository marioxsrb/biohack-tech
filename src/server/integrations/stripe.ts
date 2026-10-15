/**
 * Stripe over its REST API (no SDK). Card data never reaches this server: the browser's
 * Payment Element sends it straight to Stripe. We create the PaymentIntent with the amount
 * from our order, and we accept payment results only from Stripe (signed webhook, or a
 * server-side retrieve with the secret key).
 */
import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'
import type { StripeConfig } from '@/server/config'

export class StripeError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    /** Set when Stripe created a PaymentIntent but refused to confirm it (e.g. a declined card). */
    readonly paymentIntentId?: string,
  ) {
    super(message)
  }
  /** Stripe's 409 for a second identical request while the first is still running (safe to repeat). */
  idempotencyInProgress = false
}

function encode(obj: Record<string, unknown>, prefix = '', out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || v === '') continue
    const key = prefix ? `${prefix}[${k}]` : k
    if (typeof v === 'object') encode(v as Record<string, unknown>, key, out)
    else out.append(key, String(v))
  }
  return out
}

/**
 * Two identical requests at once (a double submit, a network retry): Stripe answers the second with 409
 * "another in-progress request using this Idempotent Key" and asks to try again. Once the first finishes,
 * the same key returns the same object, so the request is simply repeated a few times, briefly.
 */
const IN_PROGRESS_RETRIES = [400, 800, 1600, 3200]

async function call<T>(c: StripeConfig, path: string, init?: { body?: Record<string, unknown>; idempotencyKey?: string }): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await callOnce<T>(c, path, init)
    } catch (e) {
      const inProgress = e instanceof StripeError && e.status === 409 && e.idempotencyInProgress && !!init?.idempotencyKey
      if (!inProgress || attempt >= IN_PROGRESS_RETRIES.length) throw e
      await new Promise((r) => setTimeout(r, IN_PROGRESS_RETRIES[attempt]))
    }
  }
}

async function callOnce<T>(c: StripeConfig, path: string, init?: { body?: Record<string, unknown>; idempotencyKey?: string }): Promise<T> {
  const res = await fetch(`${c.apiBase}/v1${path}`, {
    method: init?.body ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${c.secretKey}`,
      ...(init?.body && { 'Content-Type': 'application/x-www-form-urlencoded' }),
      ...(init?.idempotencyKey && { 'Idempotency-Key': init.idempotencyKey }),
    },
    body: init?.body ? encode(init.body) : undefined,
    cache: 'no-store',
    signal: AbortSignal.timeout(20_000),
  })
  const json = (await res.json().catch(() => ({}))) as { error?: { type?: string; message?: string; code?: string; decline_code?: string; payment_intent?: { id?: string } } }
  if (!res.ok) {
    const err = new StripeError(json.error?.message ?? `Stripe ${res.status}`, res.status, json.error?.decline_code ?? json.error?.code, json.error?.payment_intent?.id)
    err.idempotencyInProgress = res.status === 409 && /in-progress request using this idempotent key/i.test(json.error?.message ?? '')
    throw err
  }
  return json as T
}

export type PaymentIntent = {
  id: string
  status: 'requires_payment_method' | 'requires_confirmation' | 'requires_action' | 'processing' | 'requires_capture' | 'canceled' | 'succeeded'
  amount: number
  amount_received: number
  currency: string
  client_secret: string
  metadata: Record<string, string>
  last_payment_error?: { message?: string; code?: string; decline_code?: string } | null
  /** Id of the card used (never card data). */
  payment_method?: string | null
  customer?: string | null
}

export const stripe = {
  /** One Stripe customer per card order, so the card can be offered again right after payment. */
  createCustomer(c: StripeConfig, o: { id: string; orderNumber: string; email: string; name: string }) {
    return call<{ id: string }>(c, '/customers', {
      idempotencyKey: `cus-create-${o.id}`,
      body: { email: o.email, name: o.name, metadata: { order_id: o.id, order_number: o.orderNumber } },
    })
  },

  /**
   * One PaymentIntent per order: the idempotency key is the order id. With a customer, Stripe keeps the
   * card on that customer for on-session use only (the customer present on our page), which is what the
   * post-purchase offer needs; it is detached again when the offer ends.
   */
  createPaymentIntent(c: StripeConfig, o: { id: string; orderNumber: string; totalMinor: number; currency?: string }, customerId?: string) {
    return call<PaymentIntent>(c, '/payment_intents', {
      idempotencyKey: `pi-create-${o.id}`,
      body: {
        amount: o.totalMinor,
        // The order's own currency (lei, or euro/dollar on the international site).
        currency: (o.currency ?? 'RON').toLowerCase(),
        // Card only (Apple Pay / Google Pay count as cards). Bank transfer is handled by us, not Stripe.
        payment_method_types: ['card'],
        description: `Biohack Tech ${o.orderNumber}`,
        metadata: { order_id: o.id, order_number: o.orderNumber },
        ...(customerId && { customer: customerId, setup_future_usage: 'on_session' }),
      },
    })
  },

  /**
   * The post-purchase charge: the saved card, confirmed on the server while the customer is on the page
   * (not off-session). Stripe decides whether the bank wants authentication (status requires_action).
   */
  createUpsellPaymentIntent(c: StripeConfig, o: { id: string; orderNumber: string; totalMinor: number; parentId: string; currency?: string }, customerId: string, paymentMethodId: string) {
    return call<PaymentIntent>(c, '/payment_intents', {
      idempotencyKey: `pi-upsell-${o.id}`,
      body: {
        amount: o.totalMinor,
        currency: (o.currency ?? 'RON').toLowerCase(),
        payment_method_types: ['card'],
        customer: customerId,
        payment_method: paymentMethodId,
        confirm: true,
        description: `Biohack Tech ${o.orderNumber} (adăugată după plată)`,
        metadata: { order_id: o.id, order_number: o.orderNumber, parent_order_id: o.parentId },
      },
    })
  },

  cancelPaymentIntent: (c: StripeConfig, id: string) => call<PaymentIntent>(c, `/payment_intents/${encodeURIComponent(id)}/cancel`, { body: {}, idempotencyKey: `pi-cancel-${id}` }),
  detachPaymentMethod: (c: StripeConfig, id: string) => call<{ id: string }>(c, `/payment_methods/${encodeURIComponent(id)}/detach`, { body: {} }),
  retrievePaymentIntent: (c: StripeConfig, id: string) => call<PaymentIntent>(c, `/payment_intents/${encodeURIComponent(id)}`),
}

export type StripeEvent = { id: string; type: string; livemode: boolean; data: { object: Record<string, unknown> } }

/**
 * Verifies the Stripe-Signature header (HMAC-SHA256 of "timestamp.rawBody") and returns
 * the parsed event. Rejects stale timestamps to stop replays of old captured requests.
 */
export function verifyWebhook(rawBody: string, header: string | null, secret: string, toleranceSec = 300, now = Date.now()): StripeEvent {
  if (!header) throw new Error('missing signature')
  const parts = header.split(',').map((p) => p.split('=') as [string, string])
  const t = Number(parts.find(([k]) => k === 't')?.[1])
  const sigs = parts.filter(([k]) => k === 'v1').map(([, v]) => v)
  if (!Number.isFinite(t) || !sigs.length) throw new Error('malformed signature')
  if (Math.abs(now / 1000 - t) > toleranceSec) throw new Error('timestamp outside tolerance')
  const expected = createHmac('sha256', secret).update(`${t}.${rawBody}`).digest()
  const ok = sigs.some((s) => {
    const got = Buffer.from(s, 'hex')
    return got.length === expected.length && timingSafeEqual(got, expected)
  })
  if (!ok) throw new Error('signature mismatch')
  return JSON.parse(rawBody) as StripeEvent
}

/** Test helper: builds a valid signature header for a payload. */
export function signPayload(rawBody: string, secret: string, t = Math.floor(Date.now() / 1000)) {
  return `t=${t},v1=${createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex')}`
}
