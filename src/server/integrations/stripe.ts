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
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message)
  }
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

async function call<T>(c: StripeConfig, path: string, init?: { body?: Record<string, unknown>; idempotencyKey?: string }): Promise<T> {
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
  const json = (await res.json().catch(() => ({}))) as { error?: { message?: string; code?: string } }
  if (!res.ok) throw new StripeError(json.error?.message ?? `Stripe ${res.status}`, res.status, json.error?.code)
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
  last_payment_error?: { message?: string; code?: string } | null
}

export const stripe = {
  /** One PaymentIntent per order: the idempotency key is the order id. */
  createPaymentIntent(c: StripeConfig, o: { id: string; orderNumber: string; totalMinor: number }) {
    return call<PaymentIntent>(c, '/payment_intents', {
      idempotencyKey: `pi-create-${o.id}`,
      body: {
        amount: o.totalMinor,
        currency: 'ron',
        // Card only (Apple Pay / Google Pay count as cards). Bank transfer is handled by us, not Stripe.
        payment_method_types: ['card'],
        description: `Biohack Tech ${o.orderNumber}`,
        metadata: { order_id: o.id, order_number: o.orderNumber },
      },
    })
  },
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
