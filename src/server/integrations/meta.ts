/**
 * Meta Conversions API. One Purchase per paid order, with the same event id the browser pixel uses
 * (the order number), so Meta counts it once. Value is the order total in lei, currency RON.
 * No token: the caller skips. The token is never logged.
 */
import 'server-only'
import { createHash } from 'node:crypto'
import { metaEmail, metaPhoneDigits, purchaseLei, type MetaBrowser } from '@/lib/meta'
import type { Order } from '@/server/orders/model'

export class MetaError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
  get retryable() {
    return this.status === 0 || this.status === 429 || this.status >= 500
  }
}

export type MetaCapiConfig = { pixelId: string; accessToken: string; testEventCode: string | null }

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')

export type MetaPurchaseBody = {
  data: {
    event_name: 'Purchase'
    event_time: number
    event_id: string
    event_source_url: string
    action_source: 'website'
    user_data: Record<string, unknown>
    custom_data: {
      currency: 'RON'
      value: number
      content_type: 'product'
      content_ids: string[]
      contents: { id: string; quantity: number; item_price: number }[]
      num_items: number
      order_id: string
    }
  }[]
  test_event_code?: string
}

/** The Purchase Meta should receive. Null when there is no email to match on or the total is not a positive lei amount. */
export function metaPurchaseBody(order: Order, siteUrl: string, testEventCode?: string | null, now = Date.now()): MetaPurchaseBody | null {
  const email = metaEmail(order.email)
  if (!email) return null
  const fx = order.fxRate > 0 ? order.fxRate : 1
  const value = purchaseLei(order.totalMinor, fx)
  if (!(value > 0)) return null
  const contents = order.items.map((i) => {
    const id = i.variantId ? `${i.productId}/${i.variantId}` : i.productId
    const charged = Math.max(0, i.lineTotalMinor - i.discountMinor)
    const unit = i.quantity ? Math.round(charged / i.quantity) : i.unitPriceMinor
    return { id, quantity: i.quantity, item_price: purchaseLei(unit, fx) }
  })
  const browser: MetaBrowser = order.attribution?.meta ?? {}
  const phone = metaPhoneDigits(order.phone)
  const user_data: Record<string, unknown> = { em: [sha256(email)] }
  if (phone) user_data.ph = [sha256(phone)]
  if (browser.fbp) user_data.fbp = browser.fbp
  if (browser.fbc) user_data.fbc = browser.fbc
  if (browser.ip) user_data.client_ip_address = browser.ip
  if (browser.ua) user_data.client_user_agent = browser.ua
  const origin = browser.host ? `https://${browser.host}` : siteUrl.replace(/\/$/, '')
  const body: MetaPurchaseBody = {
    data: [
      {
        event_name: 'Purchase',
        event_time: Math.floor((order.paidAt ?? new Date(now)).getTime() / 1000),
        event_id: order.orderNumber,
        event_source_url: `${origin}/comanda/${order.publicToken}`,
        action_source: 'website',
        user_data,
        custom_data: {
          currency: 'RON',
          value,
          content_type: 'product',
          content_ids: contents.map((c) => c.id),
          contents,
          num_items: contents.reduce((n, c) => n + c.quantity, 0),
          order_id: order.orderNumber,
        },
      },
    ],
  }
  if (testEventCode) body.test_event_code = testEventCode
  return body
}

/** Sends the Purchase. Throws MetaError on failure so the job retries when it is worth retrying. */
export async function sendMetaPurchase(c: MetaCapiConfig, order: Order, siteUrl: string): Promise<string> {
  const body = metaPurchaseBody(order, siteUrl, c.testEventCode)
  if (!body) throw new MetaError('purchase has no value or email', 400)
  let res: Response
  try {
    res = await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(c.pixelId)}/events?access_token=${encodeURIComponent(c.accessToken)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    })
  } catch (e) {
    throw new MetaError(`network: ${e instanceof Error ? e.message : e}`, 0)
  }
  const json = (await res.json().catch(() => ({}))) as { events_received?: number; error?: { message?: string }; messages?: string[] }
  if (!res.ok) throw new MetaError(json.error?.message ?? `Meta ${res.status}`, res.status)
  if (!json.events_received) throw new MetaError(json.messages?.join('; ') || 'Meta accepted no events', 400)
  return `events_received=${json.events_received}`
}
