/**
 * Sends a new order to the shop's own system (ORDER_WEBHOOK_URL: an automation such as
 * Make, Zapier or n8n, or the shop's back office). The shop fulfils and invoices from there.
 */
import 'server-only'
import { getOrderWebhook } from '@/config/bank'

export type OrderNotification = {
  reference: string
  createdAt: string
  status: 'awaiting_payment'
  paymentMethod: 'transfer'
  currency: 'RON'
  total: number
  lines: { productId: string; variantId?: string; name: string; description?: string; quantity: number; unitAmount: number }[]
  customer: Record<string, string | boolean>
}

export async function notifyOrder(order: OrderNotification): Promise<boolean> {
  const hook = getOrderWebhook()
  if (!hook) return false
  try {
    const res = await fetch(hook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': order.reference,
        ...(hook.secret && { Authorization: `Bearer ${hook.secret}` }),
      },
      body: JSON.stringify(order),
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) console.error('[orders] webhook responded', res.status)
    return res.ok
  } catch (e) {
    console.error('[orders] webhook failed', e instanceof Error ? e.message : e)
    return false
  }
}
