import { timingSafeEqual } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { kickJobs } from '@/server/jobs/runner'
import { errText, log } from '@/server/log'
import { withdrawMarketing } from '@/server/marketing/unsubscribe'

export const runtime = 'nodejs'

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b))

/**
 * GoHighLevel → site: a contact unsubscribed or asked to stop inside GHL (DND on email, a reply, an
 * operator). A GHL workflow posts `{ "email": "..." }` here with the header `x-bt-webhook-secret`.
 * The withdrawal is recorded in our database, which every marketing decision reads. Absent without
 * GHL_WEBHOOK_SECRET.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.GHL_WEBHOOK_SECRET?.trim()
  if (!secret) return new NextResponse('Not found', { status: 404 })
  if (!same(req.headers.get('x-bt-webhook-secret') ?? '', secret)) return NextResponse.json({ ok: false }, { status: 401 })
  const body = (await req.json().catch(() => null)) as { email?: unknown } | null
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 160) return NextResponse.json({ ok: false }, { status: 400 })
  try {
    if (await withdrawMarketing(email, 'ghl')) kickJobs()
  } catch (e) {
    log.error('ghl.unsubscribe_failed', { error: errText(e) })
    return NextResponse.json({ ok: false }, { status: 503 })
  }
  return NextResponse.json({ ok: true })
}
