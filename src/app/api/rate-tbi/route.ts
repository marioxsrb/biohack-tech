import { createHash } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { parseRateTbi } from '@/lib/rate-tbi'
import { getConfig } from '@/server/config'
import { getDb } from '@/server/db'
import { jobs } from '@/server/jobs/outbox'
import { kickJobs } from '@/server/jobs/runner'
import { errText, log } from '@/server/log'
import { clientIp, rateLimit } from '@/server/rate-limit'
import { valueRateTbi, type RateTbiJob } from '@/server/rate-tbi'
import { registerForRequest } from '@/server/tbi-applications'
import { tbiPriceRules, tbiPriceStatus } from '@/server/tbi-prices'

export const runtime = 'nodejs'

const MAX_BODY = 8_000
const ORIGINS = new Set(['https://biohack-tech.ro', 'https://www.biohack-tech.ro', 'https://t06dig-ta.myshopify.com'])
const PHONE = '0767 978 707'
const REPEAT_WINDOW_MIN = 10

function cors(req: NextRequest): Record<string, string> {
  const origin = req.headers.get('origin') ?? ''
  return ORIGINS.has(origin)
    ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Max-Age': '600', Vary: 'Origin' }
    : { Vary: 'Origin' }
}

/** GET /api/rate-tbi: whether the server can read the store's price rules (no personal data). */
export async function GET() {
  const rules = await tbiPriceRules(getConfig().rateTbi.pricesUrl)
  return NextResponse.json({ ok: !!rules, products: rules ? Object.keys(rules.products) : [], ...tbiPriceStatus() }, { headers: { 'cache-control': 'no-store' } })
}

export function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: cors(req) })
}

/**
 * POST /api/rate-tbi: a "Cumpără în rate prin tbi bank" request from the Shopify store (server/rate-tbi.ts).
 * Spam: a hidden field bots fill in and a minimum time with the form open (a bot gets the same "ok"), at most
 * 5 requests per IP in 10 minutes and 3 per phone or email in 24 hours. The basket is valued on the server.
 * The request is stored as the job "rate_tbi.submit" and sent to GHL right after the answer; the same basket from the
 * same person within 10 minutes is not stored again.
 */
export async function POST(req: NextRequest) {
  const h = cors(req)
  const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: h })
  const ip = clientIp(req.headers)
  if (!rateLimit(`rate-tbi:ip:${ip}`, 5, 10 * 60_000)) return json({ error: 'RATE_LIMIT', message: `Ai trimis deja câteva cereri. Încearcă peste câteva minute sau sună-ne la ${PHONE}.` }, 429)
  const raw = await req.text()
  if (raw.length > MAX_BODY) return json({ error: 'TOO_LARGE' }, 413)
  let body: Record<string, unknown>
  try {
    body = JSON.parse(raw)
  } catch {
    return json({ error: 'BAD_REQUEST', message: 'Cererea nu este validă. Reîncarcă pagina.' }, 400)
  }

  const startedAt = Number(body.startedAt)
  if ((typeof body.website === 'string' && body.website.length > 0) || !Number.isFinite(startedAt) || Date.now() - startedAt < 3000) {
    log.warn('rate_tbi.spam_dropped')
    return json({ ok: true })
  }

  const parsed = parseRateTbi(body)
  if (!parsed.ok) return json({ error: 'INVALID', message: 'Verifică câmpurile marcate.', fields: parsed.fields }, 422)
  const r = parsed.request
  if (!rateLimit(`rate-tbi:phone:${r.phone}`, 3, 24 * 3_600_000) || !rateLimit(`rate-tbi:email:${r.email}`, 3, 24 * 3_600_000)) {
    return json({ error: 'RATE_LIMIT', message: `Am primit deja cererea ta. Te sunăm noi; dacă vrei, scrie-ne la ${PHONE}.` }, 429)
  }

  try {
    const cfg = getConfig()
    const v = await valueRateTbi(cfg, r)
    if (!v) return json({ error: 'PRICE', message: `Nu am putut calcula valoarea comenzii. Reîncarcă pagina sau sună-ne la ${PHONE}.` }, 422)
    const basket = r.items.map((i) => `${i.handle}:${i.qty}`).sort().join(',')
    const key = createHash('sha256').update([r.phone, r.email, basket, r.period, r.advance].join('|')).digest('hex').slice(0, 24)
    const db = await getDb()
    const repeat = await db.query(
      `select 1 from jobs where kind = 'rate_tbi.submit' and dedupe_key like $1 and created_at > now() - interval '${REPEAT_WINDOW_MIN} minutes' limit 1`,
      [`rate-tbi:${key}:%`],
    )
    const monthly = v.rate.monthly
    if (repeat.rows.length) {
      log.info('rate_tbi.repeat_ignored', { items: basket })
      // The same request again: the TBI link already given (same customer, same value, last 10 minutes), not a new one.
      const prev = await db.query<{ url: string }>(
        `select url from tbi_applications where email = $1 and amount = $2 and url is not null and created_at > now() - interval '${REPEAT_WINDOW_MIN} minutes' order by created_at desc limit 1`,
        [r.email, v.total],
      )
      return json({ ok: true, total: v.total, monthly, period: v.period, repeat: true, ...(prev.rows[0] && { tbiUrl: prev.rows[0].url }) })
    }
    // TBI Fusion Pay: the application is registered now, so the customer continues at TBI straight from the form.
    const tbi = await registerForRequest(cfg, db, r, v)
    const payload: RateTbiJob = { request: r, valuation: v, client: { ip: ip === 'unknown' ? null : ip, ua: req.headers.get('user-agent') }, at: new Date().toISOString(), tbi }
    await jobs.enqueue(db, { kind: 'rate_tbi.submit', dedupeKey: `rate-tbi:${key}:${Date.now()}`, payload: payload as unknown as Record<string, unknown> })
    kickJobs()
    log.info('rate_tbi.received', { items: basket, total: v.total, verified: v.verified, period: r.period, advance: r.advance, tbi: tbi ? tbi.orderRef : null })
    return json({ ok: true, total: v.total, monthly, period: v.period, ...(tbi && { tbiUrl: tbi.url }) })
  } catch (e) {
    log.error('rate_tbi.failed', { error: errText(e) })
    return json({ error: 'SERVER', message: `Cererea nu a putut fi trimisă. Sună-ne la ${PHONE} și te ajutăm imediat.` }, 502)
  }
}
