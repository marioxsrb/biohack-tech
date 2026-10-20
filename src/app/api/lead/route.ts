import { randomUUID } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { sanitizeAttribution } from '@/lib/attribution'
import { cookieFrom, normalizeContact, validateContact, VISITOR_COOKIE } from '@/lib/lead'
import { getConfig } from '@/server/config'
import { siteForHost } from '@/lib/sites'
import { getDb } from '@/server/db'
import { kickJobs } from '@/server/jobs/runner'
import { CART_INTEREST, captureLead, sanitizeCart } from '@/server/leads'
import { errText, log } from '@/server/log'
import { clientIp, rateLimit } from '@/server/rate-limit'
import { ensureStoreSettings } from '@/server/store-settings'

export const runtime = 'nodejs'

const MAX_BODY = 8_000
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

/**
 * Leads from the checkout's contact step (action "checkout"): what the visitor typed so far, once it identifies
 * them. Every write is an upsert keyed by (visitor, checkout): refreshing or submitting twice changes one row.
 */
export async function POST(req: NextRequest) {
  // Prices and stock as the admin set them (server/store-settings.ts), before anything is priced.
  await ensureStoreSettings()
  const c = getConfig()
  const host = req.headers.get('host')
  if (!rateLimit(`lead:${clientIp(req.headers)}`, 30, 10 * 60_000)) return NextResponse.json({ error: 'RATE_LIMIT', message: 'Prea multe încercări. Încearcă din nou peste câteva minute.' }, { status: 429 })
  const raw = await req.text()
  if (raw.length > MAX_BODY) return NextResponse.json({ error: 'TOO_LARGE' }, { status: 413 })
  let body: Record<string, unknown>
  try {
    body = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'BAD_REQUEST' }, { status: 400 })
  }
  const action = body.action
  const knownVisitor = cookieFrom(req.headers.get('cookie'), VISITOR_COOKIE)
  const visitorId = knownVisitor && UUID.test(knownVisitor) ? knownVisitor : randomUUID()
  const attribution = sanitizeAttribution(body.attribution, new URL(c.siteUrl).host) ?? {}

  try {
    const db = await getDb()
    if (action === 'checkout') {
      if (!c.features.abandonedCheckout) return NextResponse.json({ ok: true, skipped: 'off' })
      const contact = normalizeContact(body)
      // Enough to identify someone: a valid email, plus a name or a phone. Partial typing is not a lead.
      const fields = validateContact(contact, ['email'])
      if (Object.keys(fields).length || (!contact.name && !contact.phone) || (contact.phone && fields.phone)) return NextResponse.json({ ok: true, skipped: 'incomplete' })
      const cart = sanitizeCart(body.cart)
      if (!cart.length) return NextResponse.json({ ok: true, skipped: 'empty cart' })
      const r = await db.tx((t) =>
        captureLead(t, { visitorId, stage: 'checkout_started', productId: CART_INTEREST, contact, marketingConsent: body.marketingConsent === true, callConsent: body.callConsent === true, cart, attribution, landingHost: host, page: '/checkout', locale: body.locale === 'en' ? 'en' : 'ro', site: siteForHost(host) }),
      )
      kickJobs()
      return withCookies(NextResponse.json({ ok: true, leadId: r.lead.id }), visitorId, c.siteUrl.startsWith('https://'))
    }
    return NextResponse.json({ error: 'BAD_REQUEST' }, { status: 400 })
  } catch (e) {
    log.error('lead.failed', { action: String(action), error: errText(e) })
    return NextResponse.json({ error: 'SERVER', message: 'Nu am putut salva datele. Încearcă din nou.' }, { status: 500 })
  }
}

/** The visitor id (dedupes this browser's leads). First-party only. */
function withCookies(res: NextResponse, visitorId: string, secure: boolean) {
  res.cookies.set(VISITOR_COOKIE, visitorId, { path: '/', sameSite: 'lax', secure, maxAge: 90 * 86_400, httpOnly: true })
  return res
}
