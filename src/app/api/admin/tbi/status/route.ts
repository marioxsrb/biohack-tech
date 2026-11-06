import { timingSafeEqual } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { ADMIN_COOKIE, checkAdminRequest } from '@/lib/admin-auth'
import { getApplicationStatus } from '@/lib/tbi/client'
import { getConfig } from '@/server/config'
import { getDb } from '@/server/db'
import { errText, log } from '@/server/log'
import { clientIp, rateLimit } from '@/server/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } })

const sameSecret = (a: string, b: string) => {
  const x = Buffer.from(a), y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

type Row = { order_ref: string; env: string; created_at: string; updated_at: string; amount: string; tbi_order_id: number | null; token: string | null; status_code: number | null; status_message: string | null; motive: string | null; contract_number: string | null; opportunity_id: string | null; events: unknown[] }

/**
 * GET /api/admin/tbi/status?ref=BTR-… (or the TBI order id): a "Rate TBI" application as we saved it and its status at
 * TBI right now (GetApplicationStatus). Read only: never cancels or refunds. For a signed-in admin, or with
 * `Authorization: Bearer <TBI_ADMIN_SECRET>` (scripts). The answer carries no keys and no TBI token.
 */
export async function GET(req: NextRequest) {
  if (!rateLimit(`admin-tbi:${clientIp(req.headers)}`, 30, 60_000)) return json({ error: 'rate limit' }, 429)
  const secret = process.env.TBI_ADMIN_SECRET?.trim()
  const bearer = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  const bySecret = !!secret && secret.length >= 32 && !!bearer && sameSecret(bearer, secret)
  if (!bySecret && (await checkAdminRequest(req.cookies.get(ADMIN_COOKIE)?.value, req.headers.get('authorization'))) !== 'ok') return json({ error: 'unauthorized' }, 401)
  const ref = (req.nextUrl.searchParams.get('ref') ?? '').trim()
  if (!/^(BTR-\d{8}-[0-9a-f]{6}|\d{1,12})$/.test(ref)) return json({ error: 'ref: BTR-YYYYMMDD-xxxxxx sau id-ul comenzii TBI' }, 400)
  const db = await getDb()
  const row = (await db.query<Row>(/^\d+$/.test(ref) ? 'select * from tbi_applications where tbi_order_id = $1' : 'select * from tbi_applications where order_ref = $1', [ref])).rows[0]
  if (!row) return json({ error: 'not found' }, 404)
  const saved = {
    orderRef: row.order_ref, env: row.env, createdAt: row.created_at, updatedAt: row.updated_at, amount: Number(row.amount), tbiOrderId: row.tbi_order_id,
    statusCode: row.status_code, statusMessage: row.status_message, motive: row.motive, contractNumber: row.contract_number, opportunityId: row.opportunity_id, events: row.events,
  }
  const t = getConfig().tbi
  if (!t || !row.tbi_order_id || !row.token) return json({ saved, tbi: null, note: !t ? 'TBI nu e configurat' : 'cererea nu are id TBI' })
  if (t.env !== row.env) return json({ saved, tbi: null, note: `cererea e din ${row.env}, serverul e pe ${t.env}` })
  try {
    const st = await getApplicationStatus(t, row.tbi_order_id, row.token)
    return json({ saved, tbi: { storeOrderId: st.store_order_id, status: st.status, statusChain: st.status_chain } })
  } catch (e) {
    log.warn('tbi.admin_status_failed', { orderRef: row.order_ref, error: errText(e) })
    return json({ saved, tbi: null, error: 'TBI nu a răspuns' }, 502)
  }
}
