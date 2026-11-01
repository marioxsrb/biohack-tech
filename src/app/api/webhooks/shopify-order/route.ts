import { timingSafeEqual } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { getConfig } from '@/server/config'
import { errText, log } from '@/server/log'
import { BF_BUYER_STOP, stopBuyer, validBuyerEmail } from '@/server/marketing/bf-buyer-stop'
import { rateLimit } from '@/server/rate-limit'

export const runtime = 'nodejs'

const same = (a: string, b: string) => {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

const masked = (email: string) => email.trim().toLowerCase().replace(/^(.{2})[^@]*@/, '$1***@')

/**
 * Shopify Flow ("Order created" → Send HTTP request) → us: {"email": "...", "order": "#1234"}.
 * The buyer leaves the Brain Event Black Friday workflow (server/marketing/bf-buyer-stop.ts).
 * Without BF_BUYER_STOP=dry|live and its secret the route does not exist (404); a wrong secret is 401.
 * A GHL failure is a 502, so Flow retries; an address Brain Event does not have is a 200 with matched: 0.
 */
export async function POST(req: NextRequest) {
  const c = getConfig()
  const { mode, secret } = c.bfBuyerStop
  if (mode === 'off' || !secret) return NextResponse.json({ error: 'not configured' }, { status: 404 })
  if (!same(req.headers.get('x-bt-secret') ?? '', secret)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!rateLimit('bf-buyer-stop', 120, 60_000)) return NextResponse.json({ error: 'rate limit' }, { status: 429 })
  const target = c.ghlTagMirrors.find((m) => m.locationId === BF_BUYER_STOP.locationId)
  if (!target) return NextResponse.json({ error: 'brain event not configured' }, { status: 503 })

  const raw = await req.text()
  if (raw.length > 4_000) return NextResponse.json({ error: 'too large' }, { status: 413 })
  let body: { email?: unknown; order?: unknown }
  try {
    body = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'bad json' }, { status: 400 })
  }
  // An order without an email (POS, draft) has nobody to look up.
  if (!validBuyerEmail(body.email)) return NextResponse.json({ skipped: 'no email' })
  const order = typeof body.order === 'string' ? body.order.slice(0, 40) : undefined
  try {
    const r = await stopBuyer(target, body.email, mode)
    log.info('bf_buyer_stop', { email: masked(body.email), order, ...r })
    return NextResponse.json(r)
  } catch (e) {
    log.warn('bf_buyer_stop_failed', { email: masked(body.email), order, error: errText(e) })
    return NextResponse.json({ error: 'ghl' }, { status: 502 })
  }
}
