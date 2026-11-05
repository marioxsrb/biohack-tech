import { NextResponse, type NextRequest } from 'next/server'
import { parseRateTbi } from '@/lib/rate-tbi'
import { getConfig } from '@/server/config'
import { errText, log } from '@/server/log'
import { clientIp, rateLimit } from '@/server/rate-limit'
import { submitRateTbi } from '@/server/rate-tbi'

export const runtime = 'nodejs'

const MAX_BODY = 8_000
const ORIGINS = new Set(['https://biohack-tech.ro', 'https://www.biohack-tech.ro', 'https://t06dig-ta.myshopify.com'])
const PHONE = '0767 978 707'

function cors(req: NextRequest): Record<string, string> {
  const origin = req.headers.get('origin') ?? ''
  return ORIGINS.has(origin)
    ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Max-Age': '600', Vary: 'Origin' }
    : { Vary: 'Origin' }
}

export function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: cors(req) })
}

/**
 * POST /api/rate-tbi: a "Cumpără în rate prin TBI Bank" request from the Shopify store (server/rate-tbi.ts).
 * Spam: a hidden field bots fill in and a minimum time with the form open (a bot gets the same "ok"), at most
 * 5 requests per IP in 10 minutes and 3 per phone or email in 24 hours.
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
    const res = await submitRateTbi(getConfig(), r, { ip: ip === 'unknown' ? null : ip, ua: req.headers.get('user-agent') })
    log.info('rate_tbi.received', { product: r.product, qty: r.qty, value: r.valueLei, hook: res.hook, meta: res.meta })
    return json({ ok: true })
  } catch (e) {
    log.error('rate_tbi.failed', { error: errText(e) })
    return json({ error: 'SERVER', message: `Cererea nu a putut fi trimisă. Sună-ne la ${PHONE} și te ajutăm imediat.` }, 502)
  }
}
