/**
 * TBI Fusion Pay for the "Cumpără în rate" requests (server/rate-tbi.ts), instead of the link sent by hand.
 * 1. registerForRequest (in /api/rate-tbi, before the answer): RegisterApplication with the basket valued by the
 *    server; the customer gets the URL ("Continuă cererea la TBI") right away. Saved in tbi_applications.
 * 2. applyToCard (in the job rate_tbi.submit, after the card exists): the URL in bt_tbi_link, the card on
 *    "Link trimis" with tbi_order_id / tbi_token (when those fields exist in GHL), and any status that arrived first.
 * 3. applyStatusUpdate (/api/tbi/status): 1 → "Aprobat", 0 / 3 → "Respins / Renunțat" (2, in progress, only in last_status);
 *    last_status and contract_number on the card, a note with the message, motive and contract on the contact.
 * Without TBI configured, without the webhook secret or without the category id nothing is registered and the
 * request follows the manual flow (a colleague sends the link).
 */
import 'server-only'
import { randomBytes } from 'node:crypto'
import { RATE_TBI_PRODUCTS, type RateTbiRequest } from '@/lib/rate-tbi'
import { getApplicationStatus, registerApplication, TBI_STATUS_LABEL, type TbiApplication, type TbiStatusUpdate } from '@/lib/tbi/client'
import type { Config, TbiConfig } from '@/server/config'
import type { Db } from '@/server/db'
import { ghl } from '@/server/integrations/ghl'
import { errText, log } from '@/server/log'
import type { RateTbiValuation } from '@/server/rate-tbi'

export type TbiRegistration = { orderRef: string; orderId: number; token: string; url: string; env: 'uat' | 'prod' }

export const TBI_PIPELINE = 'Rate TBI'
export const TBI_STAGES = { linkSent: 'Link trimis', inProgress: 'Cerere completată la TBI', approved: 'Aprobat', rejected: 'Respins / Renunțat' } as const

/**
 * The card's stage and status for a TBI status code (null: no move). 2 ("Comanda in derulare TBI") is sent by TBI as
 * soon as the application is registered, before the customer opens the link (seen on PROD, 6 Nov 2026): the card
 * stays on "Link trimis" and only last_status shows it. Refund statuses 4–6 do not move it either.
 */
export function stageForTbiStatus(code: number | null): { stage: string; status: 'open' | 'lost' | 'abandoned' } | null {
  if (code === 1) return { stage: TBI_STAGES.approved, status: 'open' }
  if (code === 0) return { stage: TBI_STAGES.rejected, status: 'abandoned' }
  if (code === 3) return { stage: TBI_STAGES.rejected, status: 'lost' }
  return null
}

/** Product images sent to TBI (mandatory per item): the store's main photo of each product. */
const IMAGES: Record<keyof typeof RATE_TBI_PRODUCTS, string> = {
  calm: 'https://cdn.shopify.com/s/files/1/1095/8431/8795/files/cutie-deschidere_87f63c7a-844b-4064-93f7-f223b597308a.webp?v=1792593931',
  focus: 'https://cdn.shopify.com/s/files/1/1095/8431/8795/files/casca-tableta_2e8539b1-6351-4823-94de-9364ede02f6f.webp?v=1792593932',
  amber: 'https://cdn.shopify.com/s/files/1/1095/8431/8795/files/cat-eye-negru-1_961a9551-4149-42c0-b4f5-15d4c188e221.webp?v=1792593935',
}

/** +40722123456 → 0722123456 (TBI's examples use the national form). */
const nationalPhone = (p: string) => p.replace(/^\+40/, '0')

/** BTR-YYYYMMDD-xxxxxx: unique, readable, never the customer's data. */
export function newOrderRef(now = new Date()) {
  const d = now.toISOString().slice(0, 10).replace(/-/g, '')
  return `BTR-${d}-${randomBytes(3).toString('hex')}`
}

/** The application TBI receives: the basket at the prices the store charges (the unit price is the line's total / qty). */
export function buildApplication(t: TbiConfig, r: RateTbiRequest, v: RateTbiValuation, orderRef: string): TbiApplication {
  const [firstname, ...rest] = r.name.trim().split(/\s+/)
  const items = v.lines.map((l) => ({
    name: l.title,
    qty: l.qty,
    price: Math.round((l.total / l.qty) * 100) / 100,
    sku: l.handle,
    category: t.categoryId!,
    imagelink: IMAGES[l.handle as keyof typeof IMAGES],
  }))
  const secret = encodeURIComponent(t.webhookSecret ?? '')
  return {
    orderid: orderRef,
    firstname,
    lastname: rest.join(' ') || undefined,
    email: r.email,
    phone: nationalPhone(r.phone),
    items,
    statusURL: `${t.publicBase}/api/tbi/status?s=${secret}`,
    successRedirectURL: `${t.publicBase}/api/tbi/result?r=ok&o=${encodeURIComponent(orderRef)}`,
    failRedirectURL: `${t.publicBase}/api/tbi/result?r=fail&o=${encodeURIComponent(orderRef)}`,
  }
}

/** Why a request is not sent to TBI (null: it can be). */
export function tbiUnavailable(t: TbiConfig | null): string | null {
  if (!t) return 'tbi not configured'
  if (!t.webhookSecret) return 'TBI_STATUS_WEBHOOK_SECRET missing'
  if (!t.categoryId) return 'TBI_DEFAULT_CATEGORY_ID missing'
  return null
}

/**
 * RegisterApplication for a request; null when TBI is not available or does not accept it (the request then goes
 * on as before). Never throws: TBI being down must not lose the request.
 */
export async function registerForRequest(cfg: Pick<Config, 'tbi'>, db: Db, r: RateTbiRequest, v: RateTbiValuation, fetchImpl?: typeof fetch): Promise<TbiRegistration | null> {
  const t = cfg.tbi
  const why = tbiUnavailable(t)
  if (why) {
    log.info('tbi.register_skipped', { reason: why })
    return null
  }
  const orderRef = newOrderRef()
  try {
    // The row exists before TBI is called: TBI posts its first status while RegisterApplication is still answering.
    await db.query(`insert into tbi_applications (order_ref, env, email, amount, events) values ($1, $2, $3, $4, '[]'::jsonb)`, [orderRef, t!.env, r.email, v.total])
    const reg = await registerApplication(t!, buildApplication(t!, r, v, orderRef), fetchImpl)
    await db.query(
      `update tbi_applications set tbi_order_id = $2, token = $3, url = $4, events = $5::jsonb || events, updated_at = now() where order_ref = $1`,
      [orderRef, reg.order_id, reg.token, reg.url, JSON.stringify([{ at: new Date().toISOString(), kind: 'registered', tbiOrderId: reg.order_id }])],
    )
    log.info('tbi.registered', { orderRef, tbiOrderId: reg.order_id, env: t!.env, total: v.total })
    // A first GetApplicationStatus: shows in the log that TBI knows the application (best effort).
    try {
      const st = await getApplicationStatus(t!, reg.order_id, reg.token, fetchImpl)
      log.info('tbi.status_check', { orderRef, tbiOrderId: reg.order_id, storeOrderId: st.store_order_id, status: st.status })
    } catch (e) {
      log.warn('tbi.status_check_failed', { orderRef, error: errText(e) })
    }
    return { orderRef, orderId: reg.order_id, token: reg.token, url: reg.url, env: t!.env }
  } catch (e) {
    log.warn('tbi.register_failed', { orderRef, error: errText(e) })
    await db.query(`update tbi_applications set events = events || $2::jsonb, updated_at = now() where order_ref = $1`, [orderRef, JSON.stringify([{ at: new Date().toISOString(), kind: 'register_failed', error: errText(e) }])]).catch(() => {})
    return null
  }
}

type Row = { order_ref: string; contact_id: string | null; opportunity_id: string | null; status_code: number | null; status_message: string | null; motive: string | null; contract_number: string | null; tbi_order_id: number | null; token: string | null }

/** In the job: the card goes to "Link trimis" with TBI's ids; a status that arrived before the card is applied now. */
export async function applyToCard(cfg: Pick<Config, 'ghl'>, db: Db, reg: TbiRegistration, contactId: string, opportunityId: string | null) {
  const g = cfg.ghl!
  await db.query(`update tbi_applications set contact_id = $2, opportunity_id = $3, updated_at = now() where order_ref = $1`, [reg.orderRef, contactId, opportunityId])
  if (!opportunityId) return
  const { missing } = await ghl.updateOpportunity(g, opportunityId, {
    pipeline: TBI_PIPELINE,
    stage: TBI_STAGES.linkSent,
    fields: { tbi_order_id: String(reg.orderId), tbi_token: reg.token },
  })
  if (missing.length) log.warn('tbi.card_fields_missing', { missing: missing.join(',') })
  const row = (await db.query<Row>(`select * from tbi_applications where order_ref = $1`, [reg.orderRef])).rows[0]
  if (row?.status_code !== null && row?.status_code !== undefined) await moveCard(cfg, row)
}

async function moveCard(cfg: Pick<Config, 'ghl'>, row: Row) {
  const target = stageForTbiStatus(row.status_code)
  if (!row.opportunity_id) return
  await ghl.updateOpportunity(cfg.ghl!, row.opportunity_id, {
    ...(target && { pipeline: TBI_PIPELINE, stage: target.stage, status: target.status }),
    fields: { last_status: `${row.status_code} ${row.status_message ?? ''}`.trim(), ...(row.contract_number && { contract_number: row.contract_number }) },
  })
}

export type StatusResult = { known: boolean; moved: boolean }

/** A status update from TBI (already decrypted and checked): saved, then the card is moved if it exists. */
export async function applyStatusUpdate(cfg: Pick<Config, 'ghl'>, db: Db, u: TbiStatusUpdate): Promise<StatusResult> {
  const event = { at: new Date().toISOString(), kind: 'status', status: u.status, message: u.message, motive: u.motive, contract: u.contract }
  const res = await db.query<Row>(
    `update tbi_applications set status_code = coalesce($2, status_code), status_message = $3, motive = $4,
       contract_number = coalesce(nullif($5, ''), contract_number), events = events || $6::jsonb, updated_at = now()
     where order_ref = $1 returning *`,
    [u.orderId, u.status, u.message || null, u.motive || null, u.contract, JSON.stringify([event])],
  )
  const row = res.rows[0]
  if (!row) {
    log.warn('tbi.status_unknown_order', { orderId: u.orderId, status: u.status })
    return { known: false, moved: false }
  }
  if (!cfg.ghl || !row.opportunity_id) return { known: true, moved: false }
  await moveCard(cfg, row)
  if (row.contact_id) {
    const label = u.status !== null ? (TBI_STATUS_LABEL[u.status] ?? `status ${u.status}`) : 'status necunoscut'
    await ghl.addNote(
      cfg.ghl,
      row.contact_id,
      [`TBI · ${label} (comanda ${row.order_ref}, TBI ${row.tbi_order_id ?? '-'})`, u.message && `Mesaj: ${u.message}`, u.motive && `Motiv: ${u.motive}`, u.contract && `Contract: ${u.contract}`].filter(Boolean).join('\n'),
    )
  }
  return { known: true, moved: true }
}
