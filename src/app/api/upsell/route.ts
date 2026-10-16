import { NextResponse, type NextRequest } from 'next/server'
import { kickJobs } from '@/server/jobs/runner'
import { errText, log } from '@/server/log'
import { declineUpsell } from '@/server/orders/service'
import { orders } from '@/server/orders/repository'
import { acceptUpsell, upsellStatus } from '@/server/orders/upsell'
import { getDb } from '@/server/db'
import { clientIp, rateLimit } from '@/server/rate-limit'
import { ensureStoreSettings } from '@/server/store-settings'

export const runtime = 'nodejs'

/**
 * The post-purchase offer. The order page's own token identifies the paid order; the browser sends only
 * which action, and for "accept" which product/variant (checked against the offer). Prices, the amount
 * and the card are decided here and by Stripe.
 */
export async function POST(req: NextRequest) {
  // Prices and stock as the admin set them (server/store-settings.ts), before anything is priced.
  await ensureStoreSettings()
  if (!rateLimit(`upsell:${clientIp(req.headers)}`, 20, 10 * 60_000)) return NextResponse.json({ state: 'closed', message: 'Prea multe încercări.' }, { status: 429 })
  let body: Record<string, unknown>
  try {
    // A real request is a few kilobytes; anything far larger is refused before parsing.
    const raw = await req.text()
    if (raw.length > 4_000) throw new Error('too large')
    body = JSON.parse(raw)
  } catch {
    return NextResponse.json({ state: 'closed' }, { status: 400 })
  }
  const token = typeof body.token === 'string' && /^[\w-]{20,64}$/.test(body.token) ? body.token : null
  if (!token) return NextResponse.json({ state: 'closed' }, { status: 400 })

  try {
    if (body.action === 'accept') {
      const r = await acceptUpsell(token, body.productId, body.variantId)
      kickJobs()
      return NextResponse.json(r)
    }
    if (body.action === 'status') {
      const r = await upsellStatus(token, body.abandoned === true)
      kickJobs()
      return NextResponse.json(r ?? { state: 'closed' })
    }
    if (body.action === 'decline') {
      const o = await orders.byToken(await getDb(), token)
      if (o) await declineUpsell(o.id)
      kickJobs()
      return NextResponse.json({ state: 'declined' })
    }
    return NextResponse.json({ state: 'closed' }, { status: 400 })
  } catch (e) {
    log.error('upsell.route_error', { error: errText(e) })
    return NextResponse.json({ state: 'failed', message: 'Nu am putut adăuga produsul. Comanda ta inițială rămâne confirmată.' }, { status: 500 })
  }
}
