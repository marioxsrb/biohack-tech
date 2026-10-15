import { randomUUID } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { getProduct } from '@/content/catalog'
import { sanitizeAttribution } from '@/lib/attribution'
import { cookieFrom, funnelForHost, GATE_COOKIE, GATE_DAYS, normalizeContact, validateContact, VISITOR_COOKIE } from '@/lib/lead'
import { getConfig } from '@/server/config'
import { getDb } from '@/server/db'
import { kickJobs } from '@/server/jobs/runner'
import { CART_INTEREST, captureLead, leads, recordGatedCart, sanitizeCart } from '@/server/leads'
import { errText, log } from '@/server/log'
import { clientIp, rateLimit } from '@/server/rate-limit'
import { deviceKey } from '@/server/device'
import { ensureStoreSettings } from '@/server/store-settings'

export const runtime = 'nodejs'

const MAX_BODY = 8_000
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

/**
 * Leads, three ways:
 *   reveal    the price-gated funnel's form (name, email, phone): stores the lead and unlocks prices on this device
 *   interest  an unlocked visitor opens another product: a lead for it, with the contact already given (no PII sent)
 *   checkout  the checkout's contact step (both funnels): what the visitor typed so far, once it identifies them
 * The funnel comes from the hostname, never from the request. Every write is an upsert keyed by
 * (visitor, funnel, product): refreshing or submitting twice changes one row.
 */
export async function POST(req: NextRequest) {
  // Prices and stock as the admin set them (server/store-settings.ts), before anything is priced.
  await ensureStoreSettings()
  const c = getConfig()
  const host = req.headers.get('host')
  const funnel = funnelForHost(host)
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
  // Like an order's: the funnel comes from the hostname, the rest is validated.
  const attribution = { ...(sanitizeAttribution(body.attribution, new URL(c.siteUrl).host) ?? {}), funnel }
  const product = typeof body.productId === 'string' ? getProduct(body.productId) : undefined
  const variantId = product?.variants?.some((v) => v.id === body.variantId) ? (body.variantId as string) : null

  try {
    const db = await getDb()
    if (action === 'reveal' || action === 'interest') {
      if (funnel !== 'gated_price' || !c.features.priceGate) return NextResponse.json({ error: 'UNAVAILABLE' }, { status: 404 })
      // The form may come from a page without a product (the home page): a lead without a product interest.
      if (!product && (action === 'interest' || (typeof body.productId === 'string' && body.productId))) return NextResponse.json({ error: 'BAD_PRODUCT' }, { status: 400 })
      let contact = normalizeContact(body)
      let consent = body.marketingConsent === true
      // The separate AI calling box: only from the form itself, never copied or implied.
      let callConsent = body.callConsent === true
      if (action === 'interest') {
        // Only for a device that already gave its details: the contact is copied from that lead.
        const from = await leads.byId(db, cookieFrom(req.headers.get('cookie'), GATE_COOKIE) ?? '')
        if (!from || from.visitorId !== visitorId) return NextResponse.json({ error: 'LOCKED' }, { status: 403 })
        contact = { name: from.name ?? '', email: from.email, phone: from.phone ?? '' }
        consent = false
        callConsent = false
      } else {
        const fields: Record<string, string> = { ...validateContact(contact) }
        // The terms are required on the price form (the communications box stays optional and separate).
        if (body.termsAccepted !== true) fields.terms = 'Bifează acceptarea Termenilor și Condițiilor.'
        if (Object.keys(fields).length) return NextResponse.json({ error: 'INVALID', fields }, { status: 422 })
        if (!rateLimit(`lead-email:${contact.email}`, 10, 60 * 60_000)) return NextResponse.json({ error: 'RATE_LIMIT' }, { status: 429 })
      }
      const device = action === 'reveal' ? deviceKey(body.device, clientIp(req.headers)) : null
      const r = await db.tx((t) =>
        captureLead(t, {
          visitorId,
          funnel,
          stage: 'lead',
          productId: product?.id ?? '',
          variantId,
          contact,
          marketingConsent: consent,
          callConsent,
          attribution,
          landingHost: host,
          page: typeof body.page === 'string' ? body.page.slice(0, 80) : undefined,
          termsAccepted: action === 'reveal' && body.termsAccepted === true,
          deviceKey: device,
        }),
      )
      kickJobs()
      log.info('lead.captured', { leadId: r.lead.id, funnel, action, created: r.created, product: product?.id ?? null })
      const res = NextResponse.json({ ok: true, leadId: r.lead.id, created: r.created })
      return withCookies(res, visitorId, action === 'reveal' ? r.lead.id : undefined, c.siteUrl.startsWith('https://'))
    }
    if (action === 'recognize') {
      // A device that already gave its details: by the id it kept, its device key, or the email typed again.
      // Nothing is recorded; prices are public on the main site, so a wrong match only shows a price.
      if (funnel !== 'gated_price' || !c.features.priceGate) return NextResponse.json({ error: 'UNAVAILABLE' }, { status: 404 })
      const email = typeof body.email === 'string' ? normalizeContact({ email: body.email }).email : ''
      if (email && validateContact({ name: '', email, phone: '' }, ['email']).email) return NextResponse.json({ error: 'INVALID', fields: { email: 'Verifică adresa de email.' } }, { status: 422 })
      if (email && !rateLimit(`lead-recognize:${clientIp(req.headers)}`, 10, 60 * 60_000)) return NextResponse.json({ error: 'RATE_LIMIT' }, { status: 429 })
      const found = await leads.recognize(db, { id: typeof body.saved === 'string' ? body.saved : undefined, deviceKey: deviceKey(body.device, clientIp(req.headers)), email: email || undefined }, GATE_DAYS)
      log.info('lead.recognize', { found: !!found, by: email ? 'email' : 'device' })
      if (!found) return NextResponse.json({ ok: true, unlocked: false })
      return withCookies(NextResponse.json({ ok: true, unlocked: true, leadId: found.id }), visitorId, found.id, c.siteUrl.startsWith('https://'))
    }
    if (action === 'cart') {
      // acces: an unlocked device changed its cart. Its price-form lead (the one with the contact and the
      // consents) records the cart and the activity; an AI call about the cart may follow after its quiet time.
      if (funnel !== 'gated_price' || !c.features.priceGate) return NextResponse.json({ error: 'UNAVAILABLE' }, { status: 404 })
      const from = await leads.byId(db, cookieFrom(req.headers.get('cookie'), GATE_COOKIE) ?? '')
      if (!from || from.visitorId !== visitorId) return NextResponse.json({ error: 'LOCKED' }, { status: 403 })
      await db.tx((t) => recordGatedCart(t, from, sanitizeCart(body.cart)))
      kickJobs()
      return NextResponse.json({ ok: true })
    }
    if (action === 'checkout') {
      if (!c.features.abandonedCheckout) return NextResponse.json({ ok: true, skipped: 'off' })
      const contact = normalizeContact(body)
      // Enough to identify someone: a valid email, plus a name or a phone. Partial typing is not a lead.
      const fields = validateContact(contact, ['email'])
      if (Object.keys(fields).length || (!contact.name && !contact.phone) || (contact.phone && fields.phone)) return NextResponse.json({ ok: true, skipped: 'incomplete' })
      const cart = sanitizeCart(body.cart)
      if (!cart.length) return NextResponse.json({ ok: true, skipped: 'empty cart' })
      const r = await db.tx((t) =>
        captureLead(t, { visitorId, funnel, stage: 'checkout_started', productId: CART_INTEREST, contact, marketingConsent: body.marketingConsent === true, callConsent: body.callConsent === true, cart, attribution, landingHost: host, page: '/checkout' }),
      )
      kickJobs()
      return withCookies(NextResponse.json({ ok: true, leadId: r.lead.id }), visitorId, undefined, c.siteUrl.startsWith('https://'))
    }
    return NextResponse.json({ error: 'BAD_REQUEST' }, { status: 400 })
  } catch (e) {
    log.error('lead.failed', { action: String(action), error: errText(e) })
    return NextResponse.json({ error: 'SERVER', message: 'Nu am putut salva datele. Încearcă din nou.' }, { status: 500 })
  }
}

/** The visitor id (dedupes this browser's leads) and, after the form, the unlocked state. First-party only. */
function withCookies(res: NextResponse, visitorId: string, gateLeadId: string | undefined, secure: boolean) {
  const opts = { path: '/', sameSite: 'lax' as const, secure, maxAge: GATE_DAYS * 86_400 }
  res.cookies.set(VISITOR_COOKIE, visitorId, { ...opts, httpOnly: true })
  // Readable by the page so it shows prices without asking again; holds only an opaque id.
  if (gateLeadId) res.cookies.set(GATE_COOKIE, gateLeadId, { ...opts, httpOnly: false })
  return res
}
