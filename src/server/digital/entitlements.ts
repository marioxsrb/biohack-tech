/**
 * The book's entitlements and their audit (migration 025). `syncEntitlement` runs inside the order's own transaction
 * (orders/service.ts transition), right after the state change that may earn or lose access, so the order page sees
 * the PDF the instant Stripe's webhook commits, and a webhook replay, a double click or a retried job can never grant
 * twice (one row per order and product, locked) or send a second automatic email (the job's dedupe key).
 */
import 'server-only'
import { createHash, randomUUID } from 'node:crypto'
import { BOOK_ID } from '@/content/catalog'
import type { Queryable, Row } from '@/server/db'
import type { Order } from '@/server/orders/model'
import { digitalAccess, isFinalBlock } from './rules'

export type EmailStatus = 'none' | 'queued' | 'sent' | 'failed'

export type Entitlement = {
  id: string
  orderId: string
  productId: string
  status: 'active' | 'revoked'
  grantedAt: Date
  grantedBy: string
  revokedAt: Date | null
  revokeReason: string | null
  linkVersion: number
  downloads: number
  lastDownloadAt: Date | null
  emailStatus: EmailStatus
  emailsSent: number
  manualSends: number
  emailSentAt: Date | null
  lastAttemptAt: Date | null
  lastError: string | null
}

const date = (v: unknown) => (v ? new Date(v as string) : null)
const toEntitlement = (r: Row): Entitlement => ({
  id: r.id as string,
  orderId: r.order_id as string,
  productId: r.product_id as string,
  status: r.status as Entitlement['status'],
  grantedAt: new Date(r.granted_at as string),
  grantedBy: r.granted_by as string,
  revokedAt: date(r.revoked_at),
  revokeReason: (r.revoke_reason as string) ?? null,
  linkVersion: Number(r.link_version),
  downloads: Number(r.downloads),
  lastDownloadAt: date(r.last_download_at),
  emailStatus: r.email_status as EmailStatus,
  emailsSent: Number(r.emails_sent),
  manualSends: Number(r.manual_sends),
  emailSentAt: date(r.email_sent_at),
  lastAttemptAt: date(r.last_attempt_at),
  lastError: (r.last_error as string) ?? null,
})

export type DigitalEvent = { id: number; type: string; actor: string; details: Record<string, unknown>; createdAt: Date }

/** A visitor's IP, kept only as a salted hash (enough to tell repeated downloads apart, nothing more). */
export const ipHash = (ip: string, salt: string) => (ip ? createHash('sha256').update(`${salt}|${ip}`).digest('hex').slice(0, 24) : null)

export const entitlements = {
  async byOrder(q: Queryable, orderId: string, lock = false): Promise<Entitlement | null> {
    const { rows } = await q.query(`select * from digital_entitlements where order_id = $1 and product_id = $2${lock ? ' for update' : ''}`, [orderId, BOOK_ID])
    return rows[0] ? toEntitlement(rows[0]) : null
  },

  async byId(q: Queryable, id: string, lock = false): Promise<Entitlement | null> {
    if (!/^[0-9a-f-]{36}$/.test(id)) return null
    const { rows } = await q.query(`select * from digital_entitlements where id = $1${lock ? ' for update' : ''}`, [id])
    return rows[0] ? toEntitlement(rows[0]) : null
  },

  async forOrders(q: Queryable, orderIds: string[]): Promise<Map<string, Entitlement>> {
    if (!orderIds.length) return new Map()
    const { rows } = await q.query('select * from digital_entitlements where order_id = any($1::uuid[])', [orderIds])
    return new Map(rows.map((r) => [r.order_id as string, toEntitlement(r)]))
  },

  update: (q: Queryable, id: string, patch: Record<string, unknown>) => {
    const keys = Object.keys(patch)
    return q.query(`update digital_entitlements set ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')}, updated_at = now() where id = $1`, [id, ...keys.map((k) => patch[k])])
  },

  event: (q: Queryable, e: { entitlementId: string | null; orderId: string; type: string; actor: string; details?: Record<string, unknown>; ipHash?: string | null }) =>
    q.query('insert into digital_events (entitlement_id, order_id, type, actor, details, ip_hash) values ($1, $2, $3, $4, $5, $6)', [
      e.entitlementId,
      e.orderId,
      e.type,
      e.actor.slice(0, 80),
      JSON.stringify(e.details ?? {}),
      e.ipHash ?? null,
    ]),

  async events(q: Queryable, orderId: string, limit = 200): Promise<DigitalEvent[]> {
    const { rows } = await q.query('select id, type, actor, details, created_at from digital_events where order_id = $1 order by id desc limit $2', [orderId, limit])
    return rows.map((r) => ({ id: Number(r.id), type: r.type as string, actor: r.actor as string, details: (r.details as Record<string, unknown>) ?? {}, createdAt: new Date(r.created_at as string) }))
  },

  /** Successful downloads of an entitlement since a moment (the per-hour limit). */
  async downloadsSince(q: Queryable, entitlementId: string, since: Date) {
    const { rows } = await q.query<{ n: string }>("select count(*) as n from digital_events where entitlement_id = $1 and type = 'download.ok' and created_at >= $2", [entitlementId, since])
    return Number(rows[0].n)
  },

  /** Grants once (row lock + unique key); returns the entitlement and whether this call created it. */
  async grant(q: Queryable, o: Order, by: string, actor = 'system'): Promise<{ entitlement: Entitlement; created: boolean }> {
    const existing = await this.byOrder(q, o.id, true)
    if (existing) return { entitlement: existing, created: false }
    const id = randomUUID()
    const { rows } = await q.query(
      `insert into digital_entitlements (id, order_id, product_id, status, granted_by) values ($1, $2, $3, 'active', $4)
       on conflict (order_id, product_id) do nothing returning *`,
      [id, o.id, BOOK_ID, by],
    )
    if (!rows[0]) return { entitlement: (await this.byOrder(q, o.id, true))!, created: false }
    await this.event(q, { entitlementId: id, orderId: o.id, type: 'granted', actor, details: { by } })
    return { entitlement: toEntitlement(rows[0]), created: true }
  },

  async revoke(q: Queryable, e: Entitlement, reason: string, actor = 'system') {
    if (e.status === 'revoked') return false
    await this.update(q, e.id, { status: 'revoked', revoked_at: new Date(), revoke_reason: reason.slice(0, 200), link_version: e.linkVersion + 1 })
    await this.event(q, { entitlementId: e.id, orderId: e.orderId, type: 'revoked', actor, details: { reason } })
    return true
  },
}

/**
 * Brings the order's entitlement in line with its state (inside the order's transaction). Grants when the order
 * earns access and has none; revokes an active one when the order is cancelled or fully refunded. A person's
 * revocation is never undone automatically. Returns what changed, for the order's side effects.
 */
export async function syncEntitlement(q: Queryable, o: Order, event: string): Promise<{ granted?: Entitlement; revoked?: boolean }> {
  const d = digitalAccess(o)
  if (d.ok) {
    const { entitlement, created } = await entitlements.grant(q, o, event)
    return created ? { granted: entitlement } : {}
  }
  if (!isFinalBlock(d.reason)) return {}
  const e = await entitlements.byOrder(q, o.id, true)
  if (!e || e.status !== 'active') return {}
  return { revoked: await entitlements.revoke(q, e, d.reason === 'refunded' ? 'comanda rambursată' : 'comanda anulată') }
}
