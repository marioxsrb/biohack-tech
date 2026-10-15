import { NextResponse, type NextRequest } from 'next/server'
import { cookieFrom, GATE_COOKIE, isGatedHost } from '@/lib/lead'
import { isIntlHost, siteOrigin } from '@/lib/sites'
import { getConfig } from '@/server/config'
import { getDb } from '@/server/db'
import { assistantEnabled, assistantTurn, cleanMessages } from '@/server/assistant/chat'
import type { CartInput } from '@/server/assistant/tools'
import { kickJobs } from '@/server/jobs/runner'
import { leads } from '@/server/leads'
import { errText, log } from '@/server/log'
import { clientIp, rateLimit } from '@/server/rate-limit'
import { ensureStoreSettings } from '@/server/store-settings'

export const runtime = 'nodejs'
export const maxDuration = 60

const BUSY = { error: 'RATE_LIMIT', message: 'Ai trimis multe mesaje într-un timp scurt. Încearcă din nou peste câteva minute.' }

/** The website assistant (components/assistant): one streamed answer per visitor message. */
export async function POST(req: NextRequest) {
  if (!(await assistantEnabled())) return NextResponse.json({ error: 'UNAVAILABLE' }, { status: 404 })
  const ip = clientIp(req.headers)
  if (!rateLimit(`assistant:${ip}`, 20, 5 * 60_000) || !rateLimit(`assistant-day:${ip}`, 200, 24 * 3600_000)) return NextResponse.json(BUSY, { status: 429 })
  const raw = await req.text()
  if (raw.length > 120_000) return NextResponse.json({ error: 'TOO_LARGE' }, { status: 413 })
  let body: Record<string, unknown>
  try {
    body = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'BAD_REQUEST' }, { status: 400 })
  }
  const messages = cleanMessages(body.messages)
  if (!messages) return NextResponse.json({ error: 'BAD_REQUEST' }, { status: 400 })
  const cart: CartInput = (Array.isArray(body.cart) ? body.cart : []).slice(0, 20).flatMap((l: unknown) => {
    const x = l as Record<string, unknown> | null
    if (!x || typeof x.productId !== 'string') return []
    return [{ productId: x.productId.slice(0, 60), variantId: typeof x.variantId === 'string' ? x.variantId.slice(0, 60) : undefined, quantity: Math.min(10, Math.max(1, Math.floor(Number(x.quantity) || 1))) }]
  })
  try {
    const c = getConfig()
    const db = await getDb()
    await ensureStoreSettings()
    // Locked: the price-gated host, the gate on, and no lead behind this browser's gate cookie.
    const gated = isGatedHost(req.headers.get('host')) && c.features.priceGate
    const locked = gated && !(await leads.byId(db, cookieFrom(req.headers.get('cookie'), GATE_COOKIE) ?? ''))
    const locale: 'ro' | 'en' = body.locale === 'en' ? 'en' : 'ro'
    const page = typeof body.page === 'string' && /^\/[\w\-/.]{0,150}$/.test(body.page) ? body.page : '/'
    return await assistantTurn({
      db,
      config: c,
      context: {
        locked,
        gated,
        locale,
        // Romanian pages are in lei; English pages in euro unless the visitor picked dollars (same rule as the checkout).
        currency: locale === 'ro' ? 'RON' : body.currency === 'USD' ? 'USD' : 'EUR',
        intl: isIntlHost(req.headers.get('host')),
        page,
        siteUrl: isIntlHost(req.headers.get('host')) ? siteOrigin('net', c.siteUrl) : c.siteUrl,
      },
      messages,
      cart,
      onQueued: kickJobs,
    })
  } catch (e) {
    log.error('assistant.failed', { error: errText(e) })
    return NextResponse.json({ error: 'SERVER', message: 'Asistentul nu este disponibil acum. Ne poți scrie la contact.' }, { status: 503 })
  }
}
