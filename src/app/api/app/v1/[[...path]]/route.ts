import { NextResponse, type NextRequest } from 'next/server'
import { blockFor } from '@/server/digital/delivery'
import { entitlements, type Entitlement } from '@/server/digital/entitlements'
import { hasBook } from '@/server/digital/rules'
import { appDevices, appSessions } from '@/server/app/auth'
import { getDb } from '@/server/db'
import { errText, log } from '@/server/log'
import { orders, isAppFilter } from '@/server/orders/repository'
import type { Order } from '@/server/orders/model'
import { clientIp, rateLimit, rateLimited } from '@/server/rate-limit'
import { buildReport, lifetimeTotals, period } from '@/server/report'
import { isBulk } from '@/config/promotions'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * The API of the private iOS app "BiohackTech Sales". Every call except the login needs `Authorization: Bearer
 * <session token>` from a login with the web admin's password (user name "admin"; server/app/auth.ts). Orders and statistics are READ-ONLY:
 * no route here changes an order, a payment, an invoice or a setting. The only writes are the caller's own session
 * (login, logout) and own iPhone (push token, notification preferences). Numbers come from the same report as the
 * admin dashboard (server/report.ts); an unpaid order is never counted as collected money.
 *
 *   POST   auth/login          { username: "admin", password } → { token, user }
 *   POST   auth/logout
 *   GET    me                  the account and its iPhones
 *   GET    summary?period=     home: totals, collected vs. to collect, trend, best sellers, latest orders
 *   GET    orders?filter=&before=&limit=   all|new|paid|unpaid|shipped|delivered|cancelled|refunded
 *   GET    orders/<id>         one order, with its history
 *   GET    stats?period=       the admin report (funnels, payment methods, products, sites, daily)
 *   POST   devices             { token, environment, name?, prefs? } register this iPhone for notifications
 *   PATCH  devices/<id>        { prefs } this iPhone's notification preferences
 *   DELETE devices/<id>        stop notifications on this iPhone
 */
type Ctx = { params: Promise<{ path?: string[] }> }

const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } })
const bad = (error: string, status: number) => json({ error }, status)
const MAX_BODY = 8_000

async function body(req: NextRequest): Promise<Record<string, unknown> | null> {
  const raw = await req.text()
  if (raw.length > MAX_BODY) return null
  try {
    const v = raw ? JSON.parse(raw) : {}
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
  } catch {
    return null
  }
}

const iso = (d: Date | null) => (d ? d.toISOString() : null)
const PAID = new Set(['paid', 'partially_refunded'])

/** An order in a list: enough for the row, nothing about the address. */
function row(o: Order) {
  return {
    id: o.id,
    number: o.orderNumber,
    createdAt: iso(o.createdAt),
    customer: [o.customer.firstName, o.customer.lastName].filter(Boolean).join(' ') || o.customer.company || '',
    total: o.totalMinor / 100,
    currency: o.currency,
    totalLei: Math.round(o.totalMinor * o.fxRate) / 100,
    paymentMethod: o.paymentMethod,
    paymentStatus: o.paymentStatus,
    status: o.status,
    paid: PAID.has(o.paymentStatus),
    kind: o.kind,
    site: o.site,
    items: o.items.map((i) => `${i.quantity} × ${i.productName}${i.variantName ? ` (${i.variantName})` : ''}`).join(', '),
    // Additive (older app builds ignore them): a business order (40% offer) and the team's phone confirmation.
    bulk: isBulk(o.promotions),
    teamConfirmation: o.teamConfirmation,
  }
}

/** One order, read-only: lines, money, customer, addresses, payment, invoice, shipping and its history. */
/**
 * The book's PDF (orders with Diana L. Palotaș's book only; null otherwise): access active, waiting for payment or
 * delivery, blocked or revoked; the email and the downloads. Additive: older app builds ignore it.
 */
function digitalOf(o: Order, e: Entitlement | null) {
  if (!hasBook(o)) return null
  const block = blockFor(o, e)
  const status = e?.status === 'revoked' ? 'revoked' : !block && e ? 'active' : block && (block.reason === 'not_paid' || block.reason === 'awaiting_delivery') ? 'waiting' : block ? 'blocked' : 'pending'
  return { status, reason: block?.text ?? null, emailStatus: e?.emailStatus ?? 'none', emailSentAt: iso(e?.emailSentAt ?? null), downloads: e?.downloads ?? 0 }
}

function detail(o: Order, events: { type: string; source: string; created_at: string }[], e: Entitlement | null = null) {
  return {
    ...row(o),
    subtotal: o.subtotalMinor / 100,
    discount: o.discountMinor / 100,
    shipping: o.shippingMinor / 100,
    refunded: o.refundedMinor / 100,
    promotions: o.promotions.map((p) => ({ label: p.label, amount: p.amountMinor / 100 })),
    promoCode: o.promoCode,
    lines: o.items.map((i) => ({
      product: i.productName,
      variant: i.variantName,
      sku: i.sku,
      quantity: i.quantity,
      unitPrice: i.unitPriceMinor / 100,
      lineTotal: i.lineTotalMinor / 100,
      discount: i.discountMinor / 100,
    })),
    contact: { email: o.email, phone: o.phone, buyerType: o.customer.buyerType, company: o.customer.company ?? null, cui: o.customer.cui ?? null },
    shippingAddress: o.shippingAddress,
    billingAddress: o.billingAddress,
    notes: o.notes || null,
    paidAt: iso(o.paidAt),
    codReference: o.codReference,
    invoice: { status: o.invoiceStatus, number: o.fgoInvoiceNumber ? `${o.fgoInvoiceSeries ?? ''} ${o.fgoInvoiceNumber}`.trim() : null, storno: o.fgoStornoNumber },
    shipment: { courier: o.courier, awb: o.trackingNumber, trackingUrl: o.trackingUrl, shippedAt: iso(o.shippedAt), deliveredAt: iso(o.deliveredAt) },
    cancelledAt: iso(o.cancelledAt),
    cancelReason: o.cancelReason,
    returnStatus: o.returnStatus,
    source: o.attribution?.utm?.utm_source ?? null,
    funnel: o.attribution?.funnel ?? null,
    history: events.map((e) => ({ type: e.type, source: e.source, at: new Date(e.created_at).toISOString() })),
    digital: digitalOf(o, e),
  }
}

async function handle(req: NextRequest, ctx: Ctx, method: 'GET' | 'POST' | 'PATCH' | 'DELETE') {
  const [a = '', b = ''] = (await ctx.params).path ?? []
  const ip = clientIp(req.headers)
  const db = await getDb()
  try {
    if (a === 'auth' && b === 'login' && method === 'POST') {
      if (!rateLimit(`app-login:${ip}`, 10, 15 * 60_000)) return bad('too many attempts', 429)
      const x = await body(req)
      const username = typeof x?.username === 'string' ? x.username.slice(0, 64) : ''
      const password = typeof x?.password === 'string' ? x.password.slice(0, 200) : ''
      if (!username || !password) return bad('username and password required', 400)
      // One account, so one budget of wrong passwords for it across every address: spread-out guessing stops too.
      if (rateLimited('app-login-admin-failed', 30)) return bad('too many attempts', 429)
      const r = await appSessions.login(db, username, password, req.headers.get('user-agent'))
      if (!r) rateLimit('app-login-admin-failed', 30, 60 * 60_000)
      log.info('app.login', { ok: !!r })
      if (!r) return bad('invalid credentials', 401)
      return json({ token: r.token, user: { id: r.user.id, name: r.user.name, email: r.user.email } })
    }

    if (!rateLimit(`app-ip:${ip}`, 300, 60_000)) return bad('rate limit', 429)
    const auth = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''
    const s = await appSessions.verify(db, auth)
    if (!s) return bad('unauthorized', 401)
    const user = s.user

    if (a === 'auth' && b === 'logout' && method === 'POST') {
      await appSessions.revoke(db, s.sessionId)
      return json({ ok: true })
    }
    if (a === 'me' && method === 'GET') return json({ user: { id: user.id, name: user.name, email: user.email }, devices: await appDevices.forUser(db, user.id) })

    if (a === 'summary' && method === 'GET') {
      const p = period(req.nextUrl.searchParams.get('period') ?? 'azi')
      const [r, lifetime] = await Promise.all([buildReport(db, p), lifetimeTotals(db)])
      return json({
        period: r.period,
        lifetime,
        totals: r.totals,
        previous: r.previous,
        changePct: r.changePct,
        products: r.products,
        daily: r.daily,
        recent: (await orders.page(db, 'all', { limit: 8 })).map(row),
      })
    }

    if (a === 'orders' && method === 'GET') {
      if (b) {
        const o = await orders.byId(db, b)
        if (!o) return bad('not found', 404)
        return json(detail(o, await orders.events(db, o.id), await entitlements.byOrder(db, o.id)))
      }
      const sp = req.nextUrl.searchParams
      const f = sp.get('filter') ?? 'all'
      if (!isAppFilter(f)) return bad('unknown filter', 400)
      const before = sp.get('before') ? new Date(sp.get('before')!) : undefined
      if (before && Number.isNaN(before.getTime())) return bad('bad cursor', 400)
      const list = await orders.page(db, f, { before, limit: Number(sp.get('limit')) || 30 })
      return json({ orders: list.map(row), next: list.length ? iso(list[list.length - 1].createdAt) : null })
    }

    if (a === 'stats' && method === 'GET') {
      const r = await buildReport(db, period(req.nextUrl.searchParams.get('period') ?? '30'))
      return json({ period: r.period, totals: r.totals, previous: r.previous, changePct: r.changePct, funnels: r.funnels, payments: r.payments, products: r.products, sites: r.sites, sources: r.sources, daily: r.daily, codes: r.codes })
    }

    if (a === 'devices') {
      if (method === 'POST' && !b) {
        const x = await body(req)
        if (!x) return bad('body must be JSON', 400)
        const d = await appDevices.register(db, user.id, {
          token: String(x.token ?? ''),
          environment: String(x.environment ?? ''),
          name: typeof x.name === 'string' ? x.name : undefined,
          prefs: (x.prefs as Record<string, boolean>) ?? undefined,
        })
        return d ? json({ id: d.id, prefs: d.prefs }) : bad('invalid device token or environment', 400)
      }
      if (method === 'PATCH' && b) {
        const x = await body(req)
        const prefs = x && typeof x.prefs === 'object' ? (x.prefs as Record<string, boolean>) : null
        if (!prefs) return bad('prefs required', 400)
        const r = await appDevices.setPrefs(db, user.id, b, prefs)
        return r ? json({ prefs: r }) : bad('not found', 404)
      }
      if (method === 'DELETE' && b) {
        await appDevices.remove(db, user.id, b)
        return json({ ok: true })
      }
    }
    // Anything else, in particular any attempt to change an order, does not exist here.
    return bad('not found', 404)
  } catch (e) {
    log.error('app.api_error', { path: `${a}/${b}`, error: errText(e) })
    return bad('server error', 500)
  }
}

export const GET = (req: NextRequest, ctx: Ctx) => handle(req, ctx, 'GET')
export const POST = (req: NextRequest, ctx: Ctx) => handle(req, ctx, 'POST')
export const PATCH = (req: NextRequest, ctx: Ctx) => handle(req, ctx, 'PATCH')
export const DELETE = (req: NextRequest, ctx: Ctx) => handle(req, ctx, 'DELETE')
