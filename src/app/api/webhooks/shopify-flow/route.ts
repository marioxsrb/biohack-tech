import { timingSafeEqual } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { getConfig } from '@/server/config'
import { errText, log } from '@/server/log'
import { applyFlowEvent, parseFlowEvent } from '@/server/marketing/shopify-flow'
import { rateLimit } from '@/server/rate-limit'

export const runtime = 'nodejs'

const same = (a: string, b: string) => {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}
const masked = (email: string) => email.replace(/^(.{2})[^@]*@/, '$1***@')

/**
 * Shopify Flow ("Send HTTP request") → GHL: abandoned checkouts and email signups (server/marketing/shopify-flow.ts).
 * The Flow sends SHOPIFY_FLOW_SECRET in x-bt-secret; without the secret the route does not exist (404). A GHL failure
 * is a 502, so Flow retries; a body that cannot be used is a 200 with skipped (retrying would not help).
 */
export async function POST(req: NextRequest) {
  const c = getConfig()
  const secret = c.shopifyFlow.secret
  if (!secret) return NextResponse.json({ error: 'not configured' }, { status: 404 })
  if (!same(req.headers.get('x-bt-secret') ?? '', secret)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!c.ghl) return NextResponse.json({ error: 'ghl not configured' }, { status: 503 })
  if (!rateLimit('shopify-flow', 300, 60_000)) return NextResponse.json({ error: 'rate limit' }, { status: 429 })
  const raw = await req.text()
  if (raw.length > 20_000) return NextResponse.json({ error: 'too large' }, { status: 413 })
  let body: Record<string, unknown>
  try {
    body = JSON.parse(raw)
  } catch {
    return NextResponse.json({ skipped: 'bad json' })
  }
  const e = parseFlowEvent(body && typeof body === 'object' ? body : {})
  if (!e) {
    log.info('shopify_flow.skipped', { type: String(body?.type ?? '') })
    return NextResponse.json({ skipped: 'unusable' })
  }
  try {
    const r = await applyFlowEvent(c.ghl, e)
    log.info('shopify_flow', { type: e.type, email: masked(e.email), action: r.action, contactId: r.contactId })
    return NextResponse.json({ ok: true, action: r.action })
  } catch (err) {
    log.warn('shopify_flow.failed', { type: e.type, email: masked(e.email), error: errText(err) })
    return NextResponse.json({ error: 'ghl' }, { status: 502 })
  }
}
