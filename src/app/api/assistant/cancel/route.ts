import { NextResponse, type NextRequest } from 'next/server'
import { getDb } from '@/server/db'
import { assistantEnabled } from '@/server/assistant/chat'
import { readToken, selfCancellable } from '@/server/assistant/orders'
import { supportRequests } from '@/server/assistant/support'
import { kickJobs } from '@/server/jobs/runner'
import { errText, log } from '@/server/log'
import { orders } from '@/server/orders/repository'
import { cancelOrder } from '@/server/orders/service'
import { clientIp, rateLimit } from '@/server/rate-limit'

export const runtime = 'nodejs'

/**
 * The customer's own click on "Da, anulează comanda" in the assistant. The signed token (made only for an order
 * proved with the email code and eligible at that moment) names the order; eligibility is checked again here, the
 * order goes through the canonical transition (source "assistant", in the order's audit trail), and the team gets
 * a resolved support request with a notification.
 */
export async function POST(req: NextRequest) {
  if (!(await assistantEnabled())) return NextResponse.json({ error: 'UNAVAILABLE' }, { status: 404 })
  if (!rateLimit(`assistant-cancel:${clientIp(req.headers)}`, 10, 60 * 60_000)) return NextResponse.json({ error: 'RATE_LIMIT' }, { status: 429 })
  const body = (await req.json().catch(() => ({}))) as { token?: unknown }
  const orderId = readToken('cancel', body.token)
  if (!orderId) return NextResponse.json({ error: 'EXPIRED', message: 'Confirmarea a expirat. Cere din nou anularea în chat.' }, { status: 403 })
  try {
    const db = await getDb()
    const o = await orders.byId(db, orderId)
    if (!o) return NextResponse.json({ error: 'EXPIRED', message: 'Comanda nu a fost găsită.' }, { status: 404 })
    if (o.status === 'cancelled') return NextResponse.json({ ok: true, orderNumber: o.orderNumber, already: true })
    const can = selfCancellable(o)
    if (!can.ok) return NextResponse.json({ error: 'NOT_ALLOWED', message: can.why }, { status: 409 })
    const r = await cancelOrder(o.id, 'assistant', 'Anulată de client din asistentul site-ului (email verificat cu cod)')
    if (!r.changed) return NextResponse.json({ error: 'NOT_ALLOWED', message: 'Comanda nu mai poate fi anulată din asistent.' }, { status: 409 })
    await supportRequests.create(
      db,
      { category: 'cancellation', summary: `Clientul a anulat comanda ${o.orderNumber} din asistentul site-ului.`, orderId: o.id, email: o.email, resolved: { notes: 'Anulată automat (neplătită, nepregătită, fără factură). Nu expedia coletul.' } },
      true,
    )
    kickJobs()
    log.info('assistant.order_cancelled', { orderNumber: o.orderNumber })
    return NextResponse.json({ ok: true, orderNumber: o.orderNumber })
  } catch (e) {
    log.error('assistant.cancel_failed', { error: errText(e) })
    return NextResponse.json({ error: 'SERVER', message: 'Anularea nu a reușit acum. Încearcă din nou sau cere ajutorul echipei.' }, { status: 500 })
  }
}
