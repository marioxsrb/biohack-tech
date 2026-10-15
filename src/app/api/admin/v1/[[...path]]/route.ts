import { isChatSound } from '@/lib/chat-sounds'
import { timingSafeEqual } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { NextResponse, type NextRequest } from 'next/server'
import { ADMIN_COOKIE, checkAdminSession } from '@/lib/admin-auth'
import { products } from '@/content/catalog'
import { adminKeys, type KeyScope } from '@/server/admin-keys'
import { cancelScheduledCalls, disableCalling, retryCall } from '@/server/calling/admin'
import { calls } from '@/server/calling/calls'
import { callBlocklist } from '@/server/calling/blocklist'
import { placeTestCall, testCalls } from '@/server/calling/test-call'
import { getConfig } from '@/server/config'
import { getDb, type Queryable } from '@/server/db'
import { enquiries } from '@/server/enquiries'
import { courier } from '@/server/fulfillment/courier'
import { kickJobs } from '@/server/jobs/runner'
import { leads } from '@/server/leads'
import { errText, log } from '@/server/log'
import { isQueue, orders } from '@/server/orders/repository'
import { cancelOrder, confirmPayment, markDelivered, markProcessing, markReturnReceived, markReturnRequested, markShipped, recordRefund } from '@/server/orders/service'
import { CODE_RE, normalizeCode, promoCodes } from '@/server/promo'
import { rateLimit } from '@/server/rate-limit'
import { buildReport, period, reportMarkdown } from '@/server/report'
import { buildSeries, parseSeriesQuery } from '@/server/series'
import { charts } from '@/server/charts'
import { audit, ensureStoreSettings, priceTable, readStoreSettings, saveStoreSettings, type StoreSettings } from '@/server/store-settings'

export const runtime = 'nodejs'

type Who = { actor: string; scope: KeyScope }
type Ctx = { params: Promise<{ path?: string[] }> }
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
const bad = (message: string, status = 422) => json({ error: message }, status)

function same(a: string, b: string) {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

/** An API key (full or read), the read-only report token, or a signed-in admin (full). */
async function who(req: NextRequest, db: Queryable): Promise<Who | null> {
  const bearer = req.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1]?.trim()
  if (bearer) {
    const key = await adminKeys.verify(db, bearer)
    if (key) return { actor: `api:${key.name}`, scope: key.scope }
    const report = process.env.ADMIN_API_TOKEN ?? ''
    if (report.length >= 32 && same(bearer, report)) return { actor: 'api:report-token', scope: 'read' }
    return null
  }
  if ((await checkAdminSession(req.cookies.get(ADMIN_COOKIE)?.value)) === 'ok') return { actor: `admin:${process.env.ADMIN_USER || 'admin'}`, scope: 'full' }
  return null
}

const lei = (v: unknown) => {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null
}

/** The whole admin as an API: see GET /api/admin/v1 for the list. */
async function handle(req: NextRequest, ctx: Ctx, method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE') {
  if (!rateLimit('admin-api', 600, 60_000)) return bad('rate limit', 429)
  const db = await getDb()
  const w = await who(req, db)
  if (!w) return bad('unauthorized', 401)
  if (method !== 'GET' && w.scope !== 'full') return bad('this key is read-only', 403)
  await ensureStoreSettings(0)
  const [resource = '', id = '', action = ''] = (await ctx.params).path ?? []
  const sp = req.nextUrl.searchParams
  let body: Record<string, unknown> = {}
  if (method !== 'GET') {
    try {
      const raw = await req.text()
      body = raw ? JSON.parse(raw) : {}
    } catch {
      return bad('body must be JSON', 400)
    }
  }
  const changed = async (what: string, details: Record<string, unknown>, result: unknown) => {
    await audit(db, w.actor, what, details)
    kickJobs()
    log.info('admin.api', { actor: w.actor, what })
    return json(result)
  }

  try {
    // ── index ──
    if (!resource && method === 'GET') return json(INDEX)

    // ── report ──
    if (resource === 'report' && method === 'GET') {
      const r = await buildReport(db, period(sp.get('perioada') ?? sp.get('period') ?? undefined))
      return sp.get('format') === 'md' ? new NextResponse(reportMarkdown(r), { headers: { 'Content-Type': 'text/markdown; charset=utf-8', 'Cache-Control': 'no-store' } }) : json(r)
    }

    // ── orders ──
    if (resource === 'orders') {
      if (method === 'GET' && !id) {
        const queue = sp.get('queue') ?? ''
        return json(await orders.list(db, { limit: Math.min(Number(sp.get('limit')) || 50, 200), search: sp.get('q') || undefined, queue: isQueue(queue) ? queue : undefined }))
      }
      if (method === 'GET' && id && !action) {
        const o = await orders.byId(db, id)
        return o ? json({ order: o, events: await orders.events(db, id) }) : bad('order not found', 404)
      }
      if (method === 'POST' && id && action) {
        const confirm = body.confirm === true
        let r: { changed: boolean }
        switch (action) {
          case 'processing':
            r = await markProcessing(id, 'admin')
            break
          case 'shipped': {
            const courierName = String(body.courier ?? '').trim().slice(0, 60)
            const trackingNumber = String(body.trackingNumber ?? '').trim().slice(0, 80)
            if (!courierName || !trackingNumber) return bad('courier and trackingNumber are required')
            const url = String(body.trackingUrl ?? '')
            r = await markShipped(id, 'admin', { courier: courierName, trackingNumber, trackingUrl: /^https:\/\//.test(url) ? url : courier().trackingUrl(courierName, trackingNumber) })
            break
          }
          case 'delivered':
            r = await markDelivered(id, 'admin')
            break
          case 'return-requested':
            r = await markReturnRequested(id, 'admin', 'echipa')
            break
          case 'return-received':
            r = await markReturnReceived(id, 'admin')
            break
          case 'transfer-paid':
            if (!confirm) return bad('confirm: true is required (money)')
            r = await confirmPayment(id, 'admin')
            break
          case 'cod-collected': {
            const amount = lei(body.amountLei)
            const reference = String(body.reference ?? '').trim().slice(0, 120)
            if (!confirm || !amount || reference.length < 3) return bad('confirm: true, amountLei (the exact amount) and reference are required')
            r = await confirmPayment(id, 'admin', { amountMinor: amount, currency: 'RON', reference })
            break
          }
          case 'cancel':
            if (!confirm) return bad('confirm: true is required')
            r = await cancelOrder(id, 'admin', String(body.reason ?? '').trim().slice(0, 300) || 'anulată de echipă')
            break
          case 'refund': {
            const amount = lei(body.amountLei)
            if (!confirm || !amount) return bad('confirm: true and amountLei are required (records a bank refund)')
            r = await recordRefund(id, 'admin', amount)
            break
          }
          default:
            return bad(`unknown action ${action}`, 404)
        }
        return changed(`order.${action}`, { orderId: id, body: { ...body } }, { ok: true, changed: r.changed, order: await orders.byId(db, id) })
      }
    }

    // ── leads and AI calls ──
    if (resource === 'leads') {
      if (method === 'GET' && !id) {
        const view = sp.get('view')
        const funnel = sp.get('funnel')
        const list = await leads.list(db, { view: view === 'abandoned' || view === 'converted' ? view : undefined, funnel: funnel === 'visible_price' || funnel === 'gated_price' ? funnel : undefined, limit: Math.min(Number(sp.get('limit')) || 100, 500) })
        return json(list)
      }
      if (method === 'GET' && id && !action) {
        const lead = await leads.byId(db, id)
        return lead ? json({ lead, calls: await calls.forLeads(db, [id]) }) : bad('lead not found', 404)
      }
      if (method === 'POST' && id && ['call-retry', 'call-disable', 'call-cancel'].includes(action)) {
        const result =
          action === 'call-retry' ? await retryCall(db, getConfig(), id) : action === 'call-cancel' ? `${await cancelScheduledCalls(db, id)} cancelled` : (await disableCalling(db, id), 'disabled')
        return changed(`lead.${action}`, { leadId: id }, { ok: true, result })
      }
    }

    // ── promo codes ──
    if (resource === 'codes') {
      if (method === 'GET') return json(await promoCodes.list(db))
      if (method === 'POST' && !id) {
        const code = normalizeCode(body.code)
        if (!CODE_RE.test(code)) return bad('code: 3–32 letters, digits, - or _')
        const kind = body.kind === 'fixed' ? 'fixed' : 'percent'
        const value = kind === 'percent' ? Math.round(Number(body.value)) : lei(body.value)
        if (!value || value <= 0 || (kind === 'percent' && value > 90)) return bad('value: 1–90 (percent) or lei above 0 (fixed)')
        const list = Array.isArray(body.products) ? body.products.filter((p): p is string => typeof p === 'string' && products.some((x) => x.id === p)) : []
        const date = (v: unknown) => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? new Date(v) : null)
        const ok = await promoCodes.create(db, {
          code,
          kind,
          value,
          products: list.length ? list : null,
          minOrderMinor: lei(body.minOrderLei) ?? 0,
          startsAt: date(body.startsAt),
          endsAt: date(body.endsAt),
          maxUses: Number.isInteger(body.maxUses) && (body.maxUses as number) > 0 ? (body.maxUses as number) : null,
          oncePerEmail: body.oncePerEmail === true,
          note: typeof body.note === 'string' ? body.note.slice(0, 200) : null,
        })
        if (!ok) return bad(`code ${code} exists`, 409)
        return changed('code.create', { code }, { ok: true, code: await promoCodes.get(db, code) })
      }
      if (method === 'PATCH' && id) {
        const code = normalizeCode(id)
        if (!(await promoCodes.get(db, code))) return bad('code not found', 404)
        if (typeof body.active !== 'boolean') return bad('active: true | false')
        await promoCodes.setActive(db, code, body.active)
        return changed('code.active', { code, active: body.active }, { ok: true, code: await promoCodes.get(db, code) })
      }
    }

    // ── store settings: prices, stock, popup, AI calls pause ──
    if (resource === 'settings') {
      if (method === 'GET') return json({ settings: await readStoreSettings(db), prices: priceTable() })
      if (method === 'PUT' || method === 'PATCH') {
        const now = await readStoreSettings(db)
        const next: StoreSettings = method === 'PUT' ? { ...now, ...(body as Partial<StoreSettings>) } : mergePatch(now, body)
        const r = await saveStoreSettings(db, next, w.actor)
        if (!r.ok) return json({ error: 'invalid settings', problems: r.problems }, 422)
        // Every page that shows a price is rendered again with the new numbers.
        revalidatePath('/', 'layout')
        kickJobs()
        return json({ ok: true, settings: next, prices: priceTable() })
      }
    }

    // ── AI calls: do-not-call list and test calls ──
    if (resource === 'blocklist') {
      if (method === 'GET') return json(await callBlocklist.list(db))
      if (method === 'POST') {
        const phone = await callBlocklist.add(db, String(body.phone ?? ''), typeof body.note === 'string' ? body.note : null, w.actor)
        if (!phone) return bad('phone: a Romanian number')
        return changed('call_blocklist.add', { phone }, { ok: true, phone })
      }
      if (method === 'DELETE' && id) return changed('call_blocklist.remove', { phone: id }, { ok: await callBlocklist.remove(db, decodeURIComponent(id)) })
    }
    if (resource === 'test-calls') {
      if (method === 'GET' && !id) return json(await testCalls.recent(db, Math.min(Number(sp.get('limit')) || 20, 100)))
      if (method === 'GET' && id) {
        const t = await testCalls.byId(db, id)
        return t ? json(t) : bad('test call not found', 404)
      }
      if (method === 'POST') {
        if (body.consent !== true) return bad('consent: true is required (the person agreed to the test call)')
        const items = Array.isArray(body.items) ? (body.items as { productId?: unknown; variantId?: unknown; quantity?: unknown }[]).map((i) => ({ productId: String(i.productId ?? ''), variantId: typeof i.variantId === 'string' ? i.variantId : undefined, quantity: Math.min(10, Math.max(1, Math.round(Number(i.quantity) || 1))) })) : []
        const r = await placeTestCall(db, getConfig(), { phone: String(body.phone ?? ''), firstName: String(body.firstName ?? '').slice(0, 40), scenario: body.scenario === 'price_reveal' ? 'price_reveal' : 'cart', funnel: body.funnel === 'gated_price' ? 'gated_price' : 'visible_price', items, emailSent: body.emailSent !== false }, w.actor)
        if (!r.ok) return bad(r.message)
        return changed('test_call.place', { id: r.call.id, phone: r.call.phone }, { ok: true, call: r.call })
      }
    }

    // ── custom charts: data and the saved list ──
    if (resource === 'series' && method === 'GET') return json(await buildSeries(db, parseSeriesQuery(Object.fromEntries(sp))))
    if (resource === 'charts') {
      if (method === 'GET') return json(await charts.list(db))
      if (method === 'POST') return changed('chart.add', { title: body.title }, { ok: true, chart: await charts.add(db, String(body.title ?? ''), body) })
      if (method === 'DELETE' && id) return changed('chart.remove', { id }, { ok: await charts.remove(db, id) })
    }

    // ── messages, audit ──
    if (resource === 'messages' && method === 'GET') return json(await enquiries.list(undefined, Math.min(Number(sp.get('limit')) || 100, 500)))
    if (resource === 'audit' && method === 'GET') {
      const { rows } = await db.query('select at, actor, action, details from admin_audit order by at desc limit $1', [Math.min(Number(sp.get('limit')) || 100, 500)])
      return json(rows)
    }

    return bad('not found', 404)
  } catch (e) {
    log.error('admin.api_failed', { resource, action, error: errText(e) })
    return bad('server error', 500)
  }
}

/** PATCH /settings: { prices: { "balance-wave": 638000 | null (back to the code's price) }, soldOut: [...], welcomePopup, callsPaused, assistant }. */
function mergePatch(now: StoreSettings, body: Record<string, unknown>): StoreSettings {
  const prices = { ...now.prices }
  if (body.prices && typeof body.prices === 'object')
    for (const [k, v] of Object.entries(body.prices as Record<string, unknown>)) {
      if (v === null) delete prices[k]
      else prices[k] = v as StoreSettings['prices'][string]
    }
  return {
    prices,
    soldOut: Array.isArray(body.soldOut) ? (body.soldOut as string[]) : now.soldOut,
    welcomePopup: typeof body.welcomePopup === 'boolean' ? body.welcomePopup : now.welcomePopup,
    callsPaused: typeof body.callsPaused === 'boolean' ? body.callsPaused : now.callsPaused,
    assistant: typeof body.assistant === 'boolean' ? body.assistant : now.assistant,
    chatSound: isChatSound(body.chatSound) ? body.chatSound : now.chatSound,
    fx: now.fx,
  }
}

const INDEX = {
  name: 'Biohack Tech admin API v1',
  auth: 'Authorization: Bearer <key from /admin/setari>. Read keys: GET only. Amounts in lei unless named *Minor (bani).',
  endpoints: [
    'GET  /api/admin/v1/report?perioada=ieri|azi|7|30|AAAA-LL-ZZ&format=md',
    'GET  /api/admin/v1/orders?q=&queue=&limit=',
    'GET  /api/admin/v1/orders/{id}',
    'POST /api/admin/v1/orders/{id}/processing | delivered | return-requested | return-received',
    'POST /api/admin/v1/orders/{id}/shipped {courier, trackingNumber, trackingUrl?}',
    'POST /api/admin/v1/orders/{id}/transfer-paid {confirm: true}',
    'POST /api/admin/v1/orders/{id}/cod-collected {confirm: true, amountLei, reference}',
    'POST /api/admin/v1/orders/{id}/cancel {confirm: true, reason}',
    'POST /api/admin/v1/orders/{id}/refund {confirm: true, amountLei}',
    'GET  /api/admin/v1/leads?view=abandoned|converted&funnel=&limit=',
    'GET  /api/admin/v1/leads/{id}',
    'POST /api/admin/v1/leads/{id}/call-retry | call-cancel | call-disable',
    'GET  /api/admin/v1/codes',
    'POST /api/admin/v1/codes {code, kind: percent|fixed, value, products?, minOrderLei?, startsAt?, endsAt?, maxUses?, oncePerEmail?, note?}',
    'PATCH /api/admin/v1/codes/{code} {active}',
    'GET  /api/admin/v1/settings',
    'PATCH /api/admin/v1/settings {prices?: {productId: bani | {variantId: bani} | null}, soldOut?: [productId], welcomePopup?, callsPaused?, assistant?}',
    'GET  /api/admin/v1/blocklist · POST {phone, note?} · DELETE /blocklist/{phone}',
    'GET  /api/admin/v1/test-calls · GET /test-calls/{id} · POST {consent: true, phone, firstName, scenario: cart|price_reveal, funnel?, items: [{productId, variantId?, quantity}], emailSent?}',
    'GET  /api/admin/v1/series?metric=sessions|views|leads|orders|revenue|units|aov|conversion|calls|welcome|codes&by=none|site|funnel|source|payment|product|outcome|code&days=7|14|30|60|90|180|365&grain=day|week',
    'GET  /api/admin/v1/charts · POST {title, metric, by, days, grain, kind: line|bar} · DELETE /charts/{id}',
    'GET  /api/admin/v1/messages',
    'GET  /api/admin/v1/audit',
  ],
}

export const GET = (req: NextRequest, ctx: Ctx) => handle(req, ctx, 'GET')
export const POST = (req: NextRequest, ctx: Ctx) => handle(req, ctx, 'POST')
export const PUT = (req: NextRequest, ctx: Ctx) => handle(req, ctx, 'PUT')
export const PATCH = (req: NextRequest, ctx: Ctx) => handle(req, ctx, 'PATCH')
export const DELETE = (req: NextRequest, ctx: Ctx) => handle(req, ctx, 'DELETE')
